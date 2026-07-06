import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { EvolisDecryptorService } from '../../core/services/evolis-decryptor.service';

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

      <div class="layout-grid">
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
            <p>The decrypted file will appear here after processing.</p>
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
              <span class="label">Output</span>
              <span class="value">{{ result.downloadFileName }}</span>
            </div>
          </div>

          <pre class="result-preview" *ngIf="result">{{ result.content }}</pre>
        </mat-card>
      </div>
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
      align-items: start;
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
      grid-template-columns: repeat(2, minmax(0, 1fr));
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

    .result-preview {
      margin: 0;
      padding: 16px;
      min-height: 260px;
      max-height: 60vh;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      border-radius: 18px;
      background: #0f172a;
      color: #e2e8f0;
      border: 1px solid rgba(15, 23, 42, 0.18);
      font-size: 12.5px;
      line-height: 1.55;
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

      .upload-panel,
      .result-panel {
        padding: 16px;
      }

      .dropzone {
        padding: 18px;
      }

      .result-summary {
        grid-template-columns: 1fr;
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
  result: { sourceFileName: string; downloadFileName: string; content: string } | null = null;

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
    this.errorMessage = '';
  }
}