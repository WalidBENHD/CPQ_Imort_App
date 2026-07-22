import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DATASET_CATALOG, DatasetRequirement, ENTITY_TYPE_OPTIONS, EntityType, getDatasetDefinition, PILOT_SCOPE } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';

@Component({
  selector: 'app-import-wizard',
  standalone: true,
  imports: [CommonModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatStepperModule,
    MatProgressBarModule, MatSnackBarModule],
  template: `
    <section class="submission-page">
    <div class="page-header">
      <div class="header-copy">
        <div class="eyebrow"><mat-icon>cloud_upload</mat-icon> Dataset submission</div>
        <h1>New annual submission</h1>
        <p class="page-intro">
          Saint-Marcellin PDU annual update for Article Master and Basis Price, including a clear unit price for each article, controlled through one governed workflow.
        </p>
      </div>
      <a class="back-link" mat-stroked-button routerLink="/datasets">
        <mat-icon>arrow_back</mat-icon> Back to datasets
      </a>
    </div>

    <section class="context-grid">
    <mat-card class="pilot-scope-card">
      <span class="context-icon"><mat-icon>location_on</mat-icon></span>
      <div class="pilot-scope-copy">
        <div class="eyebrow">Pilot scope</div>
        <h2>{{ pilotScope.site }} - {{ pilotScope.productFamily }}</h2>
        <p>
          {{ pilotScope.submissionType }} with {{ pilotScope.dataDomains.join(' + ') }}.
          Category stays {{ pilotScope.category }}, and currency is required.
        </p>
      </div>
      <div class="pilot-scope-chips">
        <span class="scope-chip">{{ pilotScope.site }}</span>
        <span class="scope-chip">{{ pilotScope.productFamily }}</span>
        <span class="scope-chip" *ngFor="let domain of pilotScope.dataDomains">{{ domain }}</span>
        <span class="scope-chip">{{ pilotScope.submissionType }}</span>
        <span class="scope-chip">Currency: {{ pilotScope.currency }}</span>
      </div>
    </mat-card>

    <mat-card class="annual-flow-card">
      <span class="context-icon context-icon--review"><mat-icon>difference</mat-icon></span>
      <div class="annual-flow-copy">
        <div class="eyebrow">Annual review path</div>
        <h3>Compare each new submission with the approved baseline</h3>
        <p>
          This pilot treats the upload as a governed annual refresh. The portal will highlight new articles,
          modified prices, and missing rows so approvers review exceptions instead of re-reading every line.
        </p>
      </div>
      <div class="annual-flow-chips">
        <span class="flow-chip">Baseline comparison</span>
        <span class="flow-chip">Exception review</span>
        <span class="flow-chip">Annual refresh</span>
      </div>
    </mat-card>
    </section>

    <mat-card class="wizard-shell">
      <header class="wizard-intro"><div><span>Guided submission</span><h2>Prepare a governed annual version</h2></div><small><mat-icon>lock</mat-icon>Private until you submit</small></header>
      <mat-card-content>
        <mat-stepper linear #stepper [orientation]="isMobile ? 'vertical' : 'horizontal'">

          <!-- Step 1: Choose dataset -->
          <mat-step label="Select Dataset" [completed]="!!selectedType">
            <div class="step-content">
              <p class="step-subtitle">Choose the pilot dataset you want to update.</p>
              <div class="entity-grid">
                <div
                  *ngFor="let opt of entityOptions"
                  class="entity-card"
                  [attr.data-dataset]="opt.value"
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
                    <p>Review the governed field dictionary and validation expectations before uploading your file.</p>
                  </div>
                  <button mat-stroked-button (click)="downloadTemplate()">
                    <mat-icon>download</mat-icon>
                    Download Template
                  </button>
                </div>

                <div class="requirements-table">
                  <div class="requirements-table-head">
                    <span>Field</span>
                    <span>Definition</span>
                    <span>Validation</span>
                  </div>
                  <div class="requirements-table-row" *ngFor="let row of requirementRows(req)">
                    <div class="requirements-field">
                      <div class="requirements-name">
                        {{ row.name }}
                        <span class="badge" [class.badge-optional]="!row.required">
                          {{ row.required ? 'Required' : 'Optional' }}
                        </span>
                      </div>
                      <div class="requirements-example" *ngIf="row.example">Example: {{ row.example }}</div>
                    </div>
                    <div class="requirements-definition">
                      <span class="requirements-type">{{ row.dataType }}</span>
                      <span class="requirements-meta">{{ row.description }}</span>
                    </div>
                    <div class="requirements-validation">
                      <span class="badge" [class.badge-warning]="row.severity.toLowerCase() !== 'error'">
                        {{ row.severity }}
                      </span>
                      <div class="requirements-meta">{{ row.rule }}</div>
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

              <div class="workspace-notice">
                <span class="workspace-notice__icon"><mat-icon>lock</mat-icon></span>
                <div class="notice-content">
                  <div class="eyebrow">Private workspace</div>
                  <h3>Upload privately, review before sharing</h3>
                  <p>
                    This file creates a private draft visible only to you. Automatic validation and baseline comparison run first,
                    so you can correct the data before deliberately submitting it to approvers.
                  </p>
                </div>
              </div>

              <div class="step-actions">
                <button mat-stroked-button matStepperPrevious>
                  <mat-icon>chevron_left</mat-icon> Back
                </button>
                <button mat-raised-button color="primary"
                  [disabled]="!selectedFile || uploading"
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
              <h2>Private draft created</h2>
              <p>Your file has been validated in your workspace. Review and correct the results before submitting it to approvers.</p>
              <button mat-raised-button color="primary" (click)="goToPreview()">
                Open private draft <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </mat-step>

        </mat-stepper>
      </mat-card-content>
    </mat-card>
    </section>
  `,
  styles: [`
    :host { display: block; color: var(--app-text); }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .eyebrow {
      color: var(--app-accent);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }
    h1 { margin: 0; font-size: 28px; font-weight: 700; color: var(--app-text); }
    .page-intro {
      margin: 8px 0 0;
      color: var(--app-text-muted);
      line-height: 1.55;
      max-width: 760px;
    }

    .pilot-scope-card {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      border: 1px solid var(--app-border);
      border-radius: 16px;
      background: linear-gradient(180deg, var(--app-surface-elevated), var(--app-surface));
      box-shadow: none;
      padding: 16px;
      margin-bottom: 16px;
    }
    .pilot-scope-copy h2 {
      margin: 0 0 6px;
      font-size: 20px;
      font-weight: 800;
      color: var(--app-text);
    }
    .pilot-scope-copy p {
      margin: 0;
      color: var(--app-text-muted);
      line-height: 1.5;
      max-width: 740px;
    }
    .pilot-scope-chips {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .annual-flow-card {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      border: 1px solid var(--app-border);
      border-radius: 16px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--app-accent) 6%, var(--app-surface-elevated)), var(--app-surface));
      box-shadow: none;
      padding: 16px;
      margin-bottom: 16px;
    }
    .annual-flow-copy h3 {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 800;
      color: var(--app-text);
    }
    .annual-flow-copy p {
      margin: 0;
      color: var(--app-text-muted);
      line-height: 1.5;
      max-width: 760px;
    }
    .annual-flow-chips {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .flow-chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid color-mix(in srgb, var(--app-accent) 24%, var(--app-border));
      background: color-mix(in srgb, var(--app-accent) 10%, var(--app-surface));
      color: var(--app-accent);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .scope-chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid color-mix(in srgb, var(--app-accent) 24%, var(--app-border));
      background: color-mix(in srgb, var(--app-accent) 10%, var(--app-surface));
      color: var(--app-accent);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .wizard-shell { border: 1px solid var(--app-border); border-radius: 16px; background: var(--app-surface); box-shadow: none; }
    .step-content { padding: 24px 0; }
    .step-subtitle { color: var(--app-text-muted); margin-bottom: 20px; }
    .entity-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; max-width: 760px; }
    .entity-card {
      border: 1px solid var(--app-border); border-radius: 14px; padding: 16px; cursor: pointer;
      transition: all 0.2s; display: flex; flex-direction: column; gap: 4px;
      background: linear-gradient(180deg, var(--app-surface-elevated), var(--app-surface));
    }
    .entity-card:hover { border-color: var(--app-accent); background: color-mix(in srgb, var(--app-accent) 7%, var(--app-surface)); transform: translateY(-1px); }
    .entity-card.selected { border-color: var(--app-accent); background: color-mix(in srgb, var(--app-accent) 12%, var(--app-surface)); }
    .entity-card mat-icon {
      font-size: 28px;
      height: 28px;
      width: 28px;
      min-width: 28px;
      line-height: 28px;
      color: var(--app-accent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      flex-shrink: 0;
    }
    .entity-label { font-weight: 700; color: var(--app-text); }
    .entity-desc { font-size: 12px; color: var(--app-text-muted); line-height: 1.45; }
    .upload-hint {
      border: 1px solid color-mix(in srgb, var(--app-accent) 24%, var(--app-border));
      background: color-mix(in srgb, var(--app-accent) 9%, var(--app-surface));
      color: var(--app-text);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 14px;
      font-size: 13px;
      line-height: 1.45;
    }

    .requirements-panel {
      border: 1px solid var(--app-border);
      background: var(--app-soft-surface);
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
      color: var(--app-text);
    }

    .requirements-header p {
      margin: 0;
      color: var(--app-text-muted);
      font-size: 13px;
    }

    .requirements-table {
      border: 1px solid var(--app-border);
      border-radius: 14px;
      overflow: hidden;
      background: var(--app-surface);
    }

    .requirements-table-head,
    .requirements-table-row {
      display: grid;
      grid-template-columns: minmax(180px, 1.1fr) minmax(240px, 1.4fr) minmax(220px, 1fr);
      gap: 12px;
      align-items: start;
    }

    .requirements-table-head {
      padding: 12px 16px;
      background: var(--app-soft-surface);
      border-bottom: 1px solid var(--app-border);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--app-text-muted);
    }

    .requirements-table-row {
      padding: 14px 16px;
      border-bottom: 1px solid var(--app-border);
    }

    .requirements-table-row:last-child {
      border-bottom: 0;
    }

    .requirements-field,
    .requirements-definition,
    .requirements-validation {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .requirements-name {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--app-text);
      font-size: 13px;
      font-weight: 700;
      flex-wrap: wrap;
    }

    .requirements-type {
      display: inline-flex;
      width: fit-content;
      padding: 4px 8px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--app-accent) 10%, var(--app-surface));
      border: 1px solid color-mix(in srgb, var(--app-accent) 24%, var(--app-border));
      color: var(--app-accent);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .requirements-meta,
    .requirements-example {
      font-size: 12px;
      color: var(--app-text-muted);
      line-height: 1.45;
    }

    .badge {
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid color-mix(in srgb, var(--app-accent) 24%, var(--app-border));
      background: color-mix(in srgb, var(--app-accent) 10%, var(--app-surface));
      color: var(--app-accent);
    }

    .badge-optional {
      border-color: var(--app-border);
      background: var(--app-soft-surface);
      color: var(--app-text-muted);
    }

    .badge-warning {
      border-color: #fde68a;
      background: color-mix(in srgb, #f59e0b 12%, var(--app-surface));
      color: color-mix(in srgb, #f59e0b 76%, var(--app-text));
    }

    .requirements-validation .requirements-meta {
      color: var(--app-text);
    }

    .drop-zone {
      border: 2px dashed color-mix(in srgb, var(--app-text-muted) 52%, var(--app-border)); border-radius: 14px; padding: 40px; text-align: center;
      cursor: pointer; transition: all 0.2s; min-height: 160px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    }
    .drop-zone:hover, .drop-zone.drag-over { border-color: var(--app-accent); background: color-mix(in srgb, var(--app-accent) 7%, var(--app-surface)); }
    .drop-icon { font-size: 48px; height: 48px; width: 48px; color: var(--app-accent); }
    .hint { font-size: 12px; color: var(--app-text-muted); margin: 0; }
    .file-preview { display: flex; align-items: center; gap: 12px; background: var(--app-soft-surface); border-radius: 10px; border: 1px solid var(--app-border); padding: 8px 12px; width: 100%; }
    .file-name { font-weight: 600; }
    .file-size { font-size: 12px; color: var(--app-text-muted); }
    .upload-progress { margin-top: 16px; }
    .step-actions { display: flex; align-items: center; margin-top: 24px; }
    .step-actions button[mat-raised-button],
    .step-actions button[mat-stroked-button] { border-radius: 999px; }
    .ml-8 { margin-left: 8px; }
    .center { text-align: center; padding: 40px; }
    .success-icon { font-size: 64px; height: 64px; width: 64px; }
    .workspace-notice { display: flex; align-items: flex-start; gap: 12px; padding: 14px; margin: 24px 0; border: 1px solid color-mix(in srgb, #0d9488 28%, var(--app-border)); border-radius: 14px; background: color-mix(in srgb, #0d9488 9%, var(--app-surface)); }
    .workspace-notice__icon { display: grid; place-items: center; flex: 0 0 38px; height: 38px; border-radius: 11px; color: #fff; background: #0d9488; }
    .workspace-notice__icon mat-icon { width: 20px; height: 20px; font-size: 20px; }
    .notice-content { flex: 1; }
    .notice-content .eyebrow { margin-bottom: 3px; color: #0d9488; font-size: 10px; }
    .notice-content h3 { margin: 0 0 5px; color: var(--app-text); font-size: 14px; font-weight: 800; }
    .notice-content p { margin: 0; color: var(--app-text-muted); font-size: 13px; line-height: 1.5; }

    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
      h1 { font-size: 22px; }
      .pilot-scope-card {
        flex-direction: column;
        align-items: flex-start;
      }
      .pilot-scope-chips {
        justify-content: flex-start;
      }
      .annual-flow-card {
        flex-direction: column;
        align-items: flex-start;
      }
      .annual-flow-chips {
        justify-content: flex-start;
      }
      .wizard-shell { overflow: visible; }
      :host ::ng-deep .wizard-shell .mat-mdc-card-content { overflow: visible; }
      :host ::ng-deep .wizard-shell .mat-stepper-vertical { overflow: visible; }
      :host ::ng-deep .wizard-shell .mat-vertical-stepper-header {
        padding-left: 6px;
      }
      .step-content { padding: 12px 0; }
      .entity-grid { grid-template-columns: 1fr; gap: 10px; }
      .requirements-table-head {
        display: none;
      }
      .requirements-table-row {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .requirements-table-row:not(:last-child) {
        border-bottom: 1px solid var(--app-border);
      }
      .requirements-field,
      .requirements-definition,
      .requirements-validation {
        gap: 4px;
      }
      .requirements-header {
        display: flex;
        flex-direction: column;
      }
      .requirements-table {
        border-radius: 12px;
      }
      .drop-zone { padding: 24px 12px; min-height: 130px; }
      .drop-icon { font-size: 38px; height: 38px; width: 38px; }
      .step-actions { flex-direction: column; align-items: stretch; gap: 8px; }
      .ml-8 { margin-left: 0; }
      .step-actions button { width: 100%; justify-content: center; }
      .file-preview { width: 100%; justify-content: space-between; }
      .center { padding: 20px 8px; }
      .workspace-notice { padding: 12px; }
    }
  `, `
    :host{display:block;color:var(--app-text)}.submission-page{display:grid;gap:16px}
    .page-header{position:relative;overflow:hidden;align-items:center;margin:0;padding:31px 34px;border:1px solid color-mix(in srgb,#2563eb 24%,var(--app-border));border-radius:24px;background:linear-gradient(125deg,color-mix(in srgb,var(--app-surface) 96%,#2563eb),color-mix(in srgb,var(--app-surface) 88%,#ccfbf1));box-shadow:var(--app-shadow-soft)}.page-header:after{content:'';position:absolute;right:17%;top:-180px;width:290px;height:290px;border:62px solid color-mix(in srgb,#2563eb 7%,transparent);border-radius:50%;pointer-events:none}.header-copy,.back-link{position:relative;z-index:1}.header-copy{max-width:850px}.eyebrow{display:flex;align-items:center;gap:6px;margin:0 0 8px;color:#2563eb;font-size:10px;font-weight:900;letter-spacing:.09em}.eyebrow mat-icon{width:17px;height:17px;font-size:17px}h1{margin:0;color:var(--app-text);font-size:clamp(36px,4.5vw,56px);font-weight:770;letter-spacing:-.055em;line-height:1}.page-intro{max-width:780px;margin:14px 0 0;color:var(--app-text-muted);font-size:14px;line-height:1.6}.back-link{min-height:40px;padding:0 13px;border-color:color-mix(in srgb,#2563eb 30%,var(--app-border));border-radius:11px;color:var(--app-text);background:color-mix(in srgb,var(--app-surface) 88%,#dbeafe);font-size:11px;font-weight:850}
    .context-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pilot-scope-card,.annual-flow-card{display:grid;grid-template-columns:43px minmax(0,1fr);align-items:start;gap:12px;margin:0;padding:16px;border:1px solid var(--app-border);border-radius:18px;background:var(--app-surface-elevated);box-shadow:none}.context-icon{display:grid;place-items:center;width:43px;height:43px;color:#0f8f87;border-radius:13px;background:color-mix(in srgb,#14b8a6 13%,transparent)}.context-icon--review{color:#2563eb;background:color-mix(in srgb,#3b82f6 12%,transparent)}.context-icon mat-icon{width:23px;height:23px;font-size:23px}.pilot-scope-copy h2,.annual-flow-copy h3{margin:0;color:var(--app-text);font-size:17px;font-weight:800;letter-spacing:-.025em}.pilot-scope-copy p,.annual-flow-copy p{max-width:none;margin:5px 0 0;color:var(--app-text-muted);font-size:10px;line-height:1.5}.pilot-scope-chips,.annual-flow-chips{grid-column:1/-1;justify-content:flex-start;gap:5px}.scope-chip,.flow-chip{padding:4px 7px;border-color:var(--app-border);color:var(--app-text-muted);background:var(--app-soft-surface);font-size:8px;font-weight:850}.annual-flow-card .flow-chip{color:#2563eb}
    .wizard-shell{overflow:hidden;margin:0;border:1px solid color-mix(in srgb,#2563eb 20%,var(--app-border));border-radius:22px;background:var(--app-surface-elevated);box-shadow:var(--app-shadow-soft)}.wizard-intro{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px 16px;border-bottom:1px solid var(--app-border)}.wizard-intro>div{display:grid;gap:2px}.wizard-intro span{color:#2563eb;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.09em}.wizard-intro h2{margin:0;color:var(--app-text);font-size:22px;letter-spacing:-.035em}.wizard-intro small{display:flex;align-items:center;gap:5px;padding:7px 10px;color:#0f766e;border-radius:999px;background:color-mix(in srgb,#14b8a6 10%,transparent);font-size:9px;font-weight:850}.wizard-intro small mat-icon{width:14px;height:14px;font-size:14px}:host ::ng-deep .wizard-shell .mat-mdc-card-content{padding:0!important}:host ::ng-deep .wizard-shell .mat-stepper-horizontal{background:transparent}:host ::ng-deep .wizard-shell .mat-horizontal-stepper-header-container{gap:8px;padding:13px 18px;border-bottom:1px solid var(--app-border);background:var(--app-soft-surface)}:host ::ng-deep .wizard-shell .mat-step-header{height:48px;padding:0 14px;border:1px solid transparent;border-radius:12px}:host ::ng-deep .wizard-shell .mat-step-header[aria-selected="true"]{border-color:color-mix(in srgb,#2563eb 28%,var(--app-border));background:var(--app-surface);box-shadow:0 5px 14px rgba(15,23,42,.06)}:host ::ng-deep .wizard-shell .mat-step-icon{color:var(--app-text-muted);background:color-mix(in srgb,var(--app-text-muted) 14%,transparent)}:host ::ng-deep .wizard-shell .mat-step-icon-selected,:host ::ng-deep .wizard-shell .mat-step-icon-state-done{color:#fff;background:#2563eb}:host ::ng-deep .wizard-shell .mat-step-label{color:var(--app-text-muted);font-size:11px;font-weight:800}:host ::ng-deep .wizard-shell .mat-step-label-selected{color:var(--app-text)}:host ::ng-deep .wizard-shell .mat-stepper-horizontal-line{border-color:var(--app-border)}:host ::ng-deep .wizard-shell .mat-horizontal-content-container{padding:0 24px 24px}
    .step-content{padding:21px 0 0}.step-subtitle{margin:0 0 16px;color:var(--app-text-muted);font-size:12px}.entity-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;max-width:none;margin-bottom:18px}.entity-card{--entity-accent:#0f8f87;position:relative;min-height:126px;padding:15px;border:1px solid var(--app-border);border-radius:15px;background:var(--app-surface);box-shadow:0 5px 14px rgba(15,23,42,.04);transition:transform .18s ease,border-color .18s ease,background .18s ease}.entity-card[data-dataset="PriceList"]{--entity-accent:#2563eb}.entity-card[data-dataset="Description"]{--entity-accent:#b45309}.entity-card[data-dataset="CurrencyRate"]{--entity-accent:#15803d}.entity-card:after{content:'';position:absolute;inset:auto 14px -1px;height:3px;border-radius:3px 3px 0 0;background:transparent}.entity-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--entity-accent) 42%,var(--app-border));background:color-mix(in srgb,var(--entity-accent) 4%,var(--app-surface))}.entity-card.selected{border-color:var(--entity-accent);background:color-mix(in srgb,var(--entity-accent) 8%,var(--app-surface));box-shadow:0 10px 24px color-mix(in srgb,var(--entity-accent) 12%,transparent)}.entity-card.selected:after{background:var(--entity-accent)}.entity-card mat-icon{margin-bottom:6px;color:var(--entity-accent)}.entity-label{color:var(--app-text);font-size:13px;font-weight:850}.entity-desc{color:var(--app-text-muted);font-size:10px}
    .requirements-panel{margin:0 0 17px;padding:0;border-color:var(--app-border);border-radius:15px;background:var(--app-surface);overflow:hidden}.requirements-header{align-items:center;margin:0;padding:14px 16px;border-bottom:1px solid var(--app-border);background:var(--app-soft-surface)}.requirements-header h3{font-size:14px}.requirements-header p{font-size:10px}.requirements-header button{min-height:36px;border-radius:9px;font-size:10px;font-weight:850}.requirements-table{border:0;border-radius:0}.requirements-table-head{padding:9px 14px;font-size:8px}.requirements-table-row{padding:11px 14px}.requirements-name{font-size:10px}.requirements-type,.badge{font-size:8px}.requirements-meta,.requirements-example{font-size:9px}
    .upload-hint{margin-bottom:12px;padding:10px 12px;border-color:color-mix(in srgb,#2563eb 24%,var(--app-border));border-radius:10px;background:color-mix(in srgb,#2563eb 7%,var(--app-surface));font-size:10px}.drop-zone{min-height:220px;padding:32px;border:1.5px dashed color-mix(in srgb,#2563eb 44%,var(--app-border));border-radius:17px;background:radial-gradient(circle at 50% 35%,color-mix(in srgb,#2563eb 8%,transparent),transparent 48%),var(--app-surface);transition:transform .18s ease,border-color .18s ease,background .18s ease}.drop-zone:hover,.drop-zone.drag-over{transform:translateY(-2px);border-color:#2563eb;background:color-mix(in srgb,#2563eb 6%,var(--app-surface))}.drop-icon{width:54px;height:54px;color:#2563eb;font-size:54px}.drop-zone p{margin:2px 0;color:var(--app-text);font-size:12px}.hint{font-size:9px}.file-preview{max-width:560px;padding:13px;border-radius:12px;background:var(--app-soft-surface)}.workspace-notice{margin:15px 0;padding:12px;border-radius:12px}.notice-content h3{font-size:12px}.notice-content p{font-size:10px}.step-actions{justify-content:flex-end;gap:7px;margin-top:18px}.step-actions .ml-8{margin:0}.step-actions button[mat-raised-button],.step-actions button[mat-stroked-button]{min-height:40px;border-radius:10px;font-size:11px;font-weight:850}.center{padding:48px 12px}.center h2{color:var(--app-text);font-size:25px}.center p{max-width:560px;margin:0 auto 20px;color:var(--app-text-muted)}
    :host-context(html.theme-dark) .back-link{background:color-mix(in srgb,#2563eb 12%,var(--app-surface))}:host-context(html.theme-dark) .annual-flow-card .flow-chip{color:#93c5fd}
    @media(max-width:1100px){.entity-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.context-grid{grid-template-columns:1fr}.pilot-scope-card,.annual-flow-card{grid-template-columns:43px minmax(0,1fr) auto}.pilot-scope-chips,.annual-flow-chips{grid-column:auto;align-self:center;justify-content:flex-end}.requirements-table-head,.requirements-table-row{grid-template-columns:minmax(150px,1fr) minmax(190px,1.2fr) minmax(180px,1fr)}}
    @media(max-width:768px){.submission-page{gap:12px}.page-header{padding:24px 19px;border-radius:20px}.page-header:after{display:none}h1{font-size:37px}.page-intro{font-size:12px}.back-link{width:100%;justify-content:center}.pilot-scope-card,.annual-flow-card{grid-template-columns:39px minmax(0,1fr);padding:13px}.context-icon{width:39px;height:39px}.pilot-scope-chips,.annual-flow-chips{grid-column:1/-1;display:flex;overflow-x:auto;flex-wrap:nowrap;justify-content:flex-start;padding-bottom:2px;scrollbar-width:none}.wizard-intro{align-items:flex-start;padding:17px;flex-direction:column}.wizard-intro h2{font-size:19px}:host ::ng-deep .wizard-shell .mat-mdc-card-content{padding:0 15px 16px!important}:host ::ng-deep .wizard-shell .mat-stepper-vertical{background:transparent}:host ::ng-deep .wizard-shell .mat-vertical-stepper-header{height:51px;padding:0 7px}:host ::ng-deep .wizard-shell .mat-vertical-content-container{margin-left:18px}:host ::ng-deep .wizard-shell .mat-vertical-content{padding:0 0 19px 13px}.step-content{padding:8px 0 0}.entity-grid{grid-template-columns:1fr 1fr;gap:7px}.entity-card{min-height:118px;padding:12px}.requirements-header{align-items:stretch}.drop-zone{min-height:155px;padding:22px 12px}.step-actions{align-items:stretch}.center{padding:30px 5px}}
    @media(max-width:470px){h1{font-size:33px}.entity-grid{grid-template-columns:1fr}.entity-card{min-height:105px}.requirements-table-row{padding:10px}.step-actions{flex-direction:column}.step-actions button{width:100%}}
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
  requirementsByType: Partial<Record<EntityType, DatasetRequirement>> = {};
  readonly pilotScope = PILOT_SCOPE;

  get isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  get selectedRequirement(): DatasetRequirement | undefined {
    if (!this.selectedType) {
      return undefined;
    }

    const requirement = this.requirementsByType[this.selectedType];
    if (!requirement) {
      return undefined;
    }

    return {
      ...requirement,
      displayName: getDatasetDefinition(this.selectedType).name
    };
  }

  requirementRows(requirement: DatasetRequirement): Array<{
    name: string;
    required: boolean;
    dataType: string;
    description: string;
    example: string | null;
    rule: string;
    severity: string;
  }> {
    return requirement.columns.map(column => {
      const rule = requirement.validationRules.find(item => item.field.toLowerCase() === column.name.toLowerCase());
      return {
        name: column.name,
        required: column.required,
        dataType: column.dataType,
        description: column.description,
        example: column.example,
        rule: rule ? this.displayRule(rule.field, rule.rule) : 'No additional validation rule defined.',
        severity: rule?.severity ?? (column.required ? 'Error' : 'Info')
      };
    });
  }

  constructor() {
    this.loadDatasetRequirements();

    const dataset = this.route.snapshot.queryParamMap.get('dataset') as EntityType | null;
    if (dataset && DATASET_CATALOG.some(item => item.key === dataset)) {
      this.setSelectedType(dataset);
    } else {
      this.setSelectedType('Article');
    }
  }

  setSelectedType(type: EntityType) {
    this.selectedType = type;
    this.selectedFile = null;
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
