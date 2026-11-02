import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { confirmDialog } from '../confirm-dialog.component';
import { StorageService } from '../storage.service';
import { Counts, Game, METRICS, computeMetrics, isValid } from '../models';

type Key = keyof Counts;

/** yyyy-mm-dd <-> local Date, so the stored string never shifts with timezone. */
const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fromDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

@Component({
  selector: 'app-game',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatDatepickerModule, MatExpansionModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  styles: `
    .live {
      position: sticky;
      top: 112px;
      z-index: 5;
    }
    .live mat-card-content {
      display: flex;
      justify-content: space-around;
      padding: 8px;
    }
    .mini {
      text-align: center;
    }
    .mini b {
      display: block;
      font: var(--mat-sys-title-medium);
    }
    .count {
      font: var(--mat-sys-headline-medium);
      font-weight: 700;
    }
    .tap {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    mat-card:has(.tap) {
      height: 100%;
    }
    .btns {
      margin-top: auto;
      padding-top: 8px;
      display: flex;
      gap: 12px;
    }
    .btns button {
      flex: 1;
      height: 64px;
      font-size: 1.15rem;
    }
    .made {
      --mat-button-filled-container-color: var(--ok);
      --mat-button-filled-label-text-color: light-dark(#fff, #0b2a17);
    }
    .miss {
      --mat-button-filled-container-color: var(--bad);
      --mat-button-filled-label-text-color: light-dark(#fff, #3a0a0a);
    }
  `,
  template: `
    <div class="stack">
      <mat-card appearance="outlined">
        <mat-card-content class="card-pad"
          ><div class="form-grid">
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Date</mat-label>
              <input matInput [matDatepicker]="picker" [value]="date()" (dateChange)="onDate($event.value)" (click)="picker.open()" required />
              <mat-datepicker-toggle matIconSuffix [for]="picker" />
              <mat-datepicker #picker />
            </mat-form-field>
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Team</mat-label>
              <mat-select [value]="g().team" (selectionChange)="set('team', $event.value)">
                @for (t of storage.teams(); track t) {
                  <mat-option [value]="t">{{ t }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Opponent</mat-label>
              <input matInput [ngModel]="g().opponent" (ngModelChange)="set('opponent', $event)" placeholder="e.g. Tolka Rovers" />
            </mat-form-field>
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Competition</mat-label>
              <mat-select [value]="g().type" (selectionChange)="set('type', $event.value)">
                @for (t of competitions(); track t) {
                  <mat-option [value]="t">{{ t }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div></mat-card-content
        >
      </mat-card>

      <mat-card appearance="outlined" class="live">
        <mat-card-content>
          @for (m of metrics; track m.key) {
            <div class="mini" [class]="'mini s-' + m.status(live()[m.key])">
              <span class="muted">{{ m.label }}</span>
              <b>{{ m.format(live()[m.key]) }}</b>
            </div>
          }
        </mat-card-content>
      </mat-card>

      <div class="grid-3">
        @for (s of shooting; track s.label) {
          <mat-card appearance="outlined">
            <mat-card-content class="card-pad tap">
              <div class="row">
                <mat-card-title>{{ s.label }}</mat-card-title>
                <span class="count">{{ g()[s.m] }}/{{ g()[s.a] }}</span>
              </div>
              <div class="btns">
                <button mat-flat-button class="made" (click)="shot(s.m, s.a, true)">Made</button>
                <button mat-flat-button class="miss" (click)="shot(s.m, s.a, false)">Miss</button>
              </div>
            </mat-card-content>
          </mat-card>
        }
        @for (s of singles; track s.k) {
          <mat-card appearance="outlined">
            <mat-card-content class="card-pad tap">
              <div class="row">
                <mat-card-title>{{ s.label }}</mat-card-title>
                <span class="count">{{ g()[s.k] }}</span>
              </div>
              <div class="btns"><button mat-flat-button class="made" (click)="bump(s.k)">+1</button></div>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <div><button mat-stroked-button (click)="undo()" [disabled]="!history().length">Undo last</button></div>

      <mat-expansion-panel>
        <mat-expansion-panel-header><mat-panel-title>Edit totals manually</mat-panel-title></mat-expansion-panel-header>
        <div class="form-grid nums">
          @for (f of fields; track f.k) {
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>{{ f.label }}</mat-label>
              <input matInput type="number" min="0" inputmode="numeric" [ngModel]="g()[f.k]" (ngModelChange)="num(f.k, $event)" />
            </mat-form-field>
          }
        </div>
      </mat-expansion-panel>

      <mat-form-field>
        <mat-label>Notes</mat-label>
        <textarea matInput rows="3" [ngModel]="g().notes" (ngModelChange)="set('notes', $event)"></textarea>
      </mat-form-field>

      <div class="actions">
        <button mat-flat-button (click)="save()" [disabled]="!dirty()">Save game</button>
        @if (!isNew) {
          <button mat-stroked-button class="danger" (click)="del()">Delete</button>
        }
      </div>
    </div>
  `,
})
export class GameComponent {
  storage = inject(StorageService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  isNew = !this.id || this.id === 'new';
  metrics = METRICS;
  g = signal<Game>(this.isNew ? this.storage.newGame() : { ...(this.storage.get(this.id!) ?? this.storage.newGame()) });
  private initial = JSON.stringify(this.g());
  /** True once the game differs from what was loaded (or from a blank new game). */
  dirty = computed(() => JSON.stringify(this.g()) !== this.initial);
  history = signal<Key[][]>([]);
  date = computed(() => toDate(this.g().date));
  competitions = computed(() => Array.from(new Set([...this.storage.competitions(), this.g().type])).filter(Boolean));
  live = computed(() => computeMetrics(this.g()));

  shooting = [
    { label: '2-point shots', m: 'fg2m' as Key, a: 'fg2a' as Key },
    { label: '3-point shots', m: 'fg3m' as Key, a: 'fg3a' as Key },
    { label: 'Free throws', m: 'ftm' as Key, a: 'fta' as Key },
  ];
  singles = [
    { label: 'Turnovers (ours)', k: 'tov' as Key },
    { label: 'Defensive rebounds (ours)', k: 'drb' as Key },
    { label: 'Opponent offensive rebounds', k: 'oorb' as Key },
  ];
  fields = [
    { k: 'fg2m' as Key, label: '2PT made' },
    { k: 'fg2a' as Key, label: '2PT att' },
    { k: 'fg3m' as Key, label: '3PT made' },
    { k: 'fg3a' as Key, label: '3PT att' },
    { k: 'ftm' as Key, label: 'FT made' },
    { k: 'fta' as Key, label: 'FT att' },
    { k: 'tov' as Key, label: 'Turnovers' },
    { k: 'drb' as Key, label: 'Def reb' },
    { k: 'oorb' as Key, label: 'Opp off reb' },
  ];

  onDate(d: Date | null) {
    if (d) this.set('date', fromDate(d));
  }
  set<K extends keyof Game>(k: K, v: Game[K]) {
    this.g.update((g) => ({ ...g, [k]: v }));
  }
  num(k: Key, v: number | null) {
    this.g.update((g) => ({ ...g, [k]: Math.max(0, Math.floor(Number(v) || 0)) }));
  }

  shot(m: Key, a: Key, made: boolean) {
    this.g.update((g) => ({ ...g, [a]: g[a] + 1, [m]: g[m] + (made ? 1 : 0) }));
    this.history.update((h) => [...h, made ? [m, a] : [a]]);
    navigator.vibrate?.(15);
  }
  bump(k: Key) {
    this.g.update((g) => ({ ...g, [k]: g[k] + 1 }));
    this.history.update((h) => [...h, [k]]);
    navigator.vibrate?.(15);
  }
  undo() {
    const last = this.history().at(-1);
    if (!last) return;
    this.g.update((g) => {
      const n = { ...g };
      for (const k of last) n[k] = Math.max(0, n[k] - 1);
      return n;
    });
    this.history.update((h) => h.slice(0, -1));
  }

  save() {
    const err = isValid(this.g());
    if (err) {
      this.snack.open(err, 'OK', { duration: 4000 });
      return;
    }
    this.storage.upsert(this.g());
    this.router.navigateByUrl('/');
  }
  async del() {
    if (await confirmDialog(this.dialog, { title: 'Delete game?', message: 'This game will be removed from your stats.', action: 'Delete' })) {
      this.storage.remove(this.g().id);
      this.router.navigateByUrl('/games');
    }
  }
}
