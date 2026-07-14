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
          <div class="summary-banner">
            <div class="summary-banner__label">Commit impact</div>
            <div class="summary-banner__text">
              New rows will be <strong>added</strong>, modified rows will be <strong>updated</strong>, and rows
              missing from the previous approved baseline for this same scope will be <strong>deleted</strong>.
            </div>
          </div>

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
      --ac-shell-bg: radial-gradient(circle at top left, rgba(255, 183, 77, 0.08), transparent 28%),
        linear-gradient(180deg, #ffffff 0%, #fcfdff 100%);
      --ac-surface: #ffffff;
      --ac-surface-soft: #f8fafc;
      --ac-surface-alt: #fafcff;
      --ac-border: #e2e8f0;
      --ac-border-strong: #d7dde7;
      --ac-text: #0f172a;
      --ac-muted: #475569;
      --ac-muted-strong: #334155;
      --ac-info-bg: #eff6ff;
      --ac-info-border: #bfdbfe;
      --ac-info-text: #1e3a8a;
      --ac-warning-bg: #fff7ed;
      --ac-warning-border: #fdba74;
      --ac-warning-text: #9a3412;
      --ac-warning-strong: #ea580c;
      --ac-warning-soft: rgba(249, 115, 22, 0.15);
      --ac-impact-strong: #dc2626;
      --ac-impact-bg: linear-gradient(180deg, rgba(220, 38, 38, 0.08) 0%, var(--ac-surface-alt) 100%);
    }

    :host-context(html.theme-dark) {
      --ac-shell-bg: radial-gradient(circle at top left, rgba(126, 162, 255, 0.12), transparent 28%),
        radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.08), transparent 24%),
        linear-gradient(180deg, rgba(15, 23, 42, 0.99) 0%, rgba(8, 13, 28, 0.99) 100%);
      --ac-surface: rgba(15, 23, 42, 0.97);
      --ac-surface-soft: rgba(17, 28, 53, 0.92);
      --ac-surface-alt: rgba(11, 18, 36, 0.96);
      --ac-border: var(--app-border);
      --ac-border-strong: rgba(126, 162, 255, 0.18);
      --ac-text: var(--app-text);
      --ac-muted: var(--app-text-muted);
      --ac-muted-strong: #cbd5e1;
      --ac-info-bg: linear-gradient(180deg, rgba(17, 28, 53, 0.96) 0%, rgba(10, 16, 33, 0.98) 100%);
      --ac-info-border: rgba(126, 162, 255, 0.22);
      --ac-info-text: #dbeafe;
      --ac-warning-bg: rgba(249, 115, 22, 0.1);
      --ac-warning-border: rgba(251, 146, 60, 0.22);
      --ac-warning-text: #fdba74;
      --ac-warning-strong: #fb923c;
      --ac-warning-soft: rgba(251, 146, 60, 0.1);
      --ac-impact-strong: #fca5a5;
      --ac-impact-bg: linear-gradient(180deg, rgba(69, 10, 10, 0.96) 0%, rgba(17, 28, 53, 0.98) 100%);
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
      background: var(--ac-shell-bg);
      color: var(--ac-text);
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
      background: var(--ac-warning-bg);
      color: var(--ac-warning-strong);
      display: grid;
      place-items: center;
      box-shadow: inset 0 0 0 1px var(--ac-warning-soft);
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
      color: var(--ac-text);
    }

    .hero__copy p {
      margin: 6px 0 0;
      color: var(--ac-muted);
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
      color: var(--ac-muted-strong);
      background: var(--ac-surface-soft);
      border: 1px solid var(--ac-border);
    }

    .meta-pill--ghost {
      background: var(--ac-info-bg);
      border-color: var(--ac-info-border);
      color: var(--ac-info-text);
    }

    .body {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
      gap: 16px;
      min-height: 0;
      flex: 1 1 auto;
    }

    .overview,
    .removals {
      min-width: 0;
      border-radius: 20px;
      border: 1px solid var(--ac-border);
      background: var(--ac-surface);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }

    .overview {
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .summary-banner {
      border-radius: 18px;
      border: 1px solid color-mix(in srgb, var(--ac-impact-strong) 28%, var(--ac-border));
      border-left: 6px solid var(--ac-impact-strong);
      background: var(--ac-impact-bg);
      padding: 16px 18px;
      display: grid;
      gap: 8px;
    }

    .summary-banner__label {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
      font-weight: 900;
      color: var(--ac-impact-strong);
    }

    .summary-banner__text {
      font-size: 16px;
      line-height: 1.55;
      font-weight: 600;
      color: var(--ac-text);
    }

    .summary-banner__text strong {
      font-weight: 900;
      color: var(--ac-impact-strong);
    }

    .impact-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .impact-card {
      border-radius: 18px;
      border: 1px solid var(--ac-border-strong);
      background: linear-gradient(180deg, var(--ac-surface) 0%, var(--ac-surface-alt) 100%);
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
      color: var(--ac-muted);
    }

    .impact-value {
      font-size: 34px;
      line-height: 1;
      font-weight: 800;
      color: var(--ac-text);
      margin-top: 10px;
    }

    .impact-note {
      margin-top: 10px;
      color: var(--ac-muted);
      font-size: 13px;
      line-height: 1.45;
    }

    .info-box {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      border-radius: 16px;
      border: 1px solid var(--ac-info-border);
      background: var(--ac-info-bg);
      color: var(--ac-info-text);
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
      color: var(--ac-muted);
    }

    .removals__head h3 {
      margin: 4px 0 0;
      font-size: 18px;
      line-height: 1.2;
      color: var(--ac-text);
    }

    .removal-count {
      min-width: 44px;
      height: 32px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 12px;
      background: var(--ac-warning-bg);
      color: var(--ac-warning-text);
      border: 1px solid var(--ac-warning-border);
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
      border: 1px solid var(--ac-warning-border);
      background: linear-gradient(180deg, var(--ac-surface-soft) 0%, var(--ac-surface-alt) 100%);
    }

    .removal-row__index {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: rgba(126, 162, 255, 0.12);
      border: 1px solid var(--ac-warning-border);
      color: var(--ac-warning-text);
      font-size: 12px;
      font-weight: 800;
    }

    .removal-row__key {
      color: var(--ac-muted-strong);
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
      border: 1px dashed var(--ac-border);
      background: var(--ac-surface-soft);
      color: var(--ac-muted-strong);
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
      flex: 0 0 auto;
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
        width: calc(100vw - 10px);
        max-width: calc(100vw - 10px);
        padding: 12px 10px 10px;
        gap: 12px;
        height: calc(100dvh - 10px);
        max-height: calc(100dvh - 10px);
      }

      .hero {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .hero__icon {
        width: 44px;
        height: 44px;
      }

      .hero__copy h2 {
        font-size: 20px;
      }

      .hero__copy p {
        font-size: 13px;
      }

      .hero__meta {
        flex-direction: column;
        align-items: flex-start;
        margin-top: 10px;
        gap: 6px;
      }

      .meta-pill {
        width: 100%;
        justify-content: center;
        min-height: 28px;
      }

      .overview {
        padding: 12px;
        border-radius: 16px;
      }

      .body {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding-right: 2px;
      }

      .summary-banner {
        padding: 13px 13px 12px;
        border-radius: 16px;
      }

      .impact-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .impact-card {
        min-height: 118px;
        padding: 14px;
      }

      .impact-card--missing {
        grid-column: 1 / -1;
      }

      .impact-value {
        font-size: 28px;
      }

      .info-box {
        padding: 14px;
        gap: 10px;
      }

      .removals {
        display: none;
      }

      .actions {
        flex-direction: column-reverse;
        align-items: stretch;
        gap: 8px;
        padding: 10px 0 0;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0), var(--ac-surface) 38%);
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
