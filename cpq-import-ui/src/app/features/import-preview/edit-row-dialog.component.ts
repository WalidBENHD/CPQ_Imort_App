import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface EditRowDialogData {
  rowNumber: number;
  fields: Record<string, string | null>;
  errorFields: string[];
}

@Component({
  selector: 'app-edit-row-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Correct row #{{ data.rowNumber }}</h2>

    <mat-dialog-content>
      <p class="dialog-copy">Update the highlighted fields and save to revalidate the same submission.</p>

      <form class="edit-form" [formGroup]="form">
        <mat-form-field appearance="outline" *ngFor="let field of fieldNames">
          <mat-label>{{ field }}</mat-label>
          <input matInput [formControlName]="field" [class.error-field]="data.errorFields.includes(field)" />
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()">Save changes</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-copy { margin: 0 0 12px; color: #64748b; }
    .edit-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; min-width: min(760px, 90vw); }
    .edit-form mat-form-field { width: 100%; }
    .error-field { background: #fffaf0; }
    @media (max-width: 720px) {
      .edit-form { grid-template-columns: 1fr; min-width: 0; }
    }
  `]
})
export class EditRowDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<EditRowDialogComponent>);

  fieldNames: string[] = [];
  readonly form = this.fb.group({});

  constructor(@Inject(MAT_DIALOG_DATA) public data: EditRowDialogData) {}

  ngOnInit(): void {
    this.fieldNames = Object.keys(this.data.fields);
    for (const field of this.fieldNames) {
      this.form.addControl(field, this.fb.nonNullable.control(this.data.fields[field] ?? ''));
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }

    const nextFields: Record<string, string | null> = {};
    for (const field of this.fieldNames) {
      const raw = this.form.get(field)?.value ?? '';
      const value = typeof raw === 'string' ? raw.trim() : String(raw).trim();
      nextFields[field] = value === '' ? null : value;
    }

    this.dialogRef.close(nextFields);
  }
}
