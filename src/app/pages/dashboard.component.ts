import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ChartsComponent } from './charts.component';
import { GamesTableComponent } from './games-table.component';
import { FilterBarComponent } from '../filter-bar.component';
import { FiltersService } from '../filters.service';
import { StorageService } from '../storage.service';
import { METRICS, computeMetrics, sumCounts, fga } from '../models';

type Period = 'all' | '1' | '3' | '5';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatButtonModule, MatButtonToggleModule, MatCardModule, MatFormFieldModule, MatListModule, MatSelectModule, ChartsComponent, GamesTableComponent, FilterBarComponent],
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

          @defer (on idle) {
            <app-charts [rows]="rows()" />
          } @placeholder {
            <div class="chart-box"></div>
          }

          @defer (on idle) {
            <app-games-table [rows]="rows()" />
          } @placeholder {
            <div class="chart-box"></div>
          }

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

  private filter = inject(FiltersService);
  period = signal<string>('all');

  games = computed(() => {
    const all = this.storage.sortedGames().filter(this.filter.matches);
    return this.period() === 'all' ? all : all.slice(-Number(this.period()));
  });
  rows = computed(() => this.games().map((g) => ({ g, m: computeMetrics(g) })));
  agg = computed(() => computeMetrics(sumCounts(this.games())));
  totalAttempts = computed(() => fga(sumCounts(this.games())));
  periodLabel = () => ({ all: 'Season', '1': 'Last game', '3': 'Last 3 games', '5': 'Last 5 games' })[this.period() as Period];

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
