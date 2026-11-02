import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { FilterBarComponent } from '../filter-bar.component';
import { FiltersService } from '../filters.service';
import { StorageService } from '../storage.service';
import { METRICS, MetricDef, Status, computeMetrics, sumCounts, fga } from '../models';

/** dd/mm/yy: unambiguous when games from several seasons are shown together. */
const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;

type Period = 'all' | '1' | '3' | '5';

interface ChartVm {
  m: MetricDef;
  data: ChartData<'line'>;
  options: ChartOptions<'line'>;
}

const AXIS: Record<string, { min: number; max: number }> = {
  efg: { min: 30, max: 55 },
  tov: { min: 0, max: 30 },
  drb: { min: 40, max: 100 },
  ftr: { min: 0, max: 0.5 },
};

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatButtonModule, MatButtonToggleModule, MatCardModule, MatFormFieldModule, MatListModule, MatSelectModule, MatTableModule, BaseChartDirective, FilterBarComponent],
  template: `
    <div class="stack">
      <section class="filters">
        <app-filter-bar />
        <mat-button-toggle-group class="span-all" [value]="period()" (change)="period.set($event.value)" aria-label="Period" hideSingleSelectionIndicator>
          <mat-button-toggle value="all">All games</mat-button-toggle>
          <mat-button-toggle value="5">Last 5</mat-button-toggle>
          <mat-button-toggle value="3">Last 3</mat-button-toggle>
          <mat-button-toggle value="1">Last 1</mat-button-toggle>
        </mat-button-toggle-group>
      </section>

      @if (!games().length) {
        <mat-card appearance="outlined">
          <mat-card-content class="card-pad">
            <p>No games match these filters.</p>
            <a mat-flat-button routerLink="/game/new">Record a game</a>
          </mat-card-content>
        </mat-card>
      } @else {
        <div class="stack">
          <p class="muted">{{ games().length }} game{{ games().length === 1 ? '' : 's' }} · {{ totalAttempts() }} shot attempts</p>

          <div class="grid-4">
            @for (m of metrics; track m.key) {
              <mat-card appearance="outlined" [class]="'tile s-' + m.status(agg()[m.key])">
                <mat-card-content class="card-pad">
                  <div class="label">{{ m.label }}</div>
                  <div class="muted">{{ m.nickname }}</div>
                  <div class="value">{{ m.format(agg()[m.key]) }}</div>
                  <div class="muted">Target {{ m.target }}</div>
                </mat-card-content>
              </mat-card>
            }
          </div>

          <mat-card appearance="outlined">
            <mat-card-header
              ><mat-card-title>{{ periodLabel() }} markers</mat-card-title></mat-card-header
            >
            <mat-card-content>
              <mat-list>
                <mat-list-item
                  ><span matListItemTitle>Turnovers / game (&lt; 15)</span><span matListItemMeta>{{ perGame('tov') }}</span></mat-list-item
                >
                <mat-list-item
                  ><span matListItemTitle>FT attempts / game (&gt; 20)</span><span matListItemMeta>{{ perGame('fta') }}</span></mat-list-item
                >
                <mat-list-item
                  ><span matListItemTitle>FT% (&gt; 52%)</span><span matListItemMeta>{{ ftPct() }}</span></mat-list-item
                >
              </mat-list>
            </mat-card-content>
          </mat-card>

          <div class="grid-2">
            @for (c of charts(); track c.m.key) {
              <mat-card appearance="outlined">
                <mat-card-header>
                  <mat-card-title>{{ c.m.label }} by game</mat-card-title>
                  <mat-card-subtitle>Target {{ c.m.target }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content class="card-pad">
                  <div class="chart-box"><canvas baseChart type="line" [data]="c.data" [options]="c.options"></canvas></div>
                </mat-card-content>
              </mat-card>
            }
          </div>

          <mat-card appearance="outlined">
            <mat-card-header><mat-card-title>Game by game</mat-card-title></mat-card-header>
            <mat-card-content class="scroll-x">
              <table mat-table [dataSource]="rows()">
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let r">
                    <a [routerLink]="['/game', r.g.id]">{{ shortDate(r.g.date) }}</a>
                  </td>
                </ng-container>
                <ng-container matColumnDef="opponent">
                  <th mat-header-cell *matHeaderCellDef>Opp</th>
                  <td mat-cell *matCellDef="let r">{{ r.g.opponent || '–' }}</td>
                </ng-container>
                @for (m of metrics; track m.key) {
                  <ng-container [matColumnDef]="m.key">
                    <th mat-header-cell *matHeaderCellDef>{{ m.label }}</th>
                    <td mat-cell *matCellDef="let r" [class]="'s-' + m.status(r.m[m.key])">{{ m.format(r.m[m.key]) }}</td>
                  </ng-container>
                }
                <tr mat-header-row *matHeaderRowDef="columns"></tr>
                <tr mat-row *matRowDef="let r; columns: columns"></tr>
              </table>
            </mat-card-content>
          </mat-card>

          <div><button mat-flat-button (click)="share()">Share / copy report</button></div>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent {
  storage = inject(StorageService);
  private snack = inject(MatSnackBar);
  metrics = METRICS;
  shortDate = shortDate;
  columns = ['date', 'opponent', ...METRICS.map((m) => m.key)];

  private filter = inject(FiltersService);
  period = signal<string>('all');
  dark = signal(false);

  constructor() {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    this.dark.set(mq.matches);
    mq.addEventListener('change', (e) => this.dark.set(e.matches));
  }

  games = computed(() => {
    const all = this.storage.sortedGames().filter(this.filter.matches);
    return this.period() === 'all' ? all : all.slice(-Number(this.period()));
  });
  rows = computed(() => this.games().map((g) => ({ g, m: computeMetrics(g) })));
  agg = computed(() => computeMetrics(sumCounts(this.games())));
  totalAttempts = computed(() => fga(sumCounts(this.games())));
  periodLabel = () => ({ all: 'Season', '1': 'Last game', '3': 'Last 3 games', '5': 'Last 5 games' })[this.period() as Period];

  charts = computed<ChartVm[]>(() => {
    const dark = this.dark();
    const c = {
      line: dark ? '#abc7ff' : '#005cbb',
      text: dark ? '#c6c4da' : '#464557',
      grid: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)',
      band: dark ? 'rgba(90,208,138,.22)' : 'rgba(26,138,74,.16)',
      status: { good: dark ? '#5ad08a' : '#1a7a43', warn: dark ? '#f0a93b' : '#a86400', bad: dark ? '#ff8a8a' : '#c62828', none: '#888' } as Record<Status, string>,
    };
    const rows = this.rows();
    return METRICS.map((m) => {
      const values = rows.map((r) => r.m[m.key]);
      return {
        m,
        data: {
          labels: rows.map((r) => shortDate(r.g.date)),
          datasets: [
            {
              data: values,
              borderColor: c.line,
              borderWidth: 2,
              tension: 0,
              pointRadius: 5,
              pointHoverRadius: 7,
              pointBackgroundColor: values.map((v) => c.status[m.status(v)]),
              pointBorderColor: values.map((v) => c.status[m.status(v)]),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { color: c.text }, grid: { display: false } },
            y: { suggestedMin: AXIS[m.key].min, suggestedMax: AXIS[m.key].max, ticks: { color: c.text, callback: (v) => (m.key === 'ftr' ? Number(v).toFixed(2) : v) }, grid: { color: c.grid } },
          },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${m.label} ${m.format(ctx.parsed.y)}` } },
            annotation: { annotations: { target: { type: 'box', yMin: m.band[0], yMax: m.band[1], backgroundColor: c.band, borderWidth: 0 } } },
          },
        },
      };
    });
  });

  perGame(k: 'tov' | 'fta') {
    const n = this.games().length;
    return n ? (sumCounts(this.games())[k] / n).toFixed(1) : '–';
  }
  ftPct() {
    const s = sumCounts(this.games());
    return s.fta ? ((s.ftm / s.fta) * 100).toFixed(1) + '%' : '–';
  }

  report(): string {
    const lbl = [this.filter.describe(), { all: '', '1': 'last game', '3': 'last 3 games', '5': 'last 5 games' }[this.period() as Period]].filter(Boolean).join(', ');
    const lines = this.metrics.map((m) => `${m.label} (${m.nickname}): ${m.format(this.agg()[m.key])}  [target ${m.target}]`);
    return [`${lbl} (${this.games().length} games)`, ...lines, `TOV/game: ${this.perGame('tov')} · FTA/game: ${this.perGame('fta')} · FT%: ${this.ftPct()}`].join('\n');
  }

  async share() {
    const text = this.report();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Team Metrics report', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      this.snack.open('Report copied to clipboard', undefined, { duration: 2500 });
    } catch {
      /* share dismissed */
    }
  }
}
