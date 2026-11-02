import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FilterBarComponent } from '../filter-bar.component';
import { FiltersService } from '../filters.service';
import { StorageService } from '../storage.service';
import { METRICS, computeMetrics } from '../models';

@Component({
  selector: 'app-games',
  imports: [RouterLink, MatCardModule, MatChipsModule, MatFormFieldModule, MatSelectModule, FilterBarComponent],
  styles: `
    a {
      text-decoration: none;
      color: inherit;
    }
    mat-chip-set {
      padding: 8px 16px 16px;
    }
  `,
  template: `
    <div class="stack">
      <section class="filters">
        <app-filter-bar />
      </section>

      <p class="muted">{{ rows().length }} of {{ storage.games().length }} game{{ storage.games().length === 1 ? '' : 's' }}</p>

      @if (!rows().length) {
        <mat-card appearance="outlined">
          <mat-card-content class="card-pad">{{ storage.games().length ? 'No games match these filters.' : 'No games yet.' }}</mat-card-content>
        </mat-card>
      }
      <div class="grid-2 games grid-3">
        @for (r of rows(); track r.g.id) {
          <a [routerLink]="['/game', r.g.id]">
            <mat-card appearance="outlined">
              <mat-card-header>
                <mat-card-title>{{ r.g.date }} · {{ r.g.opponent || 'Opponent' }}</mat-card-title>
                <mat-card-subtitle>{{ r.g.team }} · {{ storage.seasonOf(r.g.date) }} · {{ r.g.type }}</mat-card-subtitle>
              </mat-card-header>
              <mat-chip-set aria-label="Metrics">
                @for (m of metrics; track m.key) {
                  <mat-chip [class]="'s-' + m.status(r.m[m.key])">{{ m.label }} {{ m.format(r.m[m.key]) }}</mat-chip>
                }
              </mat-chip-set>
            </mat-card>
          </a>
        }
      </div>
    </div>
  `,
})
export class GamesComponent {
  storage = inject(StorageService);
  metrics = METRICS;

  private filter = inject(FiltersService);

  rows = computed(() => {
    return [...this.storage.sortedGames()]
      .reverse()

      .filter(this.filter.matches)
      .map((g) => ({ g, m: computeMetrics(g) }));
  });
}
