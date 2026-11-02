import { Component, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FilterDef, FiltersService } from './filters.service';

/** Team, season, competition and opponent filters: all standard multi-select dropdowns. Renders as grid children (display: contents) so tabs can append extra controls. */
@Component({
  selector: 'app-filter-bar',
  imports: [MatFormFieldModule, MatSelectModule],
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    @for (f of filters.filters(); track f.label) {
      <mat-form-field subscriptSizing="dynamic" floatLabel="always">
        <mat-label>{{ f.label }}</mat-label>
        <mat-select multiple [placeholder]="f.allLabel" [value]="f.values" (selectionChange)="f.set($event.value)">
          <mat-select-trigger>{{ summary(f) }}</mat-select-trigger>
          @for (o of f.options; track o.value) {
            <mat-option [value]="o.value">{{ o.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    }
  `,
})
export class FilterBarComponent {
  filters = inject(FiltersService);

  /** One line in the closed field: the first choice, plus a count of the rest. */
  summary(f: FilterDef) {
    const [first, ...rest] = f.values;
    return first === undefined ? '' : f.labelOf(first) + (rest.length ? ` (+${rest.length})` : '');
  }
}
