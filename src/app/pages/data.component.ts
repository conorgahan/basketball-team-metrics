import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { confirmDialog } from '../confirm-dialog.component';
import { FiltersService } from '../filters.service';
import { NameListComponent } from '../name-list.component';
import { ImportResult, StorageService } from '../storage.service';

@Component({
  selector: 'app-data',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatListModule, MatSelectModule, NameListComponent],
  styles: `
    .masonry {
      column-count: 1;
      column-gap: 12px;
    }
    .masonry mat-card {
      break-inside: avoid;
      margin-bottom: 12px;
      display: block;
    }
    @media (min-width: 640px) {
      .masonry {
        column-count: 2;
      }
    }
    mat-card-content {
      padding-bottom: 16px;
    }
    mat-card-content > * + * {
      margin-top: 12px;
    }
    app-name-list {
      display: block;
      break-inside: avoid;
      margin-bottom: 12px;
    }
  `,
  template: `
    <div class="masonry">
      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Season dates</mat-card-title></mat-card-header>
        <mat-card-content>
          <p class="muted">
            A game belongs to the season whose start date it falls on or after. Current season: <b>{{ storage.currentSeason() }}</b>
          </p>
          <div class="form-grid two">
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Starts in</mat-label>
              <mat-select [value]="storage.config().seasonStartMonth" (selectionChange)="setStart('seasonStartMonth', $event.value)">
                @for (m of months; track m.value) {
                  <mat-option [value]="m.value">{{ m.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Day</mat-label>
              <input matInput type="number" min="1" max="31" inputmode="numeric" [ngModel]="storage.config().seasonStartDay" (ngModelChange)="setStart('seasonStartDay', $event)" />
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <app-name-list title="Competitions" noun="competition" placeholder="e.g. Tournament" [names]="storage.competitions()" [counts]="compCounts()" (added)="addComp($event)" (removed)="removeComp($event)" />
      <app-name-list title="Teams" noun="team" placeholder="e.g. Under 16s" [names]="storage.teams()" [counts]="teamCounts()" (added)="addTeam($event)" (removed)="removeTeam($event)" />

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Backup &amp; sharing</mat-card-title></mat-card-header>
        <mat-card-content>
          <p class="muted">Data lives only on this device. Export a backup regularly, or to merge stats from another coach's phone.</p>
          <div class="actions">
            <button mat-stroked-button (click)="download('json')">Export backup (.json)</button>
            <button mat-stroked-button (click)="download('csv')">Export spreadsheet (.csv)</button>
            <button mat-flat-button (click)="file.click()">Import &amp; merge backups</button>
            <input #file type="file" multiple accept=".json,application/json" (change)="import($event)" hidden />
          </div>
          <p class="muted">Select one or more backup files. Games with the same id keep the most recently edited version; identical games already here are skipped.</p>
          @if (result(); as r) {
            <p>
              <b>{{ r.added }}</b> added · <b>{{ r.updated }}</b> updated · {{ r.unchanged }} unchanged
            </p>
            @if (r.possibleDuplicates.length) {
              <p class="s-bad">Possible duplicates (same fixture, different numbers) – review in Games:</p>
              <ul>
                @for (d of r.possibleDuplicates; track $index) {
                  <li>{{ d }}</li>
                }
              </ul>
            }
            @for (e of r.errors; track $index) {
              <p class="s-bad">{{ e }}</p>
            }
          }
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Storage</mat-card-title></mat-card-header>
        <mat-card-content>
          <p class="muted">Persistent storage: {{ storage.persistent() === null ? 'checking…' : storage.persistent() ? 'granted' : 'not granted (browser may clear data if space is low – keep backups)' }}</p>
          <button mat-stroked-button class="danger" (click)="clear()">Delete everything</button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class DataComponent {
  storage = inject(StorageService);
  private dialog = inject(MatDialog);
  private filter = inject(FiltersService);
  result = signal<ImportResult | null>(null);
  months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((label, i) => ({ value: i + 1, label }));

  setStart(k: 'seasonStartMonth' | 'seasonStartDay', v: string | number | null) {
    const n = Number(v);
    if (n) this.storage.setConfig({ [k]: n });
  }
  teamCounts = computed(() => this.countBy((g) => g.team));
  compCounts = computed(() => this.countBy((g) => g.type));

  private countBy(key: (g: { team: string; type: string }) => string) {
    const counts: Record<string, number> = {};
    for (const g of this.storage.games()) counts[key(g)] = (counts[key(g)] ?? 0) + 1;
    return counts;
  }

  addComp(name: string) {
    this.storage.addCompetition(name);
  }
  addTeam(name: string) {
    this.storage.addTeam(name);
  }

  async removeTeam(name: string) {
    if (!(await this.confirmRemove('team', name, this.teamCounts()[name] ?? 0))) return;
    this.storage.removeTeam(name);
    this.filter.team.update((t) => t.filter((x) => x !== name));
  }
  async removeComp(name: string) {
    if (!(await this.confirmRemove('competition', name, this.compCounts()[name] ?? 0))) return;
    this.storage.removeCompetition(name);
    this.filter.comp.update((c) => c.filter((x) => x !== name));
  }

  private confirmRemove(noun: string, name: string, games: number) {
    const message = games ? `"${name}" and its ${games} game${games === 1 ? '' : 's'} will be removed. This cannot be undone.` : `"${name}" will be removed.`;
    return confirmDialog(this.dialog, { title: `Delete ${noun}?`, message, action: 'Delete' });
  }

  download(kind: 'json' | 'csv') {
    const body = kind === 'json' ? this.storage.exportJson() : this.storage.exportCsv();
    const blob = new Blob([body], { type: kind === 'json' ? 'application/json' : 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `team-metrics-${new Date().toISOString().slice(0, 10)}.${kind}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async import(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = await Promise.all([...(input.files ?? [])].map(async (f) => ({ name: f.name, text: await f.text() })));
    if (files.length) this.result.set(this.storage.importMany(files));
    input.value = '';
  }

  async clear() {
    if (await confirmDialog(this.dialog, { title: 'Delete everything?', message: 'All games, teams and settings on this device will be removed and the app will return to its starting state. Export a backup first if you might need the data. This cannot be undone.', action: 'Delete everything' })) {
      this.storage.clearAll();
      this.filter.reset();
      this.result.set(null);
    }
  }
}
