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
    <section class="page-shell">
      <header class="page-header">
        <div>
          <div class="eyebrow">Internal tools</div>
          <h1>Evolis Decryptor</h1>
          <p class="page-intro">
            Upload an Evolis pricing file, decrypt the encrypted price field in each C row, and download the transformed result.
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
            <p>Or choose a text file to decrypt. The parser preserves table structure and rewrites only encrypted prices.</p>

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
            <button mat-stroked-button type="button" [disabled]="!result" (click)="downloadResult()">
              <mat-icon>download</mat-icon>
              Download
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
            <div class="summary-item">
              <span class="label">Source</span>
              <span class="value">{{ result.sourceFileName }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Grand total</span>
              <span class="value">{{ presentation?.grandTotal ?? '0.0000' }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Output</span>
              <span class="value">{{ result.downloadFileName }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Tables</span>
              <span class="value">{{ presentation?.tables?.length ?? 0 }}</span>
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
            <p>Use the full width below for long files, with each table grouped and totals shown at row and table level.</p>
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
          <div class="table-section" *ngFor="let table of presentation.tables">
            <div class="table-section-head">
              <div>
                <div class="eyebrow eyebrow--soft">{{ table.title }}</div>
                <h3>{{ table.idPanier }}</h3>
                <p>{{ formatTableDate(table.date) }}</p>
              </div>
              <div class="table-summary">
                <span>Subtotal</span>
                <strong>{{ table.subtotal }}</strong>
              </div>
            </div>

            <div class="subtable" *ngIf="table.lineRows.length > 0">
              <div class="subtable-head">
                <h4>Standard rows</h4>
                <span>{{ table.lineRows.length }} items</span>
              </div>
              <table class="result-table">
                <thead>
                  <tr>
                    <th>L</th>
                    <th>Quantity</th>
                    <th>Generic part number</th>
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

            <div class="subtable" *ngIf="table.configuredRows.length > 0">
              <div class="subtable-head">
                <h4>Configured rows</h4>
                <span>{{ table.configuredRows.length }} items</span>
              </div>
              <table class="result-table">
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
      padding: 20px;
      display: flex;
      flex-direction: column;
    }

    .upload-panel {
      height: auto;
      overflow: visible;
    }

    .result-panel {
      height: auto;
      align-self: start;
    }

    .upload-panel .dropzone,
    .result-panel > .result-head,
    .result-panel > .result-summary,
    .result-panel > .result-empty-note {
      flex: 0 0 auto;
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
    }

    .file-input {
      display: none;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
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
      width: 100%;
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
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
      width: 100%;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.22);
      color: #b91c1c;
      font-weight: 600;
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
      font-weight: 700;
    }

    .result-state {
      display: grid;
      place-items: center;
      gap: 12px;
      min-height: 240px;
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
      gap: 12px;
      margin-bottom: 14px;
    }

    .summary-item {
      padding: 12px 14px;
      border-radius: 16px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      display: grid;
      gap: 4px;
    }

    .summary-item .label {
      color: var(--app-text-muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .summary-item .value {
      color: var(--app-text);
      font-weight: 700;
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
      color: var(--app-text);
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
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 16px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
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
        padding: 16px;
        height: auto;
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

      .table-section-head,
      .subtable-head {
        flex-direction: column;
        align-items: flex-start;
      }

      .result-table {
        display: block;
        overflow-x: auto;
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

    const blob = new Blob([this.result.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.result.downloadFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  reset(): void {
    this.selectedFile = null;
    this.result = null;
    this.presentation = null;
    this.errorMessage = '';
    this.processing = false;

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
  }

  formatTableDate(value: string): string {
    if (value.length !== 8) {
      return value;
    }

    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
}