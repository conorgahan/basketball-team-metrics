import { Component, computed, input, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { CategoryScale, ChartData, ChartOptions, LineController, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { BaseChartDirective, provideCharts } from 'ng2-charts';
import { METRICS, MetricDef, Metrics, Status, shortDate } from '../models';

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

/**
 * Trend chart per metric. Loaded lazily (@defer in the dashboard) so Chart.js stays out of the first download;
 * Chart.js is registered here, not app-wide, for the same reason.
 */
@Component({
  selector: 'app-charts',
  imports: [MatCardModule, BaseChartDirective],
  providers: [provideCharts({ registerables: [LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, annotationPlugin] })],
  template: `
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
  `,
})
export class ChartsComponent {
  rows = input.required<{ g: { date: string }; m: Metrics }[]>();
  dark = signal(false);

  constructor() {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    this.dark.set(mq.matches);
    mq.addEventListener('change', (e) => this.dark.set(e.matches));
  }

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
}
