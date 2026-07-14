import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
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
    <div class="shell">
      <header class="hero">
        <div class="hero__icon">
          <mat-icon>warning_amber</mat-icon>
        </div>
        <div class="hero__copy">
          <h2>Approve annual update?</h2>
          <p>
            Review the impact before committing <strong>{{ data.datasetLabel }}</strong>.
          </p>
          <div class="hero__meta">
            <span class="meta-pill">File: {{ data.originalFileName }}</span>
            <span class="meta-pill meta-pill--ghost" *ngIf="data.hasBaseline; else firstBaseline">
              Compared with previous approved baseline
            </span>
          </div>
        </div>
      </header>

      <ng-template #firstBaseline>
        <span class="meta-pill meta-pill--ghost">First approved baseline</span>
      </ng-template>

      <div class="body">
        <section class="overview">
          <p class="summary">
            New rows will be added, modified rows will be updated, and rows missing from the previous approved
            baseline for this same scope will be deleted.
          </p>

          <div class="impact-grid">
            <article class="impact-card impact-card--new">
              <div class="impact-label">New</div>
              <div class="impact-value">{{ data.newRows }}</div>
              <div class="impact-note">Rows will be added to CPQ.</div>
            </article>

            <article class="impact-card impact-card--modified">
              <div class="impact-label">Modified</div>
              <div class="impact-value">{{ data.modifiedRows }}</div>
              <div class="impact-note">Rows will be updated in CPQ.</div>
            </article>

            <article class="impact-card impact-card--missing">
              <div class="impact-label">Missing</div>
              <div class="impact-value">{{ data.missingRows.length }}</div>
              <div class="impact-note">Rows will be removed from the previous scoped baseline.</div>
            </article>
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
        </section>

        <section class="removals">
          <div class="removals__head">
            <div>
              <div class="section-kicker">Rows marked for removal</div>
              <h3>Scoped deletions</h3>
            </div>
            <div class="removal-count">{{ data.missingRows.length }}</div>
          </div>

          <div class="removals__scroll" *ngIf="data.missingRows.length > 0; else noMissingRows">
            <div class="removal-row" *ngFor="let row of data.missingRows; let i = index">
              <div class="removal-row__index">{{ i + 1 }}</div>
              <div class="removal-row__key">{{ row.key }}</div>
            </div>
          </div>

          <ng-template #noMissingRows>
            <div class="empty-state">
              <mat-icon>check_circle</mat-icon>
              <div>No missing rows were detected against the previous approved baseline.</div>
            </div>
          </ng-template>
        </section>
      </div>

      <mat-divider></mat-divider>

      <footer class="actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" [mat-dialog-close]="true">
          Confirm approval
        </button>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    :host ::ng-deep .annual-commit-dialog-panel .mat-mdc-dialog-container {
      padding: 0;
    }

    :host ::ng-deep .annual-commit-dialog-panel .mat-mdc-dialog-surface {
      border-radius: 24px;
      overflow: hidden;
      background: transparent;
    }

    .shell {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding: 24px 24px 18px;
      box-sizing: border-box;
      min-width: min(940px, 94vw);
      max-width: 94vw;
      max-height: 88vh;
      overflow: hidden;
      background:
        radial-gradient(circle at top left, rgba(255, 183, 77, 0.08), transparent 28%),
        linear-gradient(180deg, #ffffff 0%, #fcfdff 100%);
    }

    .hero {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 16px;
      align-items: start;
    }

    .hero__icon {
      width: 48px;
      height: 48px;
      border-radius: 16px;
      background: #fff7ed;
      color: #ea580c;
      display: grid;
      place-items: center;
      box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.15);
    }

    .hero__icon mat-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
    }

    .hero__copy h2 {
      margin: 0;
      font-size: 24px;
      line-height: 1.15;
      font-weight: 800;
      color: #111827;
    }

    .hero__copy p {
      margin: 6px 0 0;
      color: #475569;
      line-height: 1.5;
      font-size: 14px;
    }

    .hero__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .meta-pill {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      border-radius: 999px;
      padding: 0 12px;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      background: #f8fafc;
      border: 1px solid #dbe4f0;
    }

    .meta-pill--ghost {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1e3a8a;
    }

    .body {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
      gap: 16px;
      min-height: 0;
    }

    .overview,
    .removals {
      min-width: 0;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }

    .overview {
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .summary {
      margin: 0;
      color: #334155;
      line-height: 1.6;
      font-size: 14px;
    }

    .impact-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .impact-card {
      border-radius: 18px;
      border: 1px solid #d7dde7;
      background: linear-gradient(180deg, #ffffff 0%, #fafcff 100%);
      padding: 16px;
      min-height: 132px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .impact-card--new { border-top: 3px solid #16a34a; }
    .impact-card--modified { border-top: 3px solid #2563eb; }
    .impact-card--missing { border-top: 3px solid #f97316; }

    .impact-label {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
    }

    .impact-value {
      font-size: 34px;
      line-height: 1;
      font-weight: 800;
      color: #0f172a;
      margin-top: 10px;
    }

    .impact-note {
      margin-top: 10px;
      color: #475569;
      font-size: 13px;
      line-height: 1.45;
    }

    .info-box {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      border-radius: 16px;
      border: 1px solid #bfdbfe;
      background: linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%);
      color: #1e3a8a;
      padding: 16px;
    }

    .info-box mat-icon {
      margin-top: 1px;
      flex: 0 0 auto;
    }

    .info-box strong {
      display: block;
      margin-bottom: 4px;
    }

    .removals {
      display: flex;
      flex-direction: column;
      padding: 18px;
      gap: 14px;
      min-height: 0;
    }

    .removals__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .section-kicker {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
    }

    .removals__head h3 {
      margin: 4px 0 0;
      font-size: 18px;
      line-height: 1.2;
      color: #0f172a;
    }

    .removal-count {
      min-width: 44px;
      height: 32px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 12px;
      background: #fff7ed;
      color: #9a3412;
      border: 1px solid #fdba74;
      font-size: 13px;
      font-weight: 800;
      flex: 0 0 auto;
    }

    .removals__scroll {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      padding-right: 4px;
      display: grid;
      gap: 10px;
      align-content: start;
      max-height: min(48vh, 430px);
    }

    .removal-row {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid #fed7aa;
      background: linear-gradient(180deg, #fffaf4 0%, #fff7ed 100%);
    }

    .removal-row__index {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #ffffff;
      border: 1px solid #fcd9b2;
      color: #9a3412;
      font-size: 12px;
      font-weight: 800;
    }

    .removal-row__key {
      color: #7c2d12;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.35;
      word-break: break-word;
    }

    .empty-state {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 120px;
      border-radius: 16px;
      border: 1px dashed #cbd5e1;
      background: #f8fafc;
      color: #334155;
      padding: 16px;
    }

    .empty-state mat-icon {
      color: #16a34a;
      flex: 0 0 auto;
    }

    .actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 2px;
    }

    @media (max-width: 900px) {
      .shell {
        min-width: 0;
        max-width: 96vw;
        padding: 18px;
        max-height: 92vh;
      }

      .body {
        grid-template-columns: 1fr;
      }

      .impact-grid {
        grid-template-columns: 1fr;
      }

      .removals__scroll {
        max-height: 34vh;
      }
    }

    @media (max-width: 600px) {
      .shell {
        padding: 14px;
      }

      .hero {
        grid-template-columns: 1fr;
      }

      .hero__icon {
        width: 44px;
        height: 44px;
      }

      .hero__copy h2 {
        font-size: 20px;
      }

      .overview,
      .removals {
        padding: 14px;
      }

      .actions {
        flex-direction: column-reverse;
        align-items: stretch;
      }

      .actions button {
        width: 100%;
      }
    }
  `]
})
export class AnnualCommitConfirmDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AnnualCommitConfirmDialogData,
    private readonly dialogRef: MatDialogRef<AnnualCommitConfirmDialogComponent, boolean>
  ) {}
}
