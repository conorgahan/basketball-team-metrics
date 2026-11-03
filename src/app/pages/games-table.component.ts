import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { Game, METRICS, Metrics, shortDate } from '../models';

/** Game-by-game metrics table. Standalone so the dashboard can load it lazily (@defer) after first paint. */
@Component({
  selector: 'app-games-table',
  imports: [RouterLink, MatCardModule, MatTableModule],
  template: `
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
  `,
})
export class GamesTableComponent {
  rows = input.required<{ g: Game; m: Metrics }[]>();
  metrics = METRICS;
  columns = ['date', 'opponent', ...METRICS.map((m) => m.key)];
  shortDate = shortDate;
}
