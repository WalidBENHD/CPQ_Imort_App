import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { DATASET_CATALOG, DatasetRequirement, ENTITY_TYPE_OPTIONS, EntityType, getDatasetDefinition } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';

@Component({
  selector: 'app-import-wizard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatStepperModule,
    MatFormFieldModule, MatSelectModule, MatProgressBarModule,
    MatSnackBarModule, MatDividerModule],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Dataset submission</div>
        <h1>New Dataset Import</h1>
      </div>
      <a mat-button routerLink="/dashboard">
        <mat-icon>arrow_back</mat-icon> Back to Datasets
      </a>
    </div>

    <mat-card class="wizard-shell">
      <mat-card-content>
        <mat-stepper linear #stepper [orientation]="isMobile ? 'vertical' : 'horizontal'">

          <!-- Step 1: Choose dataset -->
          <mat-step label="Select Dataset" [completed]="!!selectedType">
            <div class="step-content">
              <p class="step-subtitle">Choose the dataset you want to update.</p>
              <div class="entity-grid">
                <div
                  *ngFor="let opt of entityOptions"
                  class="entity-card"
                  [class.selected]="selectedType === opt.value"
                  (click)="setSelectedType(opt.value)">
                  <mat-icon>{{ entityIcon(opt.value) }}</mat-icon>
                  <div class="entity-label">{{ opt.label }}</div>
                  <div class="entity-desc">{{ opt.description }}</div>
                </div>
              </div>

              <div class="requirements-panel" *ngIf="selectedRequirement as req">
                <div class="requirements-header">
                  <div>
                    <h3>Template Requirements</h3>
                    <p>Review required columns and validation checks before uploading your file.</p>
                  </div>
                  <button mat-stroked-button (click)="downloadTemplate()">
                    <mat-icon>download</mat-icon>
                    Download Template
                  </button>
                </div>

                <div class="requirements-grid">
                  <div>
                    <div class="requirements-title">Columns</div>
                    <div class="requirements-item" *ngFor="let col of req.columns">
                      <div class="requirements-name">
                        {{ col.name }}
                        <span class="badge" [class.badge-optional]="!col.required">
                          {{ col.required ? 'Required' : 'Optional' }}
                        </span>
                      </div>
                      <div class="requirements-meta">{{ col.dataType }} - {{ col.description }}</div>
                      <div class="requirements-example" *ngIf="col.example">Example: {{ col.example }}</div>
                    </div>
                  </div>

                  <div>
                    <div class="requirements-title">Validation Rules</div>
                    <div class="requirements-item" *ngFor="let rule of req.validationRules">
                      <div class="requirements-name">
                        {{ rule.field }}
                        <span class="badge" [class.badge-warning]="rule.severity.toLowerCase() !== 'error'">
                          {{ rule.severity }}
                        </span>
                      </div>
                      <div class="requirements-meta">{{ displayRule(rule.field, rule.rule) }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="step-actions">
                <button mat-raised-button color="primary" matStepperNext [disabled]="!selectedType">
                  Continue <mat-icon>chevron_right</mat-icon>
                </button>
                <button mat-stroked-button (click)="downloadTemplate()" [disabled]="!selectedType" class="ml-8">
                  <mat-icon>download</mat-icon> Download Dataset Template
                </button>
              </div>
            </div>
          </mat-step>

          <!-- Step 2: Upload file -->
          <mat-step label="Upload File" [completed]="!!selectedFile">
            <div class="step-content">
              <p class="step-subtitle">Upload your filled Excel (.xlsx) or CSV (.csv) file for the selected dataset.</p>

              <div class="upload-hint" *ngIf="selectedRequirement as req">
                Required columns for {{ req.displayName }}:
                <strong>{{ requiredColumnsHint(req) }}</strong>
              </div>

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
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .eyebrow {
      color: #2563eb;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }
    h1 { margin: 0; font-size: 28px; font-weight: 700; color: #0f172a; }

    .wizard-shell { border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: none; }
    .step-content { padding: 24px 0; }
    .step-subtitle { color: #64748b; margin-bottom: 20px; }
    .entity-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; max-width: 760px; }
    .entity-card {
      border: 1px solid #dbe3ee; border-radius: 14px; padding: 16px; cursor: pointer;
      transition: all 0.2s; display: flex; flex-direction: column; gap: 4px;
      background: linear-gradient(180deg, #ffffff, #f8fafc);
    }
    .entity-card:hover { border-color: #5b6bd4; background: #f8f9ff; transform: translateY(-1px); }
    .entity-card.selected { border-color: #2563eb; background: #eff6ff; }
    .entity-card mat-icon {
      font-size: 28px;
      height: 28px;
      width: 28px;
      min-width: 28px;
      line-height: 28px;
      color: #2563eb;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      flex-shrink: 0;
    }
    .entity-label { font-weight: 700; color: #0f172a; }
    .entity-desc { font-size: 12px; color: rgba(0,0,0,0.54); line-height: 1.45; }
    .upload-hint {
      border: 1px solid #dbeafe;
      background: #eff6ff;
      color: #1e3a8a;
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 14px;
      font-size: 13px;
      line-height: 1.45;
    }

    .requirements-panel {
      border: 1px solid #dbe4f0;
      background: #f8fafc;
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 20px;
    }

    .requirements-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .requirements-header h3 {
      margin: 0 0 4px;
      font-size: 16px;
      color: #0f172a;
    }

    .requirements-header p {
      margin: 0;
      color: #475569;
      font-size: 13px;
    }

    .requirements-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .requirements-title {
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 8px;
    }

    .requirements-item {
      border: 1px solid #e2e8f0;
      background: #ffffff;
      border-radius: 10px;
      padding: 8px 10px;
      margin-bottom: 8px;
      display: grid;
      gap: 4px;
    }

    .requirements-name {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #0f172a;
      font-size: 13px;
      font-weight: 700;
    }

    .requirements-meta,
    .requirements-example {
      font-size: 12px;
      color: #475569;
      line-height: 1.4;
    }

    .badge {
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid #dbeafe;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .badge-optional {
      border-color: #e2e8f0;
      background: #f8fafc;
      color: #475569;
    }

    .badge-warning {
      border-color: #fde68a;
      background: #fffbeb;
      color: #92400e;
    }

    .drop-zone {
      border: 2px dashed #bfcae6; border-radius: 14px; padding: 40px; text-align: center;
      cursor: pointer; transition: all 0.2s; min-height: 160px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    }
    .drop-zone:hover, .drop-zone.drag-over { border-color: #2563eb; background: #f8f9ff; }
    .drop-icon { font-size: 48px; height: 48px; width: 48px; color: #bdbdbd; }
    .hint { font-size: 12px; color: rgba(0,0,0,0.38); margin: 0; }
    .file-preview { display: flex; align-items: center; gap: 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; padding: 8px 12px; width: 100%; }
    .file-name { font-weight: 600; }
    .file-size { font-size: 12px; color: rgba(0,0,0,0.54); }
    .upload-progress { margin-top: 16px; }
    .step-actions { display: flex; align-items: center; margin-top: 24px; }
    .step-actions button[mat-raised-button],
    .step-actions button[mat-stroked-button] { border-radius: 999px; }
    .ml-8 { margin-left: 8px; }
    .center { text-align: center; padding: 40px; }
    .success-icon { font-size: 64px; height: 64px; width: 64px; }
    .responsibility-notice { display: flex; gap: 12px; padding: 12px; background: #fff7ed; border-radius: 12px; border-left: 4px solid #f59e0b; margin: 24px 0; }
    .notice-icon { color: #f57f17; flex-shrink: 0; }
    .notice-content { flex: 1; }
    .notice-content h3 { margin: 0 0 8px 0; font-size: 14px; color: #e65100; font-weight: 700; }
    .notice-content p { margin: 0 0 8px 0; font-size: 13px; color: rgba(0,0,0,0.75); line-height: 1.5; }
    .responsibility-checkbox { display: flex; align-items: flex-start; gap: 8px; cursor: pointer; font-size: 13px; color: rgba(0,0,0,0.75); }
    .responsibility-checkbox input[type="checkbox"] { margin-top: 2px; cursor: pointer; }

    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
      h1 { font-size: 22px; }
      .wizard-shell { overflow: visible; }
      :host ::ng-deep .wizard-shell .mat-mdc-card-content { overflow: visible; }
      :host ::ng-deep .wizard-shell .mat-stepper-vertical { overflow: visible; }
      :host ::ng-deep .wizard-shell .mat-vertical-stepper-header {
        padding-left: 6px;
      }
      .step-content { padding: 12px 0; }
      .entity-grid { grid-template-columns: 1fr; gap: 10px; }
      .requirements-header,
      .requirements-grid {
        grid-template-columns: 1fr;
        display: grid;
      }
      .requirements-header {
        display: flex;
        flex-direction: column;
      }
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
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  entityOptions = ENTITY_TYPE_OPTIONS;
  selectedType: EntityType | null = null;
  selectedFile: File | null = null;
  isDragOver = false;
  uploading = false;
  uploadedJobId: string | null = null;
  acknowledgedResponsibility = false;
  requirementsByType: Partial<Record<EntityType, DatasetRequirement>> = {};

  get isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  get selectedRequirement(): DatasetRequirement | undefined {
    if (!this.selectedType) {
      return undefined;
    }

    return this.requirementsByType[this.selectedType];
  }

  constructor() {
    this.loadDatasetRequirements();

    const dataset = this.route.snapshot.queryParamMap.get('dataset') as EntityType | null;
    if (dataset && DATASET_CATALOG.some(item => item.key === dataset)) {
      this.setSelectedType(dataset);
    }
  }

  setSelectedType(type: EntityType) {
    this.selectedType = type;
    this.selectedFile = null;
    this.acknowledgedResponsibility = false;
  }

  requiredColumnsHint(requirement: DatasetRequirement): string {
    return requirement.columns
      .filter(col => col.required)
      .map(col => col.name)
      .join(', ');
  }

  displayRule(field: string, rule: string): string {
    if (field.toLowerCase() !== 'articlenumber') {
      return rule;
    }

    return /space/i.test(rule)
      ? rule
      : `${rule} No spaces are allowed.`;
  }

  private loadDatasetRequirements() {
    this.importService.getDatasetRequirements().subscribe({
      next: (requirements) => {
        this.requirementsByType = requirements.reduce((acc, item) => {
          acc[item.entityTypeLabel] = item;
          return acc;
        }, {} as Partial<Record<EntityType, DatasetRequirement>>);
      },
      error: () => {
        this.requirementsByType = {};
      }
    });
  }

  entityIcon(type: EntityType): string {
    return getDatasetDefinition(type).icon;
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
    const selectedType = this.selectedType;
    if (!selectedType) return;
    this.importService.downloadTemplate(selectedType).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `CPQ_Dataset_Template_${getDatasetDefinition(selectedType).fileNameFragment}.xlsx`;
      a.click();
    });
  }

  goToPreview() {
    if (this.uploadedJobId) this.router.navigate(['/import', this.uploadedJobId]);
  }
}
