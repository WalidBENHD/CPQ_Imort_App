import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { ImportService } from '../../core/services/import.service';
import { ENTITY_TYPE_OPTIONS, EntityType } from '../../core/models/import.models';

@Component({
  selector: 'app-import-wizard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatStepperModule,
    MatFormFieldModule, MatSelectModule, MatProgressBarModule,
    MatSnackBarModule, MatDividerModule],
  template: `
    <div class="page-header">
      <h1>New Import</h1>
      <a mat-button routerLink="/dashboard">
        <mat-icon>arrow_back</mat-icon> Back to Dashboard
      </a>
    </div>

    <mat-card>
      <mat-card-content>
        <mat-stepper linear #stepper [orientation]="isMobile ? 'vertical' : 'horizontal'">

          <!-- Step 1: Choose type -->
          <mat-step label="Select Data Type" [completed]="!!selectedType">
            <div class="step-content">
              <p class="step-subtitle">What type of data do you want to import?</p>
              <div class="entity-grid">
                <div
                  *ngFor="let opt of entityOptions"
                  class="entity-card"
                  [class.selected]="selectedType === opt.value"
                  (click)="selectedType = opt.value">
                  <mat-icon>{{ entityIcon(opt.value) }}</mat-icon>
                  <div class="entity-label">{{ opt.label }}</div>
                  <div class="entity-desc">{{ opt.description }}</div>
                </div>
              </div>
              <div class="step-actions">
                <button mat-raised-button color="primary" matStepperNext [disabled]="!selectedType">
                  Continue <mat-icon>chevron_right</mat-icon>
                </button>
                <button mat-stroked-button (click)="downloadTemplate()" [disabled]="!selectedType" class="ml-8">
                  <mat-icon>download</mat-icon> Download Template
                </button>
              </div>
            </div>
          </mat-step>

          <!-- Step 2: Upload file -->
          <mat-step label="Upload File" [completed]="!!selectedFile">
            <div class="step-content">
              <p class="step-subtitle">Upload your filled Excel (.xlsx) or CSV (.csv) file.</p>

              <div
                class="drop-zone"
                [class.drag-over]="isDragOver"
                (dragover)="onDragOver($event)"
                (dragleave)="isDragOver = false"
                (drop)="onDrop($event)"
                (click)="fileInput.click()">
                <input #fileInput type="file" accept=".xlsx,.csv" hidden (change)="onFileSelected($event)">
                <mat-icon class="drop-icon">cloud_upload</mat-icon>
                <div *ngIf="!selectedFile">
                  <p>Drag & drop your file here, or <strong>click to browse</strong></p>
                  <p class="hint">Accepted formats: .xlsx, .csv | Max size: 10 MB</p>
                </div>
                <div *ngIf="selectedFile" class="file-preview">
                  <mat-icon color="primary">description</mat-icon>
                  <div>
                    <div class="file-name">{{ selectedFile.name }}</div>
                    <div class="file-size">{{ formatSize(selectedFile.size) }}</div>
                  </div>
                  <button mat-icon-button color="warn" (click)="clearFile($event)">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </div>

              <mat-progress-bar *ngIf="uploading" mode="indeterminate" class="upload-progress"></mat-progress-bar>

              <!-- Data Responsibility Notice -->
              <div class="responsibility-notice">
                <mat-icon class="notice-icon">warning</mat-icon>
                <div class="notice-content">
                  <h3>Your Data Responsibility</h3>
                  <p>
                    <strong>You are responsible for the correctness and completeness of this data.</strong>
                    The quality of our CPQ system depends entirely on the quality of the data imported.
                    Please verify all values are accurate before submission.
                  </p>
                  <p style="margin-bottom: 12px; font-size: 13px; color: rgba(0,0,0,0.65);">
                    <em>Note: Administrators and approvers review the structural integrity of the data, not the correctness of individual values. 
                    Data validation and accuracy is your responsibility as the data source owner.</em>
                  </p>
                  <label class="responsibility-checkbox">
                    <input type="checkbox" [(ngModel)]="acknowledgedResponsibility" />
                    <span>I acknowledge that I have verified this data and take full responsibility for its accuracy</span>
                  </label>
                </div>
              </div>

              <div class="step-actions">
                <button mat-stroked-button matStepperPrevious>
                  <mat-icon>chevron_left</mat-icon> Back
                </button>
                <button mat-raised-button color="primary"
                  [disabled]="!selectedFile || uploading || !acknowledgedResponsibility"
                  (click)="upload()" class="ml-8">
                  <mat-icon>upload</mat-icon>
                  {{ uploading ? 'Uploading...' : 'Upload & Preview' }}
                </button>
              </div>
            </div>
          </mat-step>

          <!-- Step 3: Done -->
          <mat-step label="Preview">
            <div class="step-content center">
              <mat-icon class="success-icon" color="primary">check_circle</mat-icon>
              <h2>Upload Successful!</h2>
              <p>Your file has been uploaded and validated. Review the results before approving.</p>
              <button mat-raised-button color="primary" (click)="goToPreview()">
                View Preview &amp; Approve <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </mat-step>

        </mat-stepper>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 24px; font-weight: 400; }
    .step-content { padding: 24px 0; }
    .step-subtitle { color: rgba(0,0,0,0.54); margin-bottom: 24px; }
    .entity-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; max-width: 640px; }
    .entity-card {
      border: 2px solid #e0e0e0; border-radius: 8px; padding: 16px; cursor: pointer;
      transition: all 0.2s; display: flex; flex-direction: column; gap: 4px;
    }
    .entity-card:hover { border-color: #3f51b5; background: #f8f9ff; }
    .entity-card.selected { border-color: #3f51b5; background: #e8eaf6; }
    .entity-card mat-icon { font-size: 28px; height: 28px; color: #3f51b5; }
    .entity-label { font-weight: 500; }
    .entity-desc { font-size: 12px; color: rgba(0,0,0,0.54); }
    .drop-zone {
      border: 2px dashed #bdbdbd; border-radius: 8px; padding: 40px; text-align: center;
      cursor: pointer; transition: all 0.2s; min-height: 160px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    }
    .drop-zone:hover, .drop-zone.drag-over { border-color: #3f51b5; background: #f8f9ff; }
    .drop-icon { font-size: 48px; height: 48px; width: 48px; color: #bdbdbd; }
    .hint { font-size: 12px; color: rgba(0,0,0,0.38); margin: 0; }
    .file-preview { display: flex; align-items: center; gap: 12px; background: #f5f5f5; border-radius: 4px; padding: 8px 12px; }
    .file-name { font-weight: 500; }
    .file-size { font-size: 12px; color: rgba(0,0,0,0.54); }
    .upload-progress { margin-top: 16px; }
    .step-actions { display: flex; align-items: center; margin-top: 24px; }
    .ml-8 { margin-left: 8px; }
    .center { text-align: center; padding: 40px; }
    .success-icon { font-size: 64px; height: 64px; width: 64px; }
    .responsibility-notice { display: flex; gap: 12px; padding: 12px; background: #fff3e0; border-radius: 4px; border-left: 4px solid #f57f17; margin: 24px 0; }
    .notice-icon { color: #f57f17; flex-shrink: 0; }
    .notice-content { flex: 1; }
    .notice-content h3 { margin: 0 0 8px 0; font-size: 14px; color: #e65100; font-weight: 600; }
    .notice-content p { margin: 0 0 8px 0; font-size: 13px; color: rgba(0,0,0,0.75); line-height: 1.5; }
    .responsibility-checkbox { display: flex; align-items: flex-start; gap: 8px; cursor: pointer; font-size: 13px; color: rgba(0,0,0,0.75); }
    .responsibility-checkbox input[type="checkbox"] { margin-top: 2px; cursor: pointer; }

    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
      h1 { font-size: 22px; }
      .step-content { padding: 12px 0; }
      .entity-grid { grid-template-columns: 1fr; gap: 10px; }
      .drop-zone { padding: 24px 12px; min-height: 130px; }
      .drop-icon { font-size: 38px; height: 38px; width: 38px; }
      .step-actions { flex-direction: column; align-items: stretch; gap: 8px; }
      .ml-8 { margin-left: 0; }
      .step-actions button { width: 100%; justify-content: center; }
      .file-preview { width: 100%; justify-content: space-between; }
      .center { padding: 20px 8px; }
      .responsibility-notice { flex-direction: column; gap: 8px; }
    }
  `]
})
export class ImportWizardComponent {
  private readonly importService = inject(ImportService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  entityOptions = ENTITY_TYPE_OPTIONS;
  selectedType: EntityType | null = null;
  selectedFile: File | null = null;
  isDragOver = false;
  uploading = false;
  uploadedJobId: string | null = null;
  acknowledgedResponsibility = false;

  get isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  entityIcon(type: EntityType): string {
    const icons: Record<EntityType, string> = {
      Article: 'inventory_2', PriceList: 'price_change',
      Description: 'translate', CurrencyRate: 'currency_exchange'
    };
    return icons[type];
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragOver = true; }

  onDrop(e: DragEvent) {
    e.preventDefault(); this.isDragOver = false;
    const f = e.dataTransfer?.files[0];
    if (f) this.validateAndSetFile(f);
  }

  onFileSelected(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.validateAndSetFile(f);
  }

  clearFile(e: Event) { 
    e.stopPropagation(); 
    this.selectedFile = null;
    this.acknowledgedResponsibility = false;
  }

  private validateAndSetFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'csv'].includes(ext ?? '')) {
      this.snackBar.open('Only .xlsx and .csv files are accepted.', 'Close', { duration: 4000 });
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      this.snackBar.open('File exceeds 10 MB limit.', 'Close', { duration: 4000 });
      return;
    }
    this.selectedFile = f;
  }

  upload() {
    if (!this.selectedFile || !this.selectedType) return;
    this.uploading = true;
    this.importService.upload(this.selectedFile, this.selectedType).subscribe({
      next: job => {
        this.uploadedJobId = job.id;
        this.uploading = false;
        // Move to step 3 (done)
        document.querySelector('.mat-stepper-next')?.dispatchEvent(new Event('click'));
      },
      error: err => {
        this.uploading = false;
        const msg = err?.error?.error ?? 'Upload failed. Please check your file and try again.';
        this.snackBar.open(msg, 'Close', { duration: 6000 });
      }
    });
  }

  downloadTemplate() {
    if (!this.selectedType) return;
    this.importService.downloadTemplate(this.selectedType).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `CPQ_Import_Template_${this.selectedType}.xlsx`;
      a.click();
    });
  }

  goToPreview() {
    if (this.uploadedJobId) this.router.navigate(['/import', this.uploadedJobId]);
  }
}
