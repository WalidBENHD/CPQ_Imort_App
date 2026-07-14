import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { ComparisonMissingItem } from '../../core/models/import.models';

export interface AnnualCommitConfirmDialogData {
  datasetLabel: string;
  originalFileName: string;
  hasBaseline: boolean;
  newRows: number;
  modifiedRows: number;
  unchangedRows: number;
  missingRows: ComparisonMissingItem[];
}

@Component({
  selector: 'app-annual-commit-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatDividerModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon>warning_amber</mat-icon>
      <span>Approve annual update?</span>
    </h2>

    <div mat-dialog-content class="dialog-content">
    <p class="lead">
        Please review the impact before applying the commit for <strong>{{ data.datasetLabel }}</strong>.
      </p>

      <p class="file-name">
        File: <strong>{{ data.originalFileName }}</strong>
      </p>

      <p class="summary-copy">
        New rows will be added, modified rows will be updated, and missing rows from the previous approved baseline
        for this same scope will be deleted.
      </p>

      <div class="impact-grid">
        <section class="impact-card impact-card--new">
          <div class="impact-label">New</div>
          <div class="impact-value">{{ data.newRows }}</div>
          <div class="impact-note">Rows will be added to CPQ.</div>
        </section>

        <section class="impact-card impact-card--modified">
          <div class="impact-label">Modified</div>
          <div class="impact-value">{{ data.modifiedRows }}</div>
          <div class="impact-note">Rows will be updated in CPQ.</div>
        </section>

        <section class="impact-card impact-card--missing">
          <div class="impact-label">Missing</div>
          <div class="impact-value">{{ data.missingRows.length }}</div>
          <div class="impact-note">Rows will be removed from the previous scoped baseline.</div>
        </section>
      </div>

      <div class="info-box">
        <mat-icon>info</mat-icon>
        <div>
          <strong>Shared CPQ articles used by other scopes are preserved.</strong>
          <div>
            Only rows missing from the previous committed baseline for this upload are deleted.
          </div>
        </div>
      </div>

      <div class="preview-panel" *ngIf="data.missingRows.length > 0; else noMissingRows">
        <div class="section-title">Rows marked for removal</div>
        <div class="missing-scroll">
          <div class="missing-grid">
            <span class="missing-chip" *ngFor="let row of data.missingRows">
              {{ row.key }}
            </span>
          </div>
        </div>
      </div>

      <ng-template #noMissingRows>
        <div class="empty-state">
          <mat-icon>check_circle</mat-icon>
          <div>No missing rows were detected against the previous approved baseline.</div>
        </div>
      </ng-template>
    </div>

    <div mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [mat-dialog-close]="true">
        Confirm approval
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 22px;
      font-weight: 800;
    }
    .dialog-title mat-icon { color: #ef6c00; }
    .dialog-content {
      display: grid;
      gap: 16px;
      min-width: min(760px, 90vw);
      max-width: 92vw;
      max-height: 68vh;
      overflow: auto;
      padding-top: 4px;
    }
    .lead {
      margin: 0;
      font-size: 15px;
      color: #334155;
      line-height: 1.55;
    }
    .file-name {
      margin: -4px 0 0;
      font-size: 13px;
      color: #64748b;
    }
    .summary-copy {
      margin: 0;
      font-size: 14px;
      color: #475569;
      line-height: 1.55;
    }
    .impact-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .impact-card {
      border-radius: 16px;
      border: 1px solid #d7dde7;
      background: #fff;
      padding: 14px;
      box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
    }
    .impact-card--new { border-top: 3px solid #16a34a; }
    .impact-card--modified { border-top: 3px solid #2563eb; }
    .impact-card--missing { border-top: 3px solid #f97316; }
    .impact-label {
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.06em;
      font-weight: 800;
      color: #64748b;
      margin-bottom: 8px;
    }
    .impact-value {
      font-size: 30px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }
    .impact-note {
      margin-top: 8px;
      font-size: 13px;
      line-height: 1.45;
      color: #475569;
    }
    .info-box {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      border-radius: 14px;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #1e3a8a;
      padding: 14px;
    }
    .info-box mat-icon { margin-top: 1px; }
    .info-box strong { display: block; margin-bottom: 4px; }
    .preview-panel {
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }
    .section-title {
      margin-bottom: 10px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #475569;
    }
    .missing-scroll {
      max-height: 260px;
      overflow: auto;
      padding-right: 4px;
    }
    .missing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
    }
    .missing-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      border-radius: 999px;
      border: 1px solid #fdba74;
      background: #fff7ed;
      color: #9a3412;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      word-break: break-word;
      text-align: center;
    }
    .empty-state {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      border-radius: 14px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      color: #334155;
    }
    .empty-state mat-icon { color: #16a34a; }
    .dialog-actions {
      padding: 14px 24px 18px;
      position: sticky;
      bottom: 0;
      background: linear-gradient(to top, rgba(255,255,255,0.98), rgba(255,255,255,0.94));
      margin: 0;
    }
    @media (max-width: 700px) {
      .dialog-content { min-width: 0; max-height: 72vh; }
      .impact-grid { grid-template-columns: 1fr; }
      .missing-grid { grid-template-columns: 1fr; }
      .dialog-actions { padding-inline: 16px; }
    }
  `]
})
export class AnnualCommitConfirmDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AnnualCommitConfirmDialogData,
    private readonly dialogRef: MatDialogRef<AnnualCommitConfirmDialogComponent, boolean>
  ) {}
}
