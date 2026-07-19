import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatasetColumnRequirement, StagingRow } from '../../core/models/import.models';

export type DraftEditorMode = 'add' | 'edit' | 'duplicate';

@Component({
  selector: 'app-draft-row-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTooltipModule],
  template: `
    <div class="editor-backdrop" (click)="requestCancel()"></div>
    <aside class="editor-panel" role="dialog" aria-modal="true" [attr.aria-label]="title">
      <header class="editor-header">
        <div class="editor-heading">
          <span class="editor-icon"><mat-icon>{{ mode === 'add' ? 'add' : mode === 'duplicate' ? 'content_copy' : 'edit' }}</mat-icon></span>
          <div>
            <div class="eyebrow">Private draft editor</div>
            <h2>{{ title }}</h2>
            <p>{{ subtitle }}</p>
          </div>
        </div>
        <button mat-icon-button type="button" [disabled]="saving" (click)="requestCancel()" aria-label="Close editor"><mat-icon>close</mat-icon></button>
      </header>

      <div class="editor-context">
        <mat-icon>shield</mat-icon>
        <div><strong>Safe to refine</strong><span>Changes stay in your private workspace until you submit this version.</span></div>
      </div>

      <form class="editor-form" [formGroup]="form" (ngSubmit)="save()">
        <section class="field-section">
          <div class="section-heading">
            <div><span>Row values</span><small>{{ fieldNames.length }} fields in this dataset</small></div>
            <span class="required-key"><i></i> Required</span>
          </div>

          <div class="field-grid">
            <mat-form-field
              appearance="outline"
              subscriptSizing="dynamic"
              *ngFor="let field of fieldNames"
              [class.field--required]="requirement(field)?.required"
              [class.field--error]="hasError(field)">
              <mat-label>{{ field }}{{ requirement(field)?.required ? ' *' : '' }}</mat-label>
              <input matInput [formControlName]="field" [placeholder]="requirement(field)?.example || ''" />
              <mat-icon matSuffix *ngIf="hasError(field)" class="field-error-icon" [matTooltip]="errorMessage(field)">error_outline</mat-icon>
              <mat-hint *ngIf="requirement(field)?.description">{{ requirement(field)?.description }}</mat-hint>
            </mat-form-field>
          </div>
        </section>

        <footer class="editor-actions">
          <div class="save-copy"><mat-icon>autorenew</mat-icon><span>The row will be revalidated after saving.</span></div>
          <div>
            <button mat-button type="button" [disabled]="saving" (click)="requestCancel()">Cancel</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="saving">
              <mat-icon>{{ saving ? 'hourglass_top' : mode === 'add' ? 'add' : 'check' }}</mat-icon>
              {{ saving ? 'Saving...' : mode === 'add' ? 'Add to draft' : mode === 'duplicate' ? 'Create copy' : 'Apply changes' }}
            </button>
          </div>
        </footer>
      </form>
    </aside>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 1200; }
    .editor-backdrop { position: absolute; inset: 0; background: rgba(15,23,42,.48); backdrop-filter: blur(3px); }
    .editor-panel { position: absolute; inset: 0 0 0 auto; display: flex; flex-direction: column; width: min(760px, 94vw); color: var(--app-text); background: var(--app-surface-elevated); border-left: 1px solid var(--app-border); box-shadow: -28px 0 70px rgba(15,23,42,.22); animation: enter .22s ease-out; }
    @keyframes enter { from { transform: translateX(32px); opacity: .7; } }
    .editor-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 25px 28px 20px; border-bottom: 1px solid var(--app-border); }
    .editor-heading { display: flex; align-items: flex-start; gap: 15px; }
    .editor-icon { display: grid; flex: none; place-items: center; width: 46px; height: 46px; border-radius: 15px; color: #1d4ed8; background: color-mix(in srgb, #3b82f6 14%, transparent); }
    .editor-icon mat-icon { width: 26px; height: 26px; font-size: 26px; }
    .eyebrow { margin-bottom: 5px; color: var(--app-accent); font-size: 11px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    h2 { margin: 0; font-size: 24px; line-height: 1.15; }
    .editor-header p { margin: 7px 0 0; color: var(--app-text-muted); font-size: 14px; line-height: 1.45; }
    .editor-context { display: flex; align-items: center; gap: 11px; margin: 18px 28px 0; padding: 12px 14px; border: 1px solid color-mix(in srgb, #14b8a6 28%, var(--app-border)); border-radius: 14px; color: #0f766e; background: color-mix(in srgb, #14b8a6 9%, var(--app-surface)); }
    .editor-context mat-icon { flex: none; }
    .editor-context div { display: flex; flex-direction: column; gap: 2px; }
    .editor-context span { color: var(--app-text-muted); font-size: 12px; }
    .editor-form { display: flex; flex: 1; min-height: 0; flex-direction: column; }
    .field-section { flex: 1; min-height: 0; overflow: auto; padding: 22px 28px 30px; }
    .section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .section-heading > div { display: flex; flex-direction: column; gap: 3px; }
    .section-heading span { font-size: 15px; font-weight: 900; }
    .section-heading small { color: var(--app-text-muted); font-size: 12px; }
    .required-key { display: inline-flex; align-items: center; gap: 6px; color: var(--app-text-muted); font-size: 11px !important; }
    .required-key i { width: 7px; height: 7px; border-radius: 50%; background: #2563eb; }
    .field-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 17px 14px; }
    mat-form-field { width: 100%; }
    .field--required { --mdc-outlined-text-field-outline-color: color-mix(in srgb, #2563eb 32%, var(--app-border)); }
    .field--error { --mdc-outlined-text-field-outline-color: #ef4444; --mdc-outlined-text-field-label-text-color: #dc2626; }
    .field-error-icon { color: #dc2626; }
    :host ::ng-deep .mat-mdc-form-field { --mdc-outlined-text-field-input-text-color: var(--app-text); --mdc-outlined-text-field-label-text-color: var(--app-text-muted); --mdc-outlined-text-field-hover-label-text-color: var(--app-text); --mdc-outlined-text-field-focus-label-text-color: var(--app-accent); --mdc-outlined-text-field-caret-color: var(--app-accent); }
    :host ::ng-deep .mat-mdc-text-field-wrapper { background: var(--app-surface); border-radius: 12px; }
    :host ::ng-deep .mat-mdc-form-field-hint { color: var(--app-text-muted); }
    .editor-actions { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 28px; border-top: 1px solid var(--app-border); background: color-mix(in srgb, var(--app-surface) 78%, transparent); }
    .editor-actions > div { display: flex; align-items: center; gap: 8px; }
    .editor-actions button { min-height: 42px; border-radius: 12px; font-weight: 800; }
    .save-copy { color: var(--app-text-muted); font-size: 12px; }
    .save-copy mat-icon { width: 18px; height: 18px; color: #0f766e; font-size: 18px; }
    :host-context(html.theme-dark) .editor-context { color: #5eead4; }
    :host-context(html.theme-dark) .editor-icon { color: #93c5fd; }
    @media (max-width: 680px) {
      .editor-panel { inset: 0; width: auto; max-width: none; }
      .editor-header { padding: 18px 17px 15px; }
      .editor-icon { width: 40px; height: 40px; }
      h2 { font-size: 20px; }
      .editor-context { margin: 12px 16px 0; }
      .field-section { padding: 18px 16px 24px; }
      .field-grid { grid-template-columns: 1fr; }
      .editor-actions { align-items: stretch; flex-direction: column; padding: 12px 16px; }
      .editor-actions > div:last-child { display: grid; grid-template-columns: 1fr 1.5fr; }
      .save-copy { display: none !important; }
    }
  `]
})
export class DraftRowEditorComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) mode: DraftEditorMode = 'edit';
  @Input() row: StagingRow | null = null;
  @Input() columns: DatasetColumnRequirement[] = [];
  @Input() fallbackFields: string[] = [];
  @Input() saving = false;
  @Output() readonly saved = new EventEmitter<Record<string, string | null>>();
  @Output() readonly cancel = new EventEmitter<void>();

  fieldNames: string[] = [];
  readonly form = this.fb.group({});

  get title(): string {
    if (this.mode === 'add') return 'Add a new row';
    if (this.mode === 'duplicate') return `Duplicate row #${this.row?.rowNumber ?? ''}`;
    return `Edit row #${this.row?.rowNumber ?? ''}`;
  }

  get subtitle(): string {
    if (this.mode === 'add') return 'Create a record directly in this working draft.';
    if (this.mode === 'duplicate') return 'Start from these values, then adjust the identifying fields.';
    return 'Review every field, not only the ones currently in error.';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['row'] && !changes['columns'] && !changes['mode']) return;
    this.fieldNames = this.columns.length
      ? this.columns.map(column => column.name)
      : this.row ? Object.keys(this.row.fields) : this.fallbackFields;

    for (const key of Object.keys(this.form.controls)) this.form.removeControl(key);
    for (const field of this.fieldNames) {
      this.form.addControl(field, this.fb.nonNullable.control(this.mode === 'add' ? '' : this.row?.fields[field] ?? ''));
    }
  }

  requirement(field: string): DatasetColumnRequirement | undefined {
    return this.columns.find(column => column.name.toLowerCase() === field.toLowerCase());
  }

  hasError(field: string): boolean {
    return this.row?.validationMessages.some(message => message.field.toLowerCase() === field.toLowerCase() && message.severity === 'Error') ?? false;
  }

  errorMessage(field: string): string {
    return this.row?.validationMessages.find(message => message.field.toLowerCase() === field.toLowerCase() && message.severity === 'Error')?.message ?? '';
  }

  save(): void {
    if (this.saving) return;
    const fields: Record<string, string | null> = {};
    for (const field of this.fieldNames) {
      const value = String(this.form.get(field)?.value ?? '').trim();
      fields[field] = value || null;
    }
    this.saved.emit(fields);
  }

  requestCancel(): void {
    if (!this.saving) this.cancel.emit();
  }
}
