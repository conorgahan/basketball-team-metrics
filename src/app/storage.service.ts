import { Injectable, computed, signal } from '@angular/core';
import { Game, Counts, Config, DEFAULT_COMPETITIONS, DEFAULT_CONFIG, DEFAULT_TEAMS, EMPTY_COUNTS } from './models';

export interface ImportResult {
  added: number;
  updated: number;
  unchanged: number;
  /** added, but same date/team/opponent as an existing game with different numbers */
  possibleDuplicates: string[];
  errors: string[];
}

const COUNT_KEYS = Object.keys(EMPTY_COUNTS) as (keyof Counts)[];
const sameCounts = (a: Game, b: Game) => COUNT_KEYS.every((k) => a[k] === b[k]);
const sameFixture = (a: Game, b: Game) => a.date === b.date && a.team === b.team && a.opponent.trim().toLowerCase() === b.opponent.trim().toLowerCase();

const KEY = 'team-metrics.v1';

interface Persisted {
  games: Game[];
  teams: string[];
  competitions: string[];
  config?: Partial<Config>;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  readonly games = signal<Game[]>([]);
  readonly teams = signal<string[]>([...DEFAULT_TEAMS]);
  readonly config = signal<Config>({ ...DEFAULT_CONFIG });
  readonly persistent = signal<boolean | null>(null);
  readonly competitions = signal<string[]>([...DEFAULT_COMPETITIONS]);
  /** Seasons that have games, plus the current one, newest first. */
  readonly seasons = computed(() =>
    Array.from(new Set([this.currentSeason(), ...this.games().map((g) => this.seasonOf(g.date))]))
      .sort()
      .reverse(),
  );
  readonly sortedGames = computed(() => [...this.games()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)));

  constructor() {
    this.load();
    navigator.storage
      ?.persist?.()
      .then((p) => this.persistent.set(p))
      .catch(() => this.persistent.set(false));
  }

  private load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Persisted;
      this.apply(d);
      if (d.config) this.config.set(this.cleanConfig(d.config));
    } catch {
      /* corrupt or unavailable storage: start empty */
    }
  }

  private apply(d: Partial<Persisted>) {
    const games = (d.games ?? []).filter((g) => g && typeof g.id === 'string' && typeof g.date === 'string').map((g) => ({ ...EMPTY_COUNTS, ...g }) as Game);
    const unique = (names: string[]) => Array.from(new Set(names.map((n) => String(n).trim()).filter(Boolean)));
    // every team / competition a game refers to is declared, so nothing is orphaned
    const teams = unique([...(d.teams ?? []), ...games.map((g) => g.team)]);
    const competitions = unique([...(d.competitions ?? []), ...games.map((g) => g.type)]);
    this.games.set(games);
    if (teams.length) this.teams.set(teams);
    if (competitions.length) this.competitions.set(competitions);
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ games: this.games(), teams: this.teams(), competitions: this.competitions(), config: this.config() }));
    } catch {
      /* quota */
    }
  }

  addTeam(name: string) {
    const n = name.trim();
    if (n && !this.teams().includes(n)) {
      this.teams.update((t) => [...t, n]);
      this.save();
    }
  }

  addCompetition(name: string) {
    const n = name.trim();
    if (n && !this.competitions().includes(n)) {
      this.competitions.update((c) => [...c, n]);
      this.save();
    }
  }

  private cleanConfig(c: Partial<Config>): Config {
    const month = Math.min(12, Math.max(1, Math.floor(Number(c.seasonStartMonth)) || DEFAULT_CONFIG.seasonStartMonth));
    const maxDay = new Date(2001, month, 0).getDate();
    const day = Math.min(maxDay, Math.max(1, Math.floor(Number(c.seasonStartDay)) || 1));
    return { seasonStartMonth: month, seasonStartDay: day };
  }

  setConfig(patch: Partial<Config>) {
    this.config.set(this.cleanConfig({ ...this.config(), ...patch }));
    this.save();
  }

  /** Season label for a yyyy-mm-dd date, e.g. "2026-27" (or "2026" when seasons start 1 Jan). */
  seasonOf(date: string): string {
    const [y, m, d] = date.split('-').map(Number);
    const { seasonStartMonth: sm, seasonStartDay: sd } = this.config();
    const start = m > sm || (m === sm && d >= sd) ? y : y - 1;
    return sm === 1 && sd === 1 ? String(y) : `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
  }

  currentSeason() {
    return this.seasonOf(new Date().toISOString().slice(0, 10));
  }

  get(id: string) {
    return this.games().find((g) => g.id === id);
  }

  upsert(g: Game) {
    g = { ...g, updatedAt: Date.now() };
    this.games.update((list) => (list.some((x) => x.id === g.id) ? list.map((x) => (x.id === g.id ? g : x)) : [...list, g]));
    if (!this.teams().includes(g.team)) this.teams.update((t) => [...t, g.team]);
    if (g.type && !this.competitions().includes(g.type)) this.competitions.update((c) => [...c, g.type]);
    this.save();
  }

  remove(id: string) {
    this.games.update((l) => l.filter((g) => g.id !== id));
    this.save();
  }

  newGame(team?: string): Game {
    return {
      ...EMPTY_COUNTS,
      id: crypto.randomUUID?.() ?? String(Date.now()),
      date: new Date().toISOString().slice(0, 10),
      team: team ?? this.teams()[0],
      opponent: '',
      type: this.competitions()[0],
      notes: '',
    };
  }

  exportJson(): string {
    return JSON.stringify({ games: this.games(), teams: this.teams(), competitions: this.competitions(), config: this.config() }, null, 2);
  }

  /**
   * Merge any number of backups. Per game id the newest edit wins; identical
   * games recorded under different ids are skipped. A failing file does not
   * stop the others.
   */
  importMany(files: { name: string; text: string }[]): ImportResult {
    const r: ImportResult = { added: 0, updated: 0, unchanged: 0, possibleDuplicates: [], errors: [] };
    const byId = new Map(this.games().map((g) => [g.id, g]));
    const teams = [...this.teams()];
    const comps = [...this.competitions()];

    for (const f of files) {
      let d: Partial<Persisted>;
      try {
        d = JSON.parse(f.text);
        if (!Array.isArray(d.games)) throw new Error('not a Team Metrics backup');
      } catch (e) {
        r.errors.push(`${f.name}: ${(e as Error).message}`);
        continue;
      }

      teams.push(...(d.teams ?? []));
      comps.push(...(d.competitions ?? []));
      for (const raw of d.games!) {
        if (!raw || typeof raw.id !== 'string' || typeof raw.date !== 'string') {
          r.errors.push(`${f.name}: skipped a malformed game`);
          continue;
        }
        const g = { ...EMPTY_COUNTS, type: comps[0], notes: '', opponent: '', team: teams[0], ...(raw as Partial<Game>) } as Game;
        const cur = byId.get(g.id);
        if (cur) {
          if (sameCounts(cur, g) && cur.notes === g.notes && cur.opponent === g.opponent && cur.date === g.date) r.unchanged++;
          else if ((g.updatedAt ?? 0) > (cur.updatedAt ?? 0)) {
            byId.set(g.id, g);
            r.updated++;
          } else r.unchanged++;
          continue;
        }
        const twin = [...byId.values()].find((x) => sameFixture(x, g));
        if (twin && sameCounts(twin, g)) {
          r.unchanged++;
          continue;
        }
        if (twin) r.possibleDuplicates.push(`${g.date} vs ${g.opponent || 'opponent'} (${g.team})`);
        byId.set(g.id, g);
        r.added++;
      }
    }
    this.apply({ games: [...byId.values()], teams, competitions: comps });
    this.save();
    return r;
  }

  exportCsv(): string {
    const cols = ['season', 'date', 'team', 'opponent', 'type', 'fg2m', 'fg2a', 'fg3m', 'fg3a', 'ftm', 'fta', 'tov', 'drb', 'oorb', 'notes'] as const;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [cols.join(','), ...this.sortedGames().map((g) => cols.map((c) => esc(c === 'season' ? this.seasonOf(g.date) : g[c])).join(','))].join('\n');
  }

  gameCount(team: string) {
    return this.games().filter((g) => g.team === team).length;
  }

  /** Removes the team and all of its games. The last remaining team can't be removed. */
  removeTeam(name: string) {
    if (this.teams().length < 2) return;
    this.teams.update((t) => t.filter((x) => x !== name));
    this.games.update((l) => l.filter((g) => g.team !== name));
    this.save();
  }

  /** Removes the competition and all games played in it. The last remaining competition can't be removed. */
  removeCompetition(name: string) {
    if (this.competitions().length < 2) return;
    this.competitions.update((c) => c.filter((x) => x !== name));
    this.games.update((l) => l.filter((g) => g.type !== name));
    this.save();
  }

  /** Wipes games, teams and settings, returning the app to its first-run state. */
  clearAll() {
    this.games.set([]);
    this.teams.set([...DEFAULT_TEAMS]);
    this.competitions.set([...DEFAULT_COMPETITIONS]);
    this.config.set({ ...DEFAULT_CONFIG });
    this.save();
  }
}
