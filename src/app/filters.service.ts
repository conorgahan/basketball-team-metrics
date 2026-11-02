import { Injectable, computed, inject, signal } from '@angular/core';
import { Game } from './models';
import { StorageService } from './storage.service';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  label: string;
  /** shown when nothing is selected, which means "no restriction" */
  allLabel: string;
  values: string[];
  options: FilterOption[];
  set: (values: string[]) => void;
  labelOf: (value: string) => string;
}

/** Team / season / competition / opponent selections shared by every tab. An empty selection means "all". */
@Injectable({ providedIn: 'root' })
export class FiltersService {
  private storage = inject(StorageService);

  readonly team = signal<string[]>(this.storage.teams().slice(0, 1));
  readonly season = signal<string[]>([this.storage.currentSeason()]);
  readonly comp = signal<string[]>([]);
  /** Normalised opponent keys: names are free text, so ignore case and spacing. */
  readonly opp = signal<string[]>([]);

  /** Back to the defaults: first team, current season, everything else unrestricted. */
  reset() {
    this.team.set(this.storage.teams().slice(0, 1));
    this.season.set([this.storage.currentSeason()]);
    this.comp.set([]);
    this.opp.set([]);
  }

  private oppKey = (name: string) => name.trim().toLowerCase();

  /** Every opponent seen, keeping the first spelling used. */
  private readonly opponentLabels = computed(() => {
    const seen = new Map<string, string>();
    for (const g of this.storage.sortedGames()) {
      const name = g.opponent.trim();
      if (name && !seen.has(this.oppKey(name))) seen.set(this.oppKey(name), name);
    }
    return seen;
  });

  /** Opponent choices, limited to the selected teams. */
  private readonly opponentOptions = computed(() => {
    const teams = this.team();
    const keys = new Set(
      this.storage
        .sortedGames()
        .filter((g) => !teams.length || teams.includes(g.team))
        .map((g) => this.oppKey(g.opponent)),
    );
    return [...this.opponentLabels()]
      .filter(([k]) => keys.has(k))
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  private same = (v: string) => v;

  readonly filters = computed<FilterDef[]>(() => [
    { label: 'Team', allLabel: 'All teams', values: this.team(), options: this.storage.teams().map((t) => ({ value: t, label: t })), set: (v) => this.team.set(v), labelOf: this.same },
    { label: 'Season', allLabel: 'All seasons', values: this.season(), options: this.storage.seasons().map((s) => ({ value: s, label: s })), set: (v) => this.season.set(v), labelOf: this.same },
    { label: 'Competition', allLabel: 'All competitions', values: this.comp(), options: this.storage.competitions().map((c) => ({ value: c, label: c })), set: (v) => this.comp.set(v), labelOf: this.same },
    { label: 'Opponent', allLabel: 'All opponents', values: this.opp(), options: this.opponentOptions(), set: (v) => this.opp.set(v), labelOf: (v) => this.opponentLabels().get(v) ?? v },
  ]);

  matches = (g: Game) => (!this.team().length || this.team().includes(g.team)) && (!this.season().length || this.season().includes(this.storage.seasonOf(g.date))) && (!this.comp().length || this.comp().includes(g.type)) && (!this.opp().length || this.opp().includes(this.oppKey(g.opponent)));

  /** Human-readable summary, e.g. "My Team, 2026-27, all competitions, vs Tolka / Rovers". */
  describe() {
    const part = (values: string[], all: string, label = (v: string) => v) => (values.length ? values.map(label).join(' / ') : all);
    return [part(this.team(), 'all teams'), part(this.season(), 'all seasons'), part(this.comp(), 'all competitions'), ...(this.opp().length ? ['vs ' + part(this.opp(), '', (v) => this.opponentLabels().get(v) ?? v)] : [])].join(', ');
  }
}
