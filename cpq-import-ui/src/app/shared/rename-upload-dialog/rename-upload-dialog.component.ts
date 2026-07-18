import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export interface RenameUploadDialogData {
  fileName: string;
}

@Component({
  selector: 'app-rename-upload-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <section class="rename-dialog">
      <header>
        <span class="dialog-mark"><mat-icon>drive_file_rename_outline</mat-icon></span>
        <div>
          <span class="eyebrow">Private workspace</span>
          <h2 mat-dialog-title>Rename upload</h2>
          <p>Choose a clear name for this upload.</p>
        </div>
      </header>

      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label>Upload name</mat-label>
          <input
            matInput
            [(ngModel)]="name"
            [maxlength]="maxNameLength"
            (keydown.enter)="confirm()"
            cdkFocusInitial
            autocomplete="off">
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" [disabled]="!name.trim()" (click)="confirm()">
          <mat-icon>check</mat-icon>
          Save name
        </button>
      </mat-dialog-actions>
    </section>
  `,
  styles: [`
    :host { display: block; width: 100%; min-width: 0; color: var(--app-text); }
    .rename-dialog { width: 100%; min-width: 0; overflow: hidden; background: var(--app-surface-elevated); }
    header { display: grid; grid-template-columns: 50px minmax(0, 1fr); gap: 14px; padding: 24px 24px 18px; border-bottom: 1px solid var(--app-border); background: linear-gradient(120deg, color-mix(in srgb, var(--app-accent) 9%, transparent), transparent 72%); }
    .dialog-mark { display: grid; place-items: center; width: 50px; height: 50px; border-radius: 15px; color: white; background: var(--app-accent); box-shadow: 0 10px 25px color-mix(in srgb, var(--app-accent) 28%, transparent); }
    .dialog-mark mat-icon { width: 25px; height: 25px; font-size: 25px; }
    .eyebrow { color: var(--app-accent); font-size: 11px; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
    h2[mat-dialog-title] { margin: 3px 0 4px; padding: 0; color: var(--app-text); font-size: 23px; line-height: 1.2; }
    header p { margin: 0; color: var(--app-text-muted); font-size: 13px; line-height: 1.45; }
    mat-dialog-content { padding: 22px 24px 10px; }
    mat-form-field { width: 100%; }
    mat-dialog-actions { gap: 8px; padding: 8px 24px 22px; }
    mat-dialog-actions button { min-height: 42px; border-radius: 12px; font-weight: 800; }
    @media (max-width: 520px) {
      header { grid-template-columns: 38px minmax(0, 1fr); gap: 11px; padding: 18px 14px 14px; }
      .dialog-mark { width: 38px; height: 38px; border-radius: 12px; }
      h2[mat-dialog-title] { font-size: 19px; }
      mat-dialog-content { padding: 18px 14px 6px; }
      mat-dialog-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px 14px 14px; }
      mat-dialog-actions button { width: 100%; margin: 0; padding-inline: 10px; }
    }
  `]
})
export class RenameUploadDialogComponent {
  readonly maxNameLength: number;
  name: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) data: RenameUploadDialogData,
    readonly dialogRef: MatDialogRef<RenameUploadDialogComponent, string>
  ) {
    this.name = data.fileName;
    this.maxNameLength = 175;
  }

  confirm(): void {
    const name = this.name.trim();
    if (name) this.dialogRef.close(name);
  }
}
