export interface Counts {
  fg2m: number;
  fg2a: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  tov: number;
  drb: number;
  oorb: number;
}

export interface Game extends Counts {
  id: string;
  date: string; // yyyy-mm-dd
  team: string;
  opponent: string;
  /** competition name, from the declared competitions list */
  type: string;
  notes: string;
  /** epoch ms of last edit; newest wins when merging backups */
  updatedAt?: number;
}

export interface Config {
  seasonStartMonth: number; // 1-12
  seasonStartDay: number;
}

/** What a fresh install, and "Delete everything", starts with. */
export const DEFAULT_TEAMS = ['My Team'];

export const DEFAULT_COMPETITIONS = ['League', 'Cup', 'Friendly'];

export const DEFAULT_CONFIG: Config = { seasonStartMonth: 9, seasonStartDay: 1 };

export const EMPTY_COUNTS: Counts = {
  fg2m: 0,
  fg2a: 0,
  fg3m: 0,
  fg3a: 0,
  ftm: 0,
  fta: 0,
  tov: 0,
  drb: 0,
  oorb: 0,
};

export type Status = 'good' | 'warn' | 'bad' | 'none';
export type MetricKey = 'efg' | 'tov' | 'drb' | 'ftr';

export interface Metrics {
  efg: number | null;
  tov: number | null;
  drb: number | null;
  ftr: number | null;
}

export interface MetricDef {
  key: MetricKey;
  label: string;
  nickname: string;
  target: string;
  unit: '%' | '';
  /** target band drawn on charts, in display units */
  band: [number, number];
  higherIsBetter: boolean;
  format: (v: number | null) => string;
  status: (v: number | null) => Status;
}

const pct = (v: number | null) => (v === null ? '–' : v.toFixed(1) + '%');

export const METRICS: MetricDef[] = [
  {
    key: 'efg',
    label: 'eFG%',
    nickname: 'Shooting efficiency',
    target: '40–45%',
    unit: '%',
    band: [40, 45],
    higherIsBetter: true,
    format: pct,
    status: (v) => (v === null ? 'none' : v >= 40 ? 'good' : v >= 35 ? 'warn' : 'bad'),
  },
  {
    key: 'tov',
    label: 'TOV%',
    nickname: 'Ball protection',
    target: '< 20%',
    unit: '%',
    band: [0, 20],
    higherIsBetter: false,
    format: pct,
    status: (v) => (v === null ? 'none' : v < 20 ? 'good' : v <= 25 ? 'warn' : 'bad'),
  },
  {
    key: 'drb',
    label: 'DRB%',
    nickname: 'Defensive rebounding',
    target: '> 65%',
    unit: '%',
    band: [65, 100],
    higherIsBetter: true,
    format: pct,
    status: (v) => (v === null ? 'none' : v >= 65 ? 'good' : v >= 60 ? 'warn' : 'bad'),
  },
  {
    key: 'ftr',
    label: 'FTR',
    nickname: 'Hustle',
    target: '0.25–0.35',
    unit: '',
    band: [0.25, 0.35],
    higherIsBetter: true,
    format: (v) => (v === null ? '–' : v.toFixed(2)),
    status: (v) => (v === null ? 'none' : v >= 0.25 ? 'good' : v >= 0.18 ? 'warn' : 'bad'),
  },
];

export function fga(c: Counts) {
  return c.fg2a + c.fg3a;
}
export function fgm(c: Counts) {
  return c.fg2m + c.fg3m;
}

export function sumCounts(games: Counts[]): Counts {
  const t = { ...EMPTY_COUNTS };
  for (const g of games) for (const k of Object.keys(t) as (keyof Counts)[]) t[k] += g[k];
  return t;
}

export function computeMetrics(c: Counts): Metrics {
  const FGA = fga(c);
  const possessions = FGA + 0.44 * c.fta + c.tov;
  const reb = c.drb + c.oorb;
  return {
    efg: FGA ? ((fgm(c) + 0.5 * c.fg3m) / FGA) * 100 : null,
    tov: possessions ? (100 * c.tov) / possessions : null,
    drb: reb ? (c.drb / reb) * 100 : null,
    ftr: FGA ? c.fta / FGA : null,
  };
}

export function isValid(c: Counts): string | null {
  if (c.fg2m > c.fg2a) return '2PT made exceeds attempts';
  if (c.fg3m > c.fg3a) return '3PT made exceeds attempts';
  if (c.ftm > c.fta) return 'FT made exceeds attempts';
  for (const k of Object.keys(EMPTY_COUNTS) as (keyof Counts)[]) if (c[k] < 0 || !Number.isFinite(c[k])) return 'Counts must be zero or more';
  return null;
}
