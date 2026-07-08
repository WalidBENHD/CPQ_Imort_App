import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { EvolisDecryptorService } from '../../core/services/evolis-decryptor.service';
import { EvolisDecryptResponse, EvolisPresentation } from '../../core/models/evolis.models';
import { parseEvolisPresentation } from './evolis-parser';

@Component({
  selector: 'app-evolis-decryptor',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <section class="page-shell evolis-decryptor-page">
      <header class="page-header">
        <div>
          <div class="eyebrow">Internal tools</div>
          <h1>Evolis Decryptor</h1>
          <p class="page-intro">
            Upload an Evolis pricing file, decrypt it, and download the generated PDF report.
          </p>
        </div>
      </header>

      <div class="layout-grid layout-grid--summary">
        <mat-card class="panel upload-panel">
          <div
            class="dropzone"
            [class.dropzone--active]="dragActive"
            (dragover)="onDragOver($event)"
            (dragleave)="dragActive = false"
            (drop)="onDrop($event)"
          >
            <mat-icon class="dropzone-icon">lock_open</mat-icon>
            <h2>Drop the encrypted file here</h2>
            <p>Or choose a text file to decrypt and generate the PDF report.</p>

            <input #fileInput type="file" accept=".txt,text/plain" class="file-input" (change)="onFileSelected($event)" />

            <div class="actions">
              <button mat-raised-button color="primary" type="button" (click)="fileInput.click()">
                <mat-icon>upload_file</mat-icon>
                Choose file
              </button>
              <button mat-stroked-button type="button" [disabled]="!selectedFile || processing" (click)="decrypt()">
                <mat-icon>security</mat-icon>
                {{ processing ? 'Decrypting...' : 'Decrypt file' }}
              </button>
              <button mat-button type="button" [disabled]="!selectedFile && !result" (click)="reset()">
                <mat-icon>restart_alt</mat-icon>
                Reset
              </button>
            </div>

            <div class="file-meta" *ngIf="selectedFile">
              <mat-icon>description</mat-icon>
              <div>
                <div class="file-name">{{ selectedFile.name }}</div>
                <div class="file-size">{{ selectedFile.size | number }} bytes</div>
              </div>
            </div>

            <div class="error-box" *ngIf="errorMessage">
              <mat-icon>error</mat-icon>
              <span>{{ errorMessage }}</span>
            </div>
          </div>
        </mat-card>

        <mat-card class="panel result-panel">
          <div class="result-head">
            <div>
              <div class="eyebrow">Result</div>
              <h2>Decrypted output</h2>
            </div>
            <button mat-raised-button color="primary" type="button" [disabled]="!result" (click)="downloadResult()">
              <mat-icon>picture_as_pdf</mat-icon>
              Download PDF
            </button>
          </div>

          <div class="result-state" *ngIf="!result && !processing">
            <mat-icon>info</mat-icon>
            <p>The result summary will appear here after processing.</p>
          </div>

          <div class="result-state result-state--loading" *ngIf="processing">
            <mat-icon>hourglass_top</mat-icon>
            <p>Decrypting the file now.</p>
          </div>

          <div class="result-summary" *ngIf="result">
            <div class="summary-item summary-item--source">
              <div class="summary-item__icon"><mat-icon>description</mat-icon></div>
              <span class="label">Source</span>
              <span class="value">{{ result.sourceFileName }}</span>
            </div>
            <div class="summary-item summary-item--total">
              <div class="summary-item__icon"><mat-icon>paid</mat-icon></div>
              <span class="label">Grand total</span>
              <span class="value">{{ presentation?.grandTotal ?? '0.0000' }}</span>
            </div>
            <div class="summary-item summary-item--output">
              <div class="summary-item__icon"><mat-icon>picture_as_pdf</mat-icon></div>
              <span class="label">Output</span>
              <span class="value">{{ result.downloadFileName }}</span>
            </div>
            <div class="summary-item summary-item--tables">
              <div class="summary-item__icon"><mat-icon>table_chart</mat-icon></div>
              <span class="label">Tables</span>
              <span class="value">{{ presentation?.tables?.length ?? 0 }}</span>
            </div>
          </div>

          <div class="result-overview" *ngIf="presentation && presentation.tables.length > 0">
            <div class="result-overview-head">
              <h3>Table overview</h3>
              <span>{{ presentation.tables.length }} tables</span>
            </div>

            <div class="result-overview-list">
              <div class="overview-item" *ngFor="let table of presentation.tables">
                <div class="overview-item-head">
                  <strong>{{ table.title }}</strong>
                  <span>{{ table.subtotal }}</span>
                </div>
                <div class="overview-item-meta">
                  <span>{{ table.idPanier }}</span>
                  <span>{{ formatTableDate(table.date) }}</span>
                </div>
                <div class="overview-item-stats">
                  <span>{{ table.lineRows.length }} standard</span>
                  <span>{{ table.configuredRows.length }} configured</span>
                </div>
              </div>
            </div>
          </div>

          <div class="result-empty-note" *ngIf="result && presentation && presentation.tables.length === 0">
            No table rows were detected in the uploaded file.
          </div>
        </mat-card>
      </div>

      <mat-card class="panel details-panel">
        <div class="details-head">
          <div>
            <div class="eyebrow">Detailed result</div>
            <h2>All table rows</h2>
            <p>Review the decrypted tables and row-level totals below.</p>
          </div>
          <div class="details-summary" *ngIf="presentation">
            <span>Grand total</span>
            <strong>{{ presentation.grandTotal }}</strong>
          </div>
        </div>

        <div class="result-state" *ngIf="!result && !processing">
          <mat-icon>info</mat-icon>
          <p>The detailed row breakdown will appear here after processing.</p>
        </div>

        <div class="result-state result-state--loading" *ngIf="processing">
          <mat-icon>hourglass_top</mat-icon>
          <p>Decrypting the file now.</p>
        </div>

        <ng-container *ngIf="presentation">
          <div class="table-section" *ngFor="let table of presentation.tables; let i = index">
            <div class="table-section-head">
              <div class="table-section-copy">
                <div class="eyebrow eyebrow--soft">{{ table.title }}</div>
                <h3>{{ table.idPanier }}</h3>
                <p>{{ formatTableDate(table.date) }}</p>
                <div class="table-section-metas">
                  <span>{{ table.lineRows.length }} standard</span>
                  <span>{{ table.configuredRows.length }} configured</span>
                </div>
              </div>
              <div class="table-section-actions">
                <div class="table-summary">
                  <span>Subtotal</span>
                  <strong>{{ table.subtotal }}</strong>
                </div>
                <button
                  mat-stroked-button
                  type="button"
                  class="table-toggle"
                  (click)="toggleTable(i)"
                  [attr.aria-expanded]="isTableExpanded(i)"
                  [attr.aria-controls]="'table-body-' + i">
                  <mat-icon>{{ isTableExpanded(i) ? 'expand_less' : 'expand_more' }}</mat-icon>
                  {{ isTableExpanded(i) ? 'Hide rows' : 'Show rows' }}
                </button>
              </div>
            </div>

            <div class="table-section-body" [class.expanded]="isTableExpanded(i)" [attr.id]="'table-body-' + i">
              <div class="table-section-body-inner">
                <div class="subtable" *ngIf="table.lineRows.length > 0">
                  <div class="subtable-head">
                    <h4>Standard rows</h4>
                    <span>{{ table.lineRows.length }} items</span>
                  </div>
                  <div class="table-scroll">
                    <table class="result-table result-table--standard">
                      <colgroup>
                        <col style="width: 6%" />
                        <col style="width: 58%" />
                        <col style="width: 36%" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>L</th>
                          <th>Generic part number</th>
                          <th>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let row of table.lineRows">
                          <td>{{ row.type }}</td>
                          <td>{{ row.quantity }}</td>
                          <td>{{ row.genericPartNumber }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="subtable" *ngIf="table.configuredRows.length > 0">
                  <div class="subtable-head">
                    <h4>Configured rows</h4>
                    <span>{{ table.configuredRows.length }} items</span>
                  </div>
                  <div class="table-scroll">
                    <table class="result-table result-table--configured">
                      <colgroup>
                        <col style="width: 4%" />
                        <col style="width: 16%" />
                        <col style="width: 8%" />
                        <col style="width: 50%" />
                        <col style="width: 11%" />
                        <col style="width: 11%" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>C</th>
                          <th>Generic part number</th>
                          <th>Quantity</th>
                          <th>Description</th>
                          <th>Unit price</th>
                          <th>Total price</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let row of table.configuredRows">
                          <td>{{ row.type }}</td>
                          <td>{{ row.genericPartNumber }}</td>
                          <td>{{ row.quantity }}</td>
                          <td>{{ row.description }}</td>
                          <td>{{ row.unitPrice }}</td>
                          <td class="total-cell">{{ row.totalPrice }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="table-empty-note" *ngIf="table.lineRows.length === 0 && table.configuredRows.length === 0">
                  No detailed rows were detected for this table.
                </div>
              </div>
            </div>
          </div>
        </ng-container>
      </mat-card>
    </section>
  `,
  styles: [`
    .page-shell {
      display: grid;
      gap: 18px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
    }

    .eyebrow {
      color: var(--app-accent);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    h1, h2 {
      margin: 0;
      color: var(--app-text);
    }

    h1 {
      font-size: 30px;
      font-weight: 800;
    }

    h2 {
      font-size: 22px;
      font-weight: 750;
    }

    .page-intro {
      margin: 10px 0 0;
      color: var(--app-text-muted);
      line-height: 1.6;
      max-width: 820px;
    }

    .layout-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
      gap: 16px;
      align-items: stretch;
    }

    .layout-grid--summary {
      margin-bottom: 16px;
    }

    .panel {
      border: 1px solid var(--app-border);
      border-radius: 22px;
      background: var(--app-surface-elevated);
      box-shadow: 0 18px 40px rgba(2, 6, 23, 0.12);
    }

    .upload-panel,
    .result-panel {
      padding: 16px;
      display: flex;
      flex-direction: column;
    }

    .upload-panel {
      height: 100%;
      overflow: visible;
    }

    .result-panel {
      height: 100%;
    }

    .upload-panel .dropzone,
    .result-panel > .result-head,
    .result-panel > .result-summary,
    .result-panel > .result-empty-note {
      flex: 0 0 auto;
    }

    .upload-panel .dropzone {
      flex: 1 1 auto;
      min-height: 260px;
      justify-content: center;
      align-content: center;
      justify-items: center;
      text-align: center;
    }

    .dropzone {
      display: grid;
      gap: 14px;
      justify-items: start;
      border: 1px dashed rgba(59, 130, 246, 0.32);
      border-radius: 20px;
      padding: 24px;
      background: linear-gradient(180deg, rgba(59, 130, 246, 0.06), rgba(59, 130, 246, 0.02));
    }

    .dropzone--active {
      border-color: var(--app-accent);
      background: linear-gradient(180deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.05));
    }

    .dropzone-icon {
      width: 44px;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      background: rgba(59, 130, 246, 0.12);
      color: var(--app-accent);
    }

    .dropzone h2 {
      font-size: 20px;
    }

    .dropzone p {
      margin: 0;
      color: var(--app-text-muted);
      line-height: 1.55;
      max-width: 460px;
    }

    .file-input {
      display: none;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
    }

    .actions button {
      border-radius: 999px;
      min-height: 42px;
      font-weight: 700;
    }

    .actions mat-icon {
      margin-right: 4px;
    }

    .file-meta {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      width: min(100%, 420px);
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      text-align: left;
    }

    .file-meta mat-icon {
      color: var(--app-accent);
    }

    .file-name {
      font-weight: 700;
      color: var(--app-text);
      word-break: break-word;
    }

    .file-size {
      color: var(--app-text-muted);
      font-size: 12px;
    }

    .error-box {
      display: flex;
      gap: 10px;
      align-items: center;
      width: min(100%, 420px);
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.22);
      color: #b91c1c;
      font-weight: 600;
      text-align: left;
    }

    .result-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 16px;
    }

    .result-head button {
      border-radius: 999px;
      min-height: 42px;
    }

    .result-state {
      display: grid;
      place-items: center;
      gap: 12px;
      min-height: 160px;
      text-align: center;
      border: 1px dashed var(--app-border);
      border-radius: 18px;
      color: var(--app-text-muted);
      background: var(--app-surface);
    }

    .result-state mat-icon {
      color: var(--app-accent);
      width: 36px;
      height: 36px;
      font-size: 36px;
    }

    .result-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 14px;
    }

    .result-overview {
      margin-top: 8px;
      display: grid;
      gap: 12px;
      min-height: 0;
    }

    .result-overview-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .result-overview-head h3 {
      margin: 0;
      color: var(--app-text);
      font-size: 15px;
      font-weight: 800;
    }

    .result-overview-head span {
      color: var(--app-text-muted);
      font-size: 12px;
      font-weight: 700;
    }

    .result-overview-list {
      display: grid;
      gap: 10px;
      max-height: 160px;
      overflow: auto;
      padding-right: 4px;
    }

    .overview-item {
      position: relative;
      overflow: hidden;
      padding: 14px 15px 13px;
      border-radius: 20px;
      border: 1px solid rgba(126, 162, 255, 0.18);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 250, 255, 0.96)),
        var(--app-surface);
      display: grid;
      gap: 8px;
    }

    .overview-item-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
    }

    .overview-item-head strong {
      color: var(--app-text);
      font-size: 15px;
      line-height: 1.25;
      word-break: break-word;
    }

    .overview-item-head span {
      color: #1d4ed8;
      font-weight: 900;
      white-space: nowrap;
    }

    .overview-item-meta,
    .overview-item-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 14px;
      color: var(--app-text-muted);
      font-size: 12px;
    }

    .overview-item-stats span {
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.09);
      color: #1e293b;
      font-weight: 800;
    }

    .summary-item {
      position: relative;
      overflow: hidden;
      padding: 14px 14px 13px;
      border-radius: 20px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 251, 255, 0.94)),
        var(--app-surface);
      border: 1px solid rgba(126, 162, 255, 0.18);
      display: grid;
      gap: 5px;
    }

    .summary-item__icon {
      width: 40px;
      height: 40px;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(37, 99, 235, 0.1);
      color: #2563eb;
      margin-bottom: 3px;
    }

    .summary-item .label {
      color: #64748b;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .summary-item .value {
      color: #0f172a;
      font-weight: 800;
      font-size: 15px;
      line-height: 1.35;
      word-break: break-word;
    }

    .result-empty-note {
      margin-top: 8px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(59, 130, 246, 0.08);
      color: var(--app-text-muted);
      font-size: 13px;
      border: 1px solid rgba(59, 130, 246, 0.14);
    }

    .details-panel {
      padding: 20px;
    }

    .details-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 18px;
    }

    .details-head h2 {
      font-size: 22px;
      margin-top: 0;
    }

    .details-head p {
      margin: 8px 0 0;
      color: var(--app-text-muted);
      line-height: 1.55;
      max-width: 900px;
    }

    .details-summary {
      min-width: 180px;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid var(--app-border);
      background: var(--app-surface);
      display: grid;
      gap: 4px;
      justify-items: start;
    }

    .details-summary span {
      color: var(--app-text-muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .details-summary strong {
      color: #0f172a;
      font-size: 20px;
    }

    .table-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--app-border);
      display: grid;
      gap: 14px;
    }

    .table-section-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
    }

    .table-section-head h3 {
      margin: 0;
      font-size: 18px;
      color: var(--app-text);
    }

    .table-section-head p {
      margin: 4px 0 0;
      color: var(--app-text-muted);
      font-size: 13px;
    }

    .eyebrow--soft {
      margin-bottom: 4px;
      color: #60a5fa;
    }

    .table-summary {
      min-width: 140px;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid var(--app-border);
      background: var(--app-surface);
      display: grid;
      gap: 4px;
      justify-items: start;
    }

    .table-summary span {
      color: var(--app-text-muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .table-summary strong {
      color: var(--app-text);
      font-size: 18px;
    }

    .subtable {
      display: grid;
      gap: 10px;
    }

    .table-scroll {
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      border-radius: 16px;
      border: 1px solid var(--app-border);
      background: var(--app-surface);
    }

    .subtable-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .subtable-head h4 {
      margin: 0;
      color: var(--app-text);
      font-size: 15px;
    }

    .subtable-head span {
      color: var(--app-text-muted);
      font-size: 12px;
    }

    .result-table {
      width: 100%;
      min-width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      background: var(--app-surface);
    }

    .result-table--standard {
      min-width: 100%;
    }

    .result-table--configured {
      min-width: 100%;
    }

    .result-table thead th {
      background: rgba(59, 130, 246, 0.08);
      color: var(--app-text);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
      padding: 12px 14px;
      white-space: nowrap;
    }

    .result-table tbody td {
      padding: 12px 14px;
      border-top: 1px solid var(--app-border);
      color: var(--app-text);
      vertical-align: top;
      font-size: 13px;
      line-height: 1.45;
    }

    .result-table tbody tr:hover td {
      background: rgba(59, 130, 246, 0.03);
    }

    .total-cell {
      font-weight: 800;
      color: var(--app-accent);
    }

    @media (max-width: 1024px) {
      .layout-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .page-header,
      .result-head {
        align-items: flex-start;
        flex-direction: column;
      }

      .details-head {
        align-items: flex-start;
        flex-direction: column;
      }

      .upload-panel,
      .result-panel {
        padding: 14px;
        height: 100%;
        overflow: visible;
      }

      .details-panel {
        padding: 16px;
      }

      .dropzone {
        padding: 18px;
      }

      .result-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .summary-item {
        min-height: 112px;
      }

      .overview-item {
        padding: 13px 14px 12px;
      }

      .table-section-head,
      .subtable-head {
        flex-direction: column;
        align-items: flex-start;
      }

      .table-scroll {
        border-radius: 14px;
      }

      .result-table--standard {
        min-width: 520px;
      }

      .result-table--configured {
        min-width: 860px;
      }
    }
  `]
})
export class EvolisDecryptorComponent {
  private readonly decryptorService = inject(EvolisDecryptorService);
  selectedFile: File | null = null;
  dragActive = false;
  processing = false;
  errorMessage = '';
  result: EvolisDecryptResponse | null = null;
  presentation: EvolisPresentation | null = null;

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  private readonly expandedTables = new Set<number>();

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = false;
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.setFile(file);
  }

  decrypt(): void {
    if (!this.selectedFile || this.processing) {
      return;
    }

    this.processing = true;
    this.errorMessage = '';

    this.decryptorService.decrypt(this.selectedFile).subscribe({
      next: (response) => {
        this.result = response;
        this.presentation = parseEvolisPresentation(response.content);
        this.expandedTables.clear();
        this.processing = false;
      },
      error: (error) => {
        const status = error?.status as number | undefined;
        const backendMessage = error?.error?.error ?? error?.error?.message ?? error?.message;

        if (status === 401 || status === 403) {
          this.errorMessage = 'This tool is restricted to admins and the cpq-internal-tools role.';
        }
        else if (backendMessage) {
          this.errorMessage = backendMessage;
        }
        else if (status) {
          this.errorMessage = `Unable to decrypt the selected file. Server returned ${status}.`;
        }
        else {
          this.errorMessage = 'Unable to decrypt the selected file.';
        }

        this.processing = false;
      }
    });
  }

  downloadResult(): void {
    if (!this.result) {
      return;
    }

    this.decryptorService.downloadPdf(this.selectedFile!).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = this.result!.downloadFileName;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => {
        const status = error?.status as number | undefined;
        const backendMessage = error?.error?.error ?? error?.error?.message ?? error?.message;

        if (status === 401 || status === 403) {
          this.errorMessage = 'This tool is restricted to admins and the cpq-internal-tools role.';
        }
        else if (backendMessage) {
          this.errorMessage = backendMessage;
        }
        else if (status) {
          this.errorMessage = `Unable to generate the PDF document. Server returned ${status}.`;
        }
        else {
          this.errorMessage = 'Unable to generate the PDF document.';
        }
      }
    });
  }

  reset(): void {
    this.selectedFile = null;
    this.result = null;
    this.presentation = null;
    this.errorMessage = '';
    this.processing = false;
    this.expandedTables.clear();

    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  private setFile(file: File | null): void {
    if (!file) {
      return;
    }

    this.selectedFile = file;
    this.result = null;
    this.presentation = null;
    this.errorMessage = '';
    this.expandedTables.clear();
  }

  isTableExpanded(index: number): boolean {
    return this.expandedTables.has(index);
  }

  toggleTable(index: number): void {
    if (this.expandedTables.has(index)) {
      this.expandedTables.delete(index);
      return;
    }

    this.expandedTables.add(index);
  }

  formatTableDate(value: string): string {
    if (value.length !== 8) {
      return value;
    }

    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
}
