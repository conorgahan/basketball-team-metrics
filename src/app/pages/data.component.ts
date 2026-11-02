import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { confirmDialog } from '../confirm-dialog.component';
import { ImportResult, StorageService } from '../storage.service';

@Component({
  selector: 'app-data',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatInputModule, MatListModule, MatSelectModule],
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
    .add {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .add mat-form-field {
      flex: 1;
    }
    .add button {
      height: 56px;
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
          <div class="form-grid">
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

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Competitions</mat-card-title></mat-card-header>
        <mat-card-content>
          <mat-chip-set aria-label="Competitions">
            @for (c of storage.config().competitions; track c) {
              <mat-chip-row [removable]="storage.config().competitions.length > 1" (removed)="removeComp(c)">
                {{ c }}
                <button matChipRemove [attr.aria-label]="'Remove ' + c">✕</button>
              </mat-chip-row>
            }
          </mat-chip-set>
          <div class="add">
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Add competition</mat-label>
              <input matInput [(ngModel)]="newComp" placeholder="e.g. Tournament" (keyup.enter)="addComp()" />
            </mat-form-field>
            <button mat-stroked-button (click)="addComp()" [disabled]="!newComp.trim()">Add</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Teams</mat-card-title></mat-card-header>
        <mat-card-content>
          <mat-list>
            @for (t of storage.teams(); track t) {
              <mat-list-item>{{ t }}</mat-list-item>
            }
          </mat-list>
          <div class="add">
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Add team</mat-label>
              <input matInput [(ngModel)]="newTeam" placeholder="e.g. Under 16s" (keyup.enter)="addTeam()" />
            </mat-form-field>
            <button mat-stroked-button (click)="addTeam()" [disabled]="!newTeam.trim()">Add</button>
          </div>
        </mat-card-content>
      </mat-card>

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
          <button mat-stroked-button class="danger" (click)="clear()">Delete all games</button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class DataComponent {
  storage = inject(StorageService);
  private dialog = inject(MatDialog);
  result = signal<ImportResult | null>(null);
  newTeam = '';
  newComp = '';
  months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((label, i) => ({ value: i + 1, label }));

  setStart(k: 'seasonStartMonth' | 'seasonStartDay', v: string | number | null) {
    const n = Number(v);
    if (n) this.storage.setConfig({ [k]: n });
  }
  addComp() {
    const c = this.newComp.trim();
    if (c) this.storage.setConfig({ competitions: [...this.storage.config().competitions, c] });
    this.newComp = '';
  }
  removeComp(c: string) {
    this.storage.setConfig({ competitions: this.storage.config().competitions.filter((x) => x !== c) });
  }

  addTeam() {
    const t = this.newTeam.trim();
    if (t && !this.storage.teams().includes(t)) {
      this.storage.teams.update((l) => [...l, t]);
      this.storage.upsertTeamsSave();
    }
    this.newTeam = '';
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
    if (await confirmDialog(this.dialog, { title: 'Delete all games?', message: 'Every recorded game on this device will be removed. This cannot be undone.', action: 'Delete all' })) this.storage.clearAll();
  }
}
