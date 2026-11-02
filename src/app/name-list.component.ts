import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';

/** A card listing names with their game counts, a Delete button per row and an "add" field. Used for both teams and competitions. */
@Component({
  selector: 'app-name-list',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatListModule],
  styles: `
    mat-card-content {
      padding-bottom: 16px;
    }
    mat-card-content > * + * {
      margin-top: 12px;
    }
    [matListItemMeta] {
      font: var(--mat-sys-label-large);
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
    <mat-card appearance="outlined">
      <mat-card-header
        ><mat-card-title>{{ title() }}</mat-card-title></mat-card-header
      >
      <mat-card-content>
        <mat-list>
          @for (n of names(); track n) {
            <mat-list-item>
              <span matListItemTitle>{{ n }}</span>
              <span matListItemLine class="muted">{{ counts()[n] ?? 0 }} game{{ (counts()[n] ?? 0) === 1 ? '' : 's' }}</span>
              <span matListItemMeta><button mat-stroked-button class="danger" [disabled]="names().length < 2" [attr.aria-label]="'Delete ' + n" (click)="removed.emit(n)">Delete</button></span>
            </mat-list-item>
          }
        </mat-list>
        <div class="add">
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>Add {{ noun() }}</mat-label>
            <input matInput [(ngModel)]="draft" [placeholder]="placeholder()" (keyup.enter)="add()" />
          </mat-form-field>
          <button mat-stroked-button (click)="add()" [disabled]="!draft.trim()">Add</button>
        </div>
      </mat-card-content>
    </mat-card>
  `,
})
export class NameListComponent {
  title = input.required<string>();
  /** singular, lower case: "team", "competition" */
  noun = input.required<string>();
  placeholder = input('');
  names = input.required<string[]>();
  counts = input.required<Record<string, number>>();
  added = output<string>();
  removed = output<string>();
  draft = '';

  add() {
    const name = this.draft.trim();
    if (name) this.added.emit(name);
    this.draft = '';
  }
}
