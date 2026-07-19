import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ImportService } from '../../core/services/import.service';
import { ApprovedComparisonSnapshot, ComparisonFieldChange, ComparisonMissingItem, ComparisonRow, ComparisonStatus, DatasetRequirement, ImportComparison, ImportJob, PagedResult, PortfolioReadiness, RowStatus, StagingRow } from '../../core/models/import.models';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { AuthFacade } from '../../core/auth/auth.facade';
import { AnnualCommitConfirmDialogComponent } from './annual-commit-confirm-dialog.component';
import { ApprovalRecordComponent } from './approval-record.component';
import { PublicationApprovalDraft, PublicationReadinessComponent } from './publication-readiness.component';
import { PublicationConfirmDialogComponent } from './publication-confirm-dialog.component';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DraftEditorMode, DraftRowEditorComponent } from './draft-row-editor.component';
import { DependencyContextPrototypeComponent } from './dependency-context.component';
import { RenameUploadDialogComponent } from '../../shared/rename-upload-dialog/rename-upload-dialog.component';
import { PortfolioReadinessComponent } from './portfolio-readiness.component';
import { ArticleReleaseBuilderComponent } from './article-release-builder.component';

@Component({
  selector: 'app-import-preview',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatChipsModule, MatProgressSpinnerModule, MatPaginatorModule,
    MatTabsModule, MatDialogModule, MatSnackBarModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDividerModule, MatCheckboxModule,
    StatusBadgeComponent, AnnualCommitConfirmDialogComponent, ApprovalRecordComponent,
    PublicationReadinessComponent, PublicationConfirmDialogComponent, DraftRowEditorComponent,
    DependencyContextPrototypeComponent, PortfolioReadinessComponent, ArticleReleaseBuilderComponent],
  template: `
    <div class="page-header">
      <div>
        <a mat-button routerLink="/uploads" class="back-btn">
          <mat-icon>arrow_back</mat-icon> Uploads
        </a>
        <div class="upload-name-row" *ngIf="job">
          <h1>{{ job.originalFileName }}</h1>
          <button
            *ngIf="canRenameUpload()"
            mat-icon-button
            class="rename-upload"
            [disabled]="workflowActionRunning"
            matTooltip="Rename upload"
            aria-label="Rename upload"
            (click)="renameUpload()">
            <mat-icon>edit</mat-icon>
          </button>
        </div>
        <div class="page-context" *ngIf="job">
          <span>{{ job.entityTypeLabel }}</span><i></i>
          <span>{{ detailStatusLabel }}</span><i></i>
          <span>{{ job.createdByDisplayName }}</span>
        </div>
      </div>
      <div class="header-actions" *ngIf="job">
        <button mat-stroked-button class="header-action-btn action-original" (click)="downloadOriginal()" matTooltip="Download original file">
          <mat-icon>download</mat-icon> Original
        </button>
        <button
          mat-stroked-button
          class="header-action-btn action-working-copy"
          *ngIf="isPrivateWorkspace"
          [disabled]="!hasDraftChanges"
          (click)="downloadWorkingCopy()"
          [matTooltip]="hasDraftChanges ? 'Download the original file with your draft changes applied' : 'Make a draft change to enable this export'">
          <mat-icon>file_download</mat-icon> Working copy
        </button>
        <button mat-stroked-button class="header-action-btn action-error" *ngIf="job.errorRows > 0" (click)="downloadErrors()" matTooltip="Download error report">
          <mat-icon>error_outline</mat-icon> Error Report
        </button>
        <button
          mat-stroked-button
          class="header-action-btn action-comparison"
          *ngIf="canDownloadComparisonReport()"
          (click)="downloadComparisonReport()"
          matTooltip="Download comparison report for detected differences">
          <mat-icon>difference</mat-icon> Comparison Report
        </button>
        <button
          mat-stroked-button
          class="header-action-btn action-refresh"
          *ngIf="canRefreshValidation()"
          [disabled]="refreshingValidation"
          (click)="refreshValidation(true)"
          matTooltip="Recheck against the latest master data">
          <mat-icon *ngIf="!refreshingValidation">refresh</mat-icon>
          <mat-spinner *ngIf="refreshingValidation" diameter="16"></mat-spinner>
          Refresh validation
        </button>
      </div>
    </div>

    <div class="loading-container" *ngIf="loading && !job">
      <mat-spinner diameter="40"></mat-spinner>
    </div>

    <ng-container *ngIf="job">
      <section class="workbench-health" aria-label="Dataset workbench status">
        <div class="workbench-health__intro">
          <span class="workbench-live"><i></i>{{ isPrivateWorkspace ? 'Private working session' : 'Governed dataset review' }}</span>
          <strong>{{ isPrivateWorkspace ? 'Work directly on the data' : 'Inspect the exact submitted version' }}</strong>
          <small>Use the health indicators to focus the table without losing the current impact.</small>
        </div>
        <div class="health-metrics">
          <button type="button" class="health-metric health-metric--total" (click)="focusRows()">
            <span>Total</span><strong>{{ job.totalRows }}</strong><small>All rows</small>
          </button>
          <button type="button" class="health-metric health-metric--valid" (click)="focusRows('Valid')">
            <span>Valid</span><strong>{{ job.validRows }}</strong><small>Ready</small>
          </button>
          <button type="button" class="health-metric health-metric--warning" (click)="focusRows('Warning')">
            <span>Warnings</span><strong>{{ job.warningRows }}</strong><small>Review</small>
          </button>
          <button type="button" class="health-metric health-metric--error" [class.health-metric--urgent]="job.errorRows > 0" (click)="focusRows('Error')">
            <span>Errors</span><strong>{{ job.errorRows }}</strong><small>{{ job.errorRows ? 'Blocking' : 'Clear' }}</small>
          </button>
          <button type="button" class="health-metric health-metric--change" *ngIf="comparison" (click)="focusRows('', 'Modified')">
            <span>Modified</span><strong>{{ comparison.modifiedRows }}</strong><small>Changed</small>
          </button>
        </div>
        <button mat-stroked-button type="button" class="evidence-toggle" [class.evidence-toggle--open]="contextExpanded" (click)="toggleContext()">
          <mat-icon>{{ contextExpanded ? 'close' : 'verified_user' }}</mat-icon>
          {{ contextExpanded ? 'Close evidence' : 'Details & evidence' }}
        </button>
      </section>

      <div class="workbench-grid">
        <aside class="impact-rail" [class.impact-rail--mobile-open]="mobileImpactOpen" aria-label="Live dataset impact">
          <header class="impact-rail__header">
            <span><mat-icon>insights</mat-icon></span>
            <div><small>Live impact</small><strong>{{ job.errorRows > 0 ? 'Work remains' : 'Dataset is healthy' }}</strong></div>
            <i [class.impact-ready]="job.errorRows === 0"></i>
            <button mat-icon-button type="button" class="impact-mobile-close" aria-label="Close live impact" (click)="mobileImpactOpen = false"><mat-icon>close</mat-icon></button>
          </header>

          <section class="impact-section">
            <div class="impact-section__title"><span>Validation</span><strong>{{ job.errorRows > 0 ? job.errorRows + ' blocking' : 'Ready' }}</strong></div>
            <div class="impact-progress"><i [style.width.%]="validationReadinessPercent"></i></div>
            <p>{{ job.validRows }} of {{ job.totalRows }} rows are valid<span *ngIf="job.warningRows">; {{ job.warningRows }} need review</span>.</p>
            <button *ngIf="job.errorRows > 0" type="button" class="impact-link impact-link--danger" (click)="focusRows('Error')"><mat-icon>arrow_forward</mat-icon> Open blocking rows</button>
          </section>

          <section class="impact-section" *ngIf="comparison as cmp">
            <div class="impact-section__title"><span>Baseline impact</span><strong>{{ cmp.newRows + cmp.modifiedRows + cmp.missingBaselineRows }} changes</strong></div>
            <div class="impact-change-grid">
              <button type="button" (click)="focusRows('', 'New')"><strong>{{ cmp.newRows }}</strong><span>New</span></button>
              <button type="button" (click)="focusRows('', 'Modified')"><strong>{{ cmp.modifiedRows }}</strong><span>Modified</span></button>
              <button type="button" (click)="openEvidence()"><strong>{{ cmp.missingBaselineRows }}</strong><span>Missing</span></button>
            </div>
            <p>Compared with {{ cmp.hasBaseline ? 'the approved baseline' : 'the initial submission context' }}.</p>
          </section>

          <section class="impact-section" *ngIf="isPortfolioDataset && portfolioReadiness">
            <div class="impact-section__title"><span>Portfolio consistency</span><strong [class.impact-alert]="portfolioReadiness.requiresCoordinatedRelease">{{ portfolioReadiness.isConsistent ? 'Aligned' : 'Release required' }}</strong></div>
            <p *ngIf="portfolioReadiness.isConsistent">The projected Article Master and Price List remain aligned.</p>
            <p *ngIf="!portfolioReadiness.isConsistent">Related datasets must be coordinated before this version can be submitted.</p>
            <button *ngIf="portfolioReadiness.requiresCoordinatedRelease" type="button" class="impact-link" (click)="focusReleaseWorkflow()"><mat-icon>account_tree</mat-icon> Prepare coordinated release</button>
          </section>

          <section class="impact-action">
            <ng-container *ngIf="isPrivateWorkspace">
              <button *ngIf="job.errorRows > 0" mat-raised-button color="primary" (click)="focusRows('Error')"><mat-icon>build</mat-icon> Fix {{ job.errorRows }} blocking rows</button>
              <button *ngIf="job.statusLabel === 'AwaitingApproval' && job.errorRows === 0 && !job.releasePackageId" mat-raised-button color="primary" [disabled]="workflowActionRunning || !canSubmitProjectedState" (click)="submitForReview()"><mat-icon>send</mat-icon>{{ canSubmitProjectedState ? 'Submit for review' : 'Release required' }}</button>
              <button *ngIf="job.releasePackageId" mat-raised-button color="primary" (click)="openEvidence('dependency-workflow')"><mat-icon>account_tree</mat-icon> Open release controls</button>
            </ng-container>
            <button *ngIf="isSubmittedOwner && !job.releasePackageId" mat-stroked-button [disabled]="workflowActionRunning" (click)="withdrawFromReview()"><mat-icon>undo</mat-icon> Withdraw submission</button>
            <ng-container *ngIf="canShowApprovalGate">
              <button *ngIf="auth.hasCapability('imports.approve')" mat-raised-button color="primary" [disabled]="approving" (click)="approveForPublication()"><mat-icon>verified</mat-icon> Approve for publication</button>
              <button *ngIf="auth.hasCapability('imports.reject')" mat-stroked-button color="warn" (click)="openDecisionPanel()"><mat-icon>close</mat-icon> Return for correction</button>
            </ng-container>
            <button mat-button type="button" class="impact-evidence-link" (click)="openEvidence()"><mat-icon>fact_check</mat-icon> View full context and evidence</button>
          </section>
        </aside>

        <section class="context-zone" [class.context-zone--open]="contextExpanded">
          <header class="context-zone__header">
            <div><span>Governance context</span><strong>Details, dependencies and decision evidence</strong></div>
            <button mat-icon-button type="button" aria-label="Close details and evidence" (click)="toggleContext()"><mat-icon>close</mat-icon></button>
          </header>
      <!-- Job summary -->
      <mat-card class="summary-card">
        <mat-card-content>
          <div class="summary-grid-metadata">
            <div class="summary-item">
              <div class="label">Status</div>
              <span
                *ngIf="isPrivateWorkspace || isSubmittedOwner; else governedStatus"
                class="workflow-status-pill"
                [class.workflow-status-pill--shared]="isSubmittedOwner">
                <mat-icon>{{ isPrivateWorkspace ? 'lock' : 'group' }}</mat-icon>
                {{ detailStatusLabel }}
              </span>
              <ng-template #governedStatus><app-status-badge [status]="job.statusLabel" /></ng-template>
            </div>
            <div class="summary-item">
              <div class="label">Dataset</div>
              <div class="value">{{ job.entityTypeLabel }}</div>
            </div>
            <div class="summary-item">
              <div class="label">Uploaded By</div>
              <div class="value">{{ job.createdByDisplayName }}</div>
            </div>
            <div class="summary-item">
              <div class="label">Date</div>
              <div class="value">{{ job.createdAt | date:'dd/MM/yyyy HH:mm' }}</div>
            </div>
          </div>

          <mat-divider style="margin: 12px 0;"></mat-divider>

          <div class="summary-grid-stats">
            <div class="summary-item">
              <div class="label">Total Rows</div>
              <div class="value">{{ job.totalRows }}</div>
            </div>
            <div class="summary-item">
              <div class="label">Valid</div>
              <div class="value valid-count">{{ job.validRows }}</div>
            </div>
            <div class="summary-item">
              <div class="label">Warnings</div>
              <div class="value warning-count">{{ job.warningRows }}</div>
            </div>
            <div class="summary-item">
              <div class="label">Errors</div>
              <div class="value error-count">{{ job.errorRows }}</div>
            </div>
          </div>

          <div class="criteria-box" *ngIf="datasetRequirement?.validationRules?.length">
            <div class="criteria-title">
              <mat-icon>rule</mat-icon>
              Validation criteria for {{ job.entityTypeLabel }}
            </div>
            <ul class="criteria-list">
              <li *ngFor="let rule of datasetRequirement?.validationRules || []">
                <strong>{{ rule.field }}</strong>: {{ rule.rule }}
              </li>
            </ul>
          </div>

          <!-- Rejection reason -->
          <div class="rejection-box" *ngIf="job.statusLabel === 'Rejected'">
            <mat-icon color="warn">cancel</mat-icon>
            <div>
              <strong>Rejected by {{ job.rejectedBy }}</strong> on {{ job.rejectedAt | date:'dd/MM/yyyy HH:mm' }}
              <div class="rejection-reason">{{ job.rejectionReason }}</div>
            </div>
          </div>

          <!-- Commit info -->
          <div class="commit-box" *ngIf="job.statusLabel === 'Committed'">
            <mat-icon style="color:#2e7d32">check_circle</mat-icon>
            <div>
              <strong>Published by {{ job.committedBy }}</strong> on {{ job.committedAt | date:'dd/MM/yyyy HH:mm' }}
              - {{ job.committedRows }} rows written to CPQ.
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <app-portfolio-readiness
        *ngIf="isPrivateWorkspace && isPortfolioDataset && !job.releasePackageId"
        [jobId]="job.id"
        [refreshKey]="portfolioRefreshKey"
        [isArticleMaster]="job.entityType === 1"
        (readinessChanged)="portfolioReadiness = $event"
        (createReleaseRequested)="focusReleaseWorkflow()" />

      <app-article-release-builder
        *ngIf="isPrivateWorkspace && job.entityType === 1 && !job.releasePackageId && portfolioReadiness?.requiresCoordinatedRelease"
        [jobId]="job.id"
        [articleCount]="job.totalRows"
        (releaseCreated)="handleArticleReleaseCreated()" />

      <app-dependency-context-prototype
        id="dependency-workflow"
        *ngIf="(isDependentDataset && isPrivateWorkspace) || !!job.releasePackageId"
        [datasetName]="job.entityTypeLabel"
        [fileName]="job.originalFileName"
        [totalRows]="job.totalRows"
        [errorCount]="job.errorRows"
        [jobId]="job.id"
        (jobChanged)="handleDependencyJobChanged($event)" />

      <app-approval-record
        *ngIf="job.statusLabel === 'Approved' || job.statusLabel === 'Committed'"
        [snapshot]="approvalSnapshot"
        [loading]="approvalSnapshotLoading" />

      <mat-card class="comparison-card">
        <mat-card-content>
          <ng-container *ngIf="job?.isActiveBaseline; else comparisonDetails">
            <div class="comparison-header comparison-header--active">
              <div class="comparison-copy">
                <div class="label">Baseline status</div>
                <div class="comparison-title-row">
                  <h3>Approved version currently in force</h3>
                  <span class="comparison-status-pill">Active baseline</span>
                </div>
                <p>
                  This upload is the current approved baseline. The approval record above captures the exact state that was signed off.
                </p>
              </div>
            </div>
          </ng-container>

          <ng-template #comparisonDetails>
            <div class="comparison-header">
              <div class="comparison-copy">
                <div class="label">
                  {{ job.statusLabel === 'Committed'
                    ? 'Current baseline comparison'
                    : (comparison?.hasBaseline ? 'Annual update comparison' : 'Initial baseline submission') }}
                </div>
                <h3>
                  {{ job.statusLabel === 'Committed'
                    ? 'Recalculated against the latest approved baseline'
                    : (comparison?.hasBaseline
                      ? 'Compared against the latest approved baseline'
                      : 'This submission establishes the approved baseline') }}
                </h3>
                <p *ngIf="comparison?.hasBaseline; else noBaselineMessage">
                  <ng-container *ngIf="job.statusLabel === 'Committed'; else pendingComparisonCopy">
                    This live comparison can change as newer uploads are committed. Use the approval record above for the exact situation accepted by the approver.
                  </ng-container>
                  <ng-template #pendingComparisonCopy>
                    This pilot treats the upload as a new annual submission, then compares it to the last approved baseline.
                    Approvers focus on new, modified, and missing rows instead of reviewing every row from scratch.
                  </ng-template>
                </p>
                <div *ngIf="activeBaselineLink() as baselineLink" class="baseline-link-wrap">
                  <a mat-button class="baseline-link-btn" [routerLink]="baselineLink">
                    <mat-icon>timeline</mat-icon>
                    Open active baseline
                  </a>
                </div>
              </div>
              <ng-container *ngIf="comparison as cmp; else comparisonStatus">
                <div class="baseline-focus">
                  <div class="baseline-focus__head">
                    <div class="baseline-focus__eyebrow">Baseline focus</div>
                    <div
                      *ngIf="comparison?.hasBaseline && comparison?.baselineJobId === job?.id"
                      class="baseline-focus__pill">
                      Active baseline
                    </div>
                  </div>
                  <div class="baseline-focus__title">
                    {{ cmp.hasBaseline ? 'Latest approved version' : 'First approved submission' }}
                  </div>
                  <div class="baseline-focus__body">
                    {{ cmp.hasBaseline
                      ? 'Use this upload as the comparison anchor for future annual updates.'
                      : 'This upload becomes the anchor for future annual updates.' }}
                  </div>
                </div>
              </ng-container>
            </div>

            <div *ngIf="comparison as cmp" class="comparison-metrics">
              <div class="comparison-metric metric-new">
                <div class="comparison-metric__label">New</div>
                <strong class="comparison-metric__value">{{ cmp.newRows }}</strong>
              </div>
              <div class="comparison-metric metric-modified">
                <div class="comparison-metric__label">Modified</div>
                <strong class="comparison-metric__value">{{ cmp.modifiedRows }}</strong>
              </div>
              <div class="comparison-metric metric-unchanged">
                <div class="comparison-metric__label">Unchanged</div>
                <strong class="comparison-metric__value">{{ cmp.unchangedRows }}</strong>
              </div>
              <div class="comparison-metric metric-missing">
                <div class="comparison-metric__label">Missing</div>
                <strong class="comparison-metric__value">{{ cmp.missingBaselineRows }}</strong>
              </div>
            </div>

            <ng-template #comparisonStatus>
              <div class="comparison-loading" *ngIf="comparisonLoading">
                <mat-icon>hourglass_empty</mat-icon>
                <span>Loading baseline comparison...</span>
              </div>
              <div class="comparison-loading" *ngIf="!comparisonLoading">
                <mat-icon>info</mat-icon>
                <span>
                  The comparison summary is not available yet. The upload will still be treated as an annual baseline review.
                </span>
              </div>
            </ng-template>

            <ng-template #noBaselineMessage>
              This is the first approved submission for this dataset. It will become the baseline for future annual submissions.
            </ng-template>

            <div class="comparison-missing" *ngIf="comparison?.missingRows?.length">
              <div class="comparison-missing-title">Missing from this upload</div>
              <div class="comparison-missing-list">
                <span class="comparison-missing-item" *ngFor="let missing of comparison!.missingRows">
                  {{ missing.key }}
                </span>
              </div>
            </div>
          </ng-template>
        </mat-card-content>
      </mat-card>

      <mat-card class="correction-card" *ngIf="!isPrivateWorkspace && (job.statusLabel === 'NeedsCorrection' || (job.statusLabel === 'AwaitingApproval' && job.errorRows > 0))">
        <div class="correction-copy">
          <mat-icon>error_outline</mat-icon>
          <div>
            <strong>Errors detected in this file</strong>
            <div>{{ job.errorRows }} blocking rows need correction. Fix them here, or cancel this request and upload a corrected file again.</div>
          </div>
        </div>
        <button mat-raised-button color="primary" (click)="showErrorRows()">
          Review errors
        </button>
      </mat-card>

      <mat-card class="cancelled-card" *ngIf="job.statusLabel === 'Cancelled'">
        <div class="cancelled-copy">
          <mat-icon>block</mat-icon>
          <div>
            <strong>Import request cancelled</strong>
            <div>This submission has been withdrawn. Fix the source file and upload a fresh request when ready.</div>
          </div>
        </div>
      </mat-card>

      <mat-card class="workspace-gate workspace-gate--private" *ngIf="isPrivateWorkspace">
        <mat-card-content>
          <div class="workspace-gate__header">
            <div class="workspace-gate__identity">
              <span class="workspace-gate__icon"><mat-icon>lock_person</mat-icon></span>
              <div>
                <div class="workspace-gate__eyebrow">Private workspace</div>
                <h2>{{ privateGateTitle }}</h2>
                <p>{{ privateGateCopy }}</p>
              </div>
            </div>
            <span class="visibility-badge"><mat-icon>visibility_off</mat-icon> Only visible to you</span>
          </div>

          <div class="workflow-rail" aria-label="Upload workflow">
            <div class="workflow-rail__step" [class.workflow-rail__step--active]="job.errorRows > 0" [class.workflow-rail__step--done]="job.errorRows === 0">
              <span>{{ job.errorRows === 0 ? 'check' : '1' }}</span><div><small>Prepare</small><strong>Validate and compare</strong></div>
            </div>
            <mat-icon>arrow_forward</mat-icon>
            <div class="workflow-rail__step" [class.workflow-rail__step--active]="job.errorRows === 0">
              <span>2</span><div><small>Submit</small><strong>Share for review</strong></div>
            </div>
            <mat-icon>arrow_forward</mat-icon>
            <div class="workflow-rail__step"><span>3</span><div><small>Decision</small><strong>Team approval</strong></div></div>
            <mat-icon>arrow_forward</mat-icon>
            <div class="workflow-rail__step"><span>4</span><div><small>Release</small><strong>Publish to CPQ</strong></div></div>
          </div>

          <div class="workspace-gate__impact">
            <mat-icon>{{ job.errorRows > 0 ? 'error_outline' : 'fact_check' }}</mat-icon>
            <div>
              <strong>{{ job.errorRows > 0 ? job.errorRows + ' blocking rows require attention' : 'Your comparison is ready' }}</strong>
              <span *ngIf="comparison; else privateFallback">
                {{ comparison.newRows }} new, {{ comparison.modifiedRows }} modified and {{ comparison.missingBaselineRows }} missing rows were detected.
              </span>
              <ng-template #privateFallback><span>{{ job.totalRows }} rows have been prepared in this private version.</span></ng-template>
            </div>
          </div>

          <div class="workspace-gate__actions">
            <button *ngIf="job.errorRows > 0" mat-raised-button color="primary" (click)="showErrorRows()"><mat-icon>build</mat-icon> Review and fix errors</button>
            <button *ngIf="job.statusLabel === 'AwaitingApproval' && job.errorRows === 0" mat-raised-button color="primary" class="submit-review-btn" [disabled]="workflowActionRunning || !canSubmitProjectedState" (click)="submitForReview()"><mat-icon>send</mat-icon> {{ workflowActionRunning ? 'Submitting...' : (canSubmitProjectedState ? 'Submit for review' : 'Release required') }}</button>
            <button *ngIf="canDownloadComparisonReport()" mat-stroked-button (click)="downloadComparisonReport()"><mat-icon>download</mat-icon> Comparison report</button>
            <button *ngIf="canCancelJob()" mat-button class="discard-draft-btn" (click)="cancelImport()"><mat-icon>delete_outline</mat-icon> Discard private draft</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="workspace-gate workspace-gate--submitted" *ngIf="isSubmittedOwner">
        <mat-card-content>
          <div class="workspace-gate__header">
            <div class="workspace-gate__identity">
              <span class="workspace-gate__icon"><mat-icon>outbox</mat-icon></span>
              <div>
                <div class="workspace-gate__eyebrow">Shared review</div>
                <h2>Submitted to the review team</h2>
                <p>This exact file and comparison are now shared and locked while a decision is pending.</p>
              </div>
            </div>
            <span class="visibility-badge visibility-badge--shared"><mat-icon>groups</mat-icon> Visible in Review Queue</span>
          </div>

          <div class="workflow-rail">
            <div class="workflow-rail__step workflow-rail__step--done"><span>check</span><div><small>Prepare</small><strong>Comparison ready</strong></div></div>
            <mat-icon>arrow_forward</mat-icon>
            <div class="workflow-rail__step workflow-rail__step--done"><span>check</span><div><small>Submit</small><strong>Shared with team</strong></div></div>
            <mat-icon>arrow_forward</mat-icon>
            <div class="workflow-rail__step workflow-rail__step--active"><span>3</span><div><small>Current gate</small><strong>Approval pending</strong></div></div>
            <mat-icon>arrow_forward</mat-icon>
            <div class="workflow-rail__step"><span>4</span><div><small>Next gate</small><strong>Publish to CPQ</strong></div></div>
          </div>

          <div class="submitted-lock-note"><mat-icon>lock</mat-icon><span>Editing is paused to protect the version currently being reviewed. Withdraw it if you need to make changes.</span></div>
          <div class="workspace-gate__actions workspace-gate__actions--submitted">
            <button *ngIf="!job.releasePackageId" mat-stroked-button class="withdraw-review-btn" [disabled]="workflowActionRunning" (click)="withdrawFromReview()"><mat-icon>undo</mat-icon> {{ workflowActionRunning ? 'Withdrawing...' : 'Withdraw submission' }}</button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Approval actions (approvers only, when AwaitingApproval) -->
      <mat-card class="action-card" *ngIf="!job.releasePackageId && (canShowApprovalGate || (job.statusLabel === 'Approved' && canControlPublication))">
        <mat-card-content>
          <ng-container *ngIf="publicationApproval; else approvalReview">
            <app-publication-readiness
              [approval]="publicationApproval"
              [publishing]="committing"
              [canPublish]="auth.hasCapability('imports.publish')"
              [canReturnToReview]="auth.hasCapability('imports.return_to_review')"
              (publish)="publishToCpq()"
              (returnToReview)="returnToReview()" />
          </ng-container>

          <ng-template #approvalReview>
            <div class="governance-path">
              <div class="governance-path__step governance-path__step--active">
                <span>1</span><div><small>Current gate</small><strong>Review and approve</strong></div>
              </div>
              <mat-icon>arrow_forward</mat-icon>
              <div class="governance-path__step">
                <span>2</span><div><small>Next gate</small><strong>Publish to CPQ</strong></div>
              </div>
            </div>

            <div class="action-bar">
              <div class="action-info">
                <mat-icon color="primary">fact_check</mat-icon>
                <span>
                  <strong>Decision responsibility:</strong> Review the comparison, exceptions, and supporting evidence before deciding.
                  <ng-container *ngIf="comparison; else actionFallback">
                    {{ comparison.newRows + comparison.modifiedRows + comparison.unchangedRows }} rows are compared with the baseline.
                    {{ comparison.newRows }} new, {{ comparison.modifiedRows }} modified, and {{ comparison.missingBaselineRows }} missing rows need attention.
                  </ng-container>
                  <ng-template #actionFallback>
                    {{ job.validRows + job.warningRows }} rows are ready for approval
                    <span *ngIf="job.errorRows > 0"> ({{ job.errorRows }} error rows will be skipped)</span>.
                  </ng-template>
                </span>
              </div>
              <div class="action-buttons">
                <button *ngIf="auth.hasCapability('imports.approve')" mat-raised-button color="primary" class="btn-commit" (click)="approveForPublication()" [disabled]="approving">
                  <mat-icon>{{ approving ? 'hourglass_top' : 'verified' }}</mat-icon>
                  {{ approving ? 'Approving...' : 'Approve for publication' }}
                </button>
                <button *ngIf="auth.hasCapability('imports.reject')" mat-stroked-button color="warn" class="btn-reject ml-8" (click)="showRejectPanel = true">
                  <mat-icon>close</mat-icon> Reject
                </button>
              </div>
            </div>

            <div class="reject-panel" *ngIf="showRejectPanel && auth.hasCapability('imports.reject')">
              <mat-divider></mat-divider>
              <div class="reject-form">
                <div class="reject-field">
                  <div class="reject-field__head">
                    <div class="reject-field__label">Rejection reason</div>
                    <div class="reject-field__hint">Tell the uploader what must change before resubmitting.</div>
                  </div>
                  <textarea
                    class="reject-textarea"
                    [(ngModel)]="rejectionReason"
                    rows="3"
                    placeholder="Enter reason..."></textarea>
                </div>
                <div class="reject-actions">
                  <button mat-raised-button color="warn" (click)="reject()" [disabled]="!rejectionReason || rejecting">
                    Confirm Rejection
                  </button>
                  <button mat-button (click)="showRejectPanel = false; rejectionReason = ''" class="ml-8">Cancel</button>
                </div>
              </div>
            </div>
          </ng-template>
        </mat-card-content>
      </mat-card>
        </section>

      <!-- Rows table -->
      <mat-card class="rows-card" id="data-workbench">
        <mat-card-header class="rows-header">
          <div>
            <div class="editor-eyebrow" *ngIf="isPrivateWorkspace">Private working copy</div>
            <mat-card-title>{{ isPrivateWorkspace ? 'Draft data editor' : 'Data Preview' }}</mat-card-title>
            <p *ngIf="isPrivateWorkspace">Refine this dataset here. Nothing is shared until you submit it for review.</p>
          </div>
          <div class="list-meta">{{ rows?.total ?? job.totalRows }} matching rows</div>
        </mat-card-header>

        <mat-card-content>
          <section class="draft-editor-toolbar" *ngIf="isPrivateWorkspace">
            <div class="draft-change-summary">
              <div class="draft-change-heading">
                <span class="draft-live-dot"></span>
                <div><strong>Working draft</strong><small>Changes are local to your private workspace</small></div>
              </div>
              <div class="draft-change-counts">
                <span class="change-added"><strong>{{ job.draftAddedRows }}</strong> added</span>
                <span class="change-modified"><strong>{{ job.draftModifiedRows }}</strong> modified</span>
                <button type="button" class="change-removed" (click)="showRemovedRows = !showRemovedRows">
                  <strong>{{ job.draftRemovedRows }}</strong> removed
                  <mat-icon>{{ showRemovedRows ? 'expand_less' : 'expand_more' }}</mat-icon>
                </button>
              </div>
            </div>

            <div class="draft-command-bar" [class.draft-command-bar--selection]="selectedRowIds.size > 0">
              <div class="selection-copy" *ngIf="selectedRowIds.size; else defaultDraftActions">
                <span>{{ selectedRowIds.size }}</span>
                <div><strong>row{{ selectedRowIds.size === 1 ? '' : 's' }} selected</strong><small>Choose an action for this selection</small></div>
              </div>
              <ng-template #defaultDraftActions>
                <div class="selection-copy selection-copy--quiet">
                  <mat-icon>edit_note</mat-icon>
                  <div><strong>Edit the working data</strong><small>Select rows for batch actions</small></div>
                </div>
              </ng-template>

              <div class="draft-actions">
                <button mat-stroked-button type="button" [disabled]="draftMutationRunning" (click)="openAddRowEditor()">
                  <mat-icon>add</mat-icon> Add row
                </button>
                <button mat-stroked-button type="button" [disabled]="draftMutationRunning || selectedRowIds.size !== 1" (click)="duplicateSelectedRow()">
                  <mat-icon>content_copy</mat-icon> Duplicate
                </button>
                <button mat-stroked-button type="button" class="delete-selection" [disabled]="draftMutationRunning || !selectedRowIds.size" (click)="removeSelectedRows()">
                  <mat-icon>delete_outline</mat-icon> Delete
                </button>
                <button mat-button type="button" *ngIf="selectedRowIds.size" (click)="clearRowSelection()">Clear</button>
              </div>
            </div>

            <div class="removed-rows-tray" *ngIf="showRemovedRows">
              <div class="removed-tray-heading">
                <div><mat-icon>restore_from_trash</mat-icon><span><strong>Removed from this draft</strong><small>These rows can be restored before submission.</small></span></div>
                <div class="removed-tray-actions">
                  <button mat-stroked-button type="button" class="restore-all" *ngIf="removedRows.length" [disabled]="draftMutationRunning" (click)="restoreAllDraftRows()">
                    <mat-icon>settings_backup_restore</mat-icon>
                    Restore all <span>({{ removedRows.length }})</span>
                  </button>
                  <button mat-icon-button type="button" (click)="showRemovedRows = false" aria-label="Close removed rows"><mat-icon>close</mat-icon></button>
                </div>
              </div>
              <div class="removed-row-list" *ngIf="removedRows.length; else noRemovedRows">
                <div *ngFor="let row of removedRows">
                  <span class="removed-row-number">#{{ row.rowNumber }}</span>
                  <strong>{{ primaryRowValue(row) }}</strong>
                  <span>{{ row.statusLabel }}</span>
                  <button mat-button type="button" [disabled]="draftMutationRunning" (click)="restoreDraftRow(row)"><mat-icon>undo</mat-icon> Restore</button>
                </div>
              </div>
              <ng-template #noRemovedRows><div class="removed-empty">No rows have been removed from this working draft.</div></ng-template>
            </div>
          </section>

          <mat-card class="filters-card">
            <form class="filters-toolbar" [formGroup]="filtersForm">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
                <mat-label>Search</mat-label>
                <input matInput formControlName="search" placeholder="Row value, field, or error text" />
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="select-field">
                <mat-label>Status</mat-label>
                <mat-select formControlName="status">
                  <mat-option value="">All statuses</mat-option>
                  <mat-option *ngFor="let status of rowStatusOptions" [value]="status.value">
                    {{ status.label }}
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="select-field" *ngIf="comparison">
                <mat-label>Comparison</mat-label>
                <mat-select formControlName="comparison">
                  <mat-option value="">All comparisons</mat-option>
                  <mat-option *ngFor="let option of comparisonStatusOptions" [value]="option.value">
                    {{ option.label }}
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <div class="filter-actions">
                <button mat-button type="button" (click)="clearFilters()">
                  <mat-icon>filter_alt_off</mat-icon>
                  Clear
                </button>
              </div>
            </form>
          </mat-card>

          <div class="loading-container" *ngIf="rowsLoading">
            <mat-spinner diameter="32"></mat-spinner>
          </div>

          <div class="table-wrapper desktop-rows" *ngIf="rows && !rowsLoading">
            <table mat-table [dataSource]="rows.items">
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef>
                  <mat-checkbox
                    *ngIf="isPrivateWorkspace"
                    [checked]="allVisibleRowsSelected"
                    [indeterminate]="someVisibleRowsSelected"
                    (change)="toggleAllVisibleRows()"
                    aria-label="Select all visible rows" />
                </th>
                <td mat-cell *matCellDef="let row">
                  <mat-checkbox
                    *ngIf="isPrivateWorkspace"
                    [checked]="selectedRowIds.has(row.id)"
                    (click)="$event.stopPropagation()"
                    (change)="toggleRowSelection(row)"
                    [attr.aria-label]="'Select row ' + row.rowNumber" />
                </td>
              </ng-container>

              <ng-container matColumnDef="rowNum">
                <th mat-header-cell *matHeaderCellDef>#</th>
                <td mat-cell *matCellDef="let row">{{ row.rowNumber }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let row">
                  <app-status-badge [status]="row.statusLabel" [small]="true" />
                </td>
              </ng-container>

              <ng-container matColumnDef="comparison">
                <th mat-header-cell *matHeaderCellDef>Comparison</th>
                <td mat-cell *matCellDef="let row">
                  <ng-container *ngIf="comparisonForRow(row) as comparisonRow">
                    <div class="comparison-pill" [ngClass]="'cmp-' + comparisonRow.comparisonStatus.toLowerCase()">
                      <mat-icon>{{ comparisonIcon(comparisonRow.comparisonStatus) }}</mat-icon>
                      <span>{{ comparisonRow.comparisonStatus }}</span>
                    </div>
                    <div class="comparison-detail" *ngIf="comparisonRow.changedFieldCount > 0">
                      {{ comparisonRow.changedFieldCount }} changed field{{ comparisonRow.changedFieldCount === 1 ? '' : 's' }}
                    </div>
                  </ng-container>
                </td>
              </ng-container>

              <ng-container *ngFor="let col of dynamicColumns" [matColumnDef]="col">
                <th mat-header-cell *matHeaderCellDef>{{ col }}</th>
                <td mat-cell *matCellDef="let row" [class.changed-field-cell]="isFieldChanged(row, col)">
                  <div class="field-cell" [class.field-cell--changed]="isFieldChanged(row, col)">
                    <ng-container *ngIf="comparisonChangeForField(row, col) as fieldChange; else plainFieldValue">
                      <span class="field-value field-value--current">
                        {{ row.fields[col] || '-' }}
                      </span>
                      <span class="field-previous" aria-label="Committed baseline value">
                        <span class="field-previous__value">
                          {{ fieldChange.baselineValue || '-' }}
                        </span>
                      </span>
                    </ng-container>
                    <ng-template #plainFieldValue>
                      <span class="field-value">
                        {{ row.fields[col] || '-' }}
                      </span>
                    </ng-template>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="messages">
                <th mat-header-cell *matHeaderCellDef>Validation</th>
                <td mat-cell *matCellDef="let row">
                  <span *ngFor="let m of row.validationMessages" class="validation-msg" [class]="'msg-' + m.severity.toLowerCase()">
                    {{ m.field }}: {{ m.message }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let row">
                  <button
                    mat-icon-button
                    color="primary"
                    *ngIf="canEditRow(row)"
                    (click)="editRow(row); $event.stopPropagation()"
                    matTooltip="Edit row">
                    <mat-icon>edit</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="allColumns; sticky: true"></tr>
              <tr mat-row *matRowDef="let row; columns: allColumns"
                [class.row-selected]="selectedRowIds.has(row.id)"
                [class.row-valid]="row.statusLabel === 'Valid'"
                [class.row-warning]="row.statusLabel === 'Warning'"
                [class.row-error]="row.statusLabel === 'Error'">
              </tr>
            </table>
          </div>

          <div class="mobile-rows" *ngIf="rows && !rowsLoading">
            <article
              class="mobile-row-card"
              *ngFor="let row of rows.items"
              [class.row-selected]="selectedRowIds.has(row.id)"
              [class.row-valid]="row.statusLabel === 'Valid'"
              [class.row-warning]="row.statusLabel === 'Warning'"
              [class.row-error]="row.statusLabel === 'Error'">

              <div class="mobile-row-select" *ngIf="isPrivateWorkspace">
                <mat-checkbox [checked]="selectedRowIds.has(row.id)" (change)="toggleRowSelection(row)" [attr.aria-label]="'Select row ' + row.rowNumber" />
              </div>
              <button type="button" class="mobile-row-toggle" (click)="toggleRow(row.rowNumber)">
                <div class="mobile-row-head">
                  <div>
                    <div class="mobile-row-index">Row #{{ row.rowNumber }}</div>
                    <div class="mobile-primary" *ngIf="getPrimaryColumn(row) as primaryCol">
                      {{ primaryCol }}: {{ row.fields[primaryCol] || '-' }}
                    </div>
                  </div>
                  <div class="mobile-row-right">
                    <app-status-badge [status]="row.statusLabel" [small]="true" />
                    <ng-container *ngIf="comparisonForRow(row) as comparisonRow">
                      <div class="comparison-pill mobile-comparison-pill" [ngClass]="'cmp-' + comparisonRow.comparisonStatus.toLowerCase()">
                        <span>{{ comparisonRow.comparisonStatus }}</span>
                      </div>
                    </ng-container>
                    <mat-icon class="expand-icon" [class.expanded]="isRowExpanded(row.rowNumber)">expand_more</mat-icon>
                  </div>
                </div>
              </button>

              <div class="mobile-row-details" *ngIf="isRowExpanded(row.rowNumber)">
                <div class="mobile-fields" *ngIf="getMobileColumns(row).length > 0">
                  <div class="mobile-field" *ngFor="let col of getMobileColumns(row)">
                    <span class="mobile-field-label">{{ col }}</span>
                    <div class="mobile-field-value-wrap" [class.changed-field-cell]="isFieldChanged(row, col)">
                      <ng-container *ngIf="comparisonChangeForField(row, col) as fieldChange; else plainMobileFieldValue">
                        <span class="mobile-field-value mobile-field-value--current">
                          {{ row.fields[col] || '-' }}
                        </span>
                        <span class="field-previous" aria-label="Committed baseline value">
                          <span class="field-previous__value">
                            {{ fieldChange.baselineValue || '-' }}
                          </span>
                        </span>
                      </ng-container>
                      <ng-template #plainMobileFieldValue>
                        <span class="mobile-field-value">
                          {{ row.fields[col] || '-' }}
                        </span>
                      </ng-template>
                    </div>
                  </div>
                  <div class="mobile-more" *ngIf="remainingFieldCount(row) > 0">
                    +{{ remainingFieldCount(row) }} more fields in desktop table
                  </div>
                </div>

                <div class="mobile-validation" *ngIf="row.validationMessages?.length">
                  <span *ngFor="let m of row.validationMessages" class="validation-msg" [class]="'msg-' + m.severity.toLowerCase()">
                    {{ m.field }}: {{ m.message }}
                  </span>
                </div>

                <div class="mobile-actions" *ngIf="canEditRow(row)">
                  <button mat-stroked-button color="primary" (click)="editRow(row); $event.stopPropagation()">
                    <mat-icon>edit</mat-icon>
                    Edit row
                  </button>
                </div>
              </div>
            </article>
          </div>

          <mat-paginator
            *ngIf="rows"
            [length]="rows.total"
            [pageSize]="rowPageSize"
            [pageSizeOptions]="[25, 50, 100]"
            (page)="onRowPage($event)">
          </mat-paginator>
        </mat-card-content>
      </mat-card>
      </div>

      <div class="mobile-impact-backdrop" *ngIf="mobileImpactOpen" (click)="mobileImpactOpen = false"></div>
      <nav class="mobile-workbench-dock" aria-label="Dataset workbench shortcuts">
        <button type="button" [class.mobile-dock-alert]="job.errorRows > 0" (click)="focusRows(job.errorRows > 0 ? 'Error' : '')">
          <mat-icon>{{ job.errorRows > 0 ? 'error_outline' : 'check_circle' }}</mat-icon>
          <span><strong>{{ job.errorRows }}</strong><small>Errors</small></span>
        </button>
        <button type="button" *ngIf="comparison" (click)="focusRows('', 'Modified')">
          <mat-icon>difference</mat-icon>
          <span><strong>{{ comparison.modifiedRows }}</strong><small>Modified</small></span>
        </button>
        <button type="button" class="mobile-impact-trigger" (click)="mobileImpactOpen = true">
          <mat-icon>insights</mat-icon><span><strong>Live impact</strong><small>Always available</small></span>
        </button>
      </nav>

      <app-draft-row-editor
        *ngIf="activeDraftEditorMode"
        [mode]="activeDraftEditorMode"
        [row]="activeDraftEditorRow"
        [columns]="datasetRequirement?.columns || []"
        [fallbackFields]="dynamicColumns"
        [saving]="draftMutationRunning"
        (saved)="applyDraftRowChange($event)"
        (cancel)="closeDraftEditor()" />
    </ng-container>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .back-btn { margin-bottom: 4px; }
    h1 { margin: 0; font-size: 20px; font-weight: 400; }
    .upload-name-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
    .upload-name-row h1 { overflow-wrap: anywhere; }
    .rename-upload { flex: none; width: 34px; height: 34px; color: var(--app-accent); }
    .rename-upload mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .header-actions { display: flex; gap: 8px; margin-top: 24px; align-items: center; }
    .header-action-btn {
      border-radius: 999px;
      min-height: 36px;
      font-weight: 700;
      letter-spacing: 0.01em;
      border-color: #cbd5e1 !important;
      color: #334155 !important;
      background: #f8fafc;
    }
    .header-action-btn mat-icon { margin-right: 4px; }
    .header-action-btn:hover { background: #f1f5f9; }
    .action-original {
      border-color: #bfdbfe !important;
      color: #1d4ed8 !important;
      background: #eff6ff;
    }
    .action-original:hover { background: #dbeafe; }
    .action-working-copy {
      border-color: #99f6e4 !important;
      color: #0f766e !important;
      background: #f0fdfa;
    }
    .action-working-copy:hover:not(:disabled) { background: #ccfbf1; }
    .action-working-copy:disabled { opacity: .48; }
    .action-comparison {
      border-color: #bbf7d0 !important;
      color: #166534 !important;
      background: #f0fdf4;
    }
    .action-comparison:hover { background: #dcfce7; }
    .action-error {
      border-color: #fecaca !important;
      color: #b91c1c !important;
      background: #fef2f2;
    }
    .action-error:hover { background: #fee2e2; }
    .action-cancel {
      border-color: #fed7aa !important;
      color: #c2410c !important;
      background: #fff7ed;
    }
    .action-cancel:hover { background: #ffedd5; }
    .workflow-status-pill { display:inline-flex; align-items:center; gap:6px; width:max-content; padding:6px 10px; border:1px solid #99f6e4; border-radius:999px; color:#0f766e; background:#f0fdfa; font-size:12px; font-weight:800; }
    .workflow-status-pill mat-icon { width:16px; height:16px; font-size:16px; line-height:16px; }
    .workflow-status-pill--shared { color:#1d4ed8; border-color:#bfdbfe; background:#eff6ff; }
    .loading-container { display: flex; justify-content: center; padding: 60px; }
    .summary-card { margin-bottom: 16px; border: 1px solid #e2e8f0; box-shadow: none; }
    .summary-grid-metadata, .summary-grid-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .summary-item {
      padding: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #f8fafc;
      min-width: 0;
    }
    .summary-item .label { font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 5px; font-weight: 700; letter-spacing: 0.03em; }
    .summary-item .value { font-size: 17px; font-weight: 700; color: #334155; word-break: break-word; }
    .summary-item .valid-count { color: #2e7d32; }
    .summary-item .warning-count { color: #f57f17; }
    .summary-item .error-count { color: #c62828; }
    .comparison-card {
      margin-bottom: 16px;
      border: 1px solid #dbe4f0;
      box-shadow: none;
      background: #fff;
    }
    .comparison-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .comparison-copy {
      min-width: 0;
      flex: 1;
    }
    .comparison-copy h3 {
      margin: 6px 0 8px;
      font-size: 18px;
      line-height: 1.3;
      color: #0f172a;
    }
    .comparison-copy p {
      margin: 0;
      color: #475569;
      line-height: 1.55;
    }
    .comparison-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .comparison-status-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid #86efac;
      background: #ecfdf5;
      color: #166534;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .criteria-box {
      margin-top: 14px;
      padding: 10px 12px;
      border: 1px solid #dbeafe;
      background: #eff6ff;
      border-radius: 10px;
    }
    .criteria-title {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #1e3a8a;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .criteria-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }
    .criteria-list {
      margin: 0;
      padding-left: 18px;
      color: #1e3a8a;
      display: grid;
      gap: 4px;
      font-size: 13px;
      line-height: 1.4;
    }
    .rejection-box, .commit-box { display: flex; align-items: flex-start; gap: 12px; margin-top: 16px; padding: 12px; border-radius: 4px; background: #fff3e0; }
    .rejection-box { background: #ffebee; }
    .commit-box { background: #e8f5e9; }
    .rejection-reason { color: rgba(0,0,0,0.7); margin-top: 4px; }
    .correction-card {
      margin-bottom: 16px;
      border: 1px solid #fed7aa;
      box-shadow: none;
      background: #fffaf0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 16px;
    }
    .correction-copy { display: flex; align-items: center; gap: 12px; color: #7c2d12; }
    .correction-copy mat-icon { color: #ea580c; }
    .cancelled-card {
      margin-bottom: 16px;
      border: 1px solid #e5e7eb;
      box-shadow: none;
      background: #f8fafc;
      padding: 14px 16px;
    }
    .cancelled-copy { display: flex; align-items: center; gap: 12px; color: #334155; }
    .cancelled-copy mat-icon { color: #64748b; }
    .correction-copy mat-icon,
    .cancelled-copy mat-icon {
      width: 22px;
      height: 22px;
      min-width: 22px;
      font-size: 22px;
      line-height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      flex-shrink: 0;
    }
    .action-card { margin-bottom: 16px; border: 1px solid #dbe4f0; box-shadow: none; }
    .workspace-gate { margin-bottom:16px; border-radius:18px; box-shadow:0 12px 30px rgba(15,23,42,.07); overflow:hidden; }
    .workspace-gate--private { border:1px solid #99f6e4; background:linear-gradient(145deg,#ffffff 0%,#f0fdfa 100%); }
    .workspace-gate--submitted { border:1px solid #bfdbfe; background:linear-gradient(145deg,#ffffff 0%,#eff6ff 100%); }
    .workspace-gate .mat-mdc-card-content { padding:22px !important; }
    .workspace-gate__header { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
    .workspace-gate__identity { display:flex; align-items:flex-start; gap:14px; min-width:0; }
    .workspace-gate__icon { display:grid; place-items:center; width:48px; height:48px; flex:0 0 auto; border-radius:14px; color:#fff; background:linear-gradient(135deg,#0f766e,#14b8a6); box-shadow:0 8px 20px rgba(13,148,136,.22); }
    .workspace-gate--submitted .workspace-gate__icon { background:linear-gradient(135deg,#1d4ed8,#3b82f6); box-shadow:0 8px 20px rgba(37,99,235,.22); }
    .workspace-gate__eyebrow { margin-bottom:4px; color:#0f766e; font-size:11px; font-weight:900; letter-spacing:.09em; text-transform:uppercase; }
    .workspace-gate--submitted .workspace-gate__eyebrow { color:#1d4ed8; }
    .workspace-gate h2 { margin:0 0 5px; color:#0f172a; font-size:21px; line-height:1.25; }
    .workspace-gate p { margin:0; color:#475569; line-height:1.5; }
    .visibility-badge { display:inline-flex; align-items:center; gap:6px; flex:0 0 auto; padding:7px 10px; border:1px solid #99f6e4; border-radius:999px; color:#0f766e; background:#fff; font-size:11px; font-weight:800; }
    .visibility-badge mat-icon { width:16px; height:16px; font-size:16px; line-height:16px; }
    .visibility-badge--shared { color:#1d4ed8; border-color:#bfdbfe; }
    .workflow-rail { display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr); align-items:center; gap:10px; margin:20px 0 16px; padding:14px; border:1px solid #dbe4f0; border-radius:14px; background:rgba(255,255,255,.78); }
    .workflow-rail > mat-icon { color:#94a3b8; }
    .workflow-rail__step { display:flex; align-items:center; gap:9px; min-width:0; color:#64748b; }
    .workflow-rail__step > span { display:grid; place-items:center; width:28px; height:28px; flex:0 0 auto; border:2px solid #cbd5e1; border-radius:50%; background:#fff; font-size:11px; font-weight:900; }
    .workflow-rail__step > div { display:grid; gap:1px; min-width:0; }
    .workflow-rail__step small { font-size:9px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
    .workflow-rail__step strong { overflow:hidden; color:#475569; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
    .workflow-rail__step--active > span { color:#fff; border-color:#0f766e; background:#0f766e; box-shadow:0 0 0 4px rgba(20,184,166,.12); }
    .workspace-gate--submitted .workflow-rail__step--active > span { border-color:#2563eb; background:#2563eb; box-shadow:0 0 0 4px rgba(59,130,246,.12); }
    .workflow-rail__step--active strong { color:#0f172a; }
    .workflow-rail__step--done > span { overflow:hidden; color:#fff; border-color:#10b981; background:#10b981; font-family:'Material Icons'; font-size:16px; }
    .workflow-gate__impact,
    .workspace-gate__impact { display:flex; align-items:center; gap:11px; padding:13px 14px; border:1px solid #ccfbf1; border-radius:12px; color:#134e4a; background:rgba(240,253,250,.85); }
    .workspace-gate__impact > mat-icon { color:#0f766e; }
    .workspace-gate__impact > div { display:grid; gap:2px; }
    .workspace-gate__impact span { color:#475569; font-size:13px; }
    .workspace-gate__actions { display:flex; align-items:center; gap:9px; margin-top:16px; }
    .workspace-gate__actions button { border-radius:999px; font-weight:800; }
    .submit-review-btn { box-shadow:0 7px 16px rgba(79,70,229,.22); }
    .discard-draft-btn { margin-left:auto; color:#b91c1c !important; }
    .submitted-lock-note { display:flex; align-items:center; gap:9px; padding:12px 14px; border:1px solid #dbeafe; border-radius:12px; color:#1e40af; background:rgba(239,246,255,.9); font-size:13px; }
    .submitted-lock-note mat-icon { flex:0 0 auto; }
    .workspace-gate__actions--submitted { justify-content:flex-end; }
    .withdraw-review-btn { color:#1d4ed8 !important; border-color:#93c5fd !important; }
    .governance-path { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; padding: 12px 14px; border: 1px solid #e0e7ff; border-radius: 14px; background: linear-gradient(90deg,#eef2ff,#f8fafc); }
    .governance-path > mat-icon { color: #94a3b8; }
    .governance-path__step { display: flex; align-items: center; gap: 9px; color: #64748b; }
    .governance-path__step > span { width: 27px; height: 27px; display: grid; place-items: center; flex: 0 0 auto; border: 2px solid #cbd5e1; border-radius: 50%; background: #fff; font-size: 12px; font-weight: 900; }
    .governance-path__step > div { display: grid; gap: 1px; }
    .governance-path__step small { font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
    .governance-path__step strong { color: #475569; font-size: 13px; }
    .governance-path__step--active > span { color: #fff; border-color: #4f46e5; background: #4f46e5; }
    .governance-path__step--active strong { color: #312e81; }
    .action-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
    .action-info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #334155;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      padding: 6px 10px;
      font-weight: 500;
    }
    .action-buttons { display: flex; }
    .btn-commit,
    .btn-reject {
      border-radius: 999px;
      min-height: 38px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .btn-commit { box-shadow: 0 4px 10px rgba(63, 81, 181, 0.25); }
    .ml-8 { margin-left: 8px; }
    .reject-panel { margin-top: 16px; }
    .reject-form {
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      margin-top: 12px;
      display: grid;
      gap: 14px;
    }
    .reject-actions { display: flex; align-items: center; }
    .reject-field {
      display: grid;
      gap: 10px;
    }
    .reject-field__head {
      display: grid;
      gap: 4px;
    }
    .reject-field__label {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.01em;
      color: #0f172a;
    }
    .reject-field__hint {
      font-size: 12px;
      line-height: 1.45;
      color: #64748b;
    }
    .reject-textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 104px;
      resize: vertical;
      border-radius: 14px;
      border: 1px solid #cbd5e1;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      color: #0f172a;
      padding: 14px 15px;
      font: inherit;
      line-height: 1.5;
      outline: none;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
      transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
    }
    .reject-textarea::placeholder {
      color: #94a3b8;
      opacity: 1;
    }
    .reject-textarea:hover {
      border-color: #94a3b8;
    }
    .reject-textarea:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.16);
      background: #ffffff;
    }
    mat-card-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .rows-card .mat-mdc-card-header {
      padding: 12px 16px 8px;
    }
    .rows-header.mat-mdc-card-header {
      min-height: 0;
      align-items: flex-end;
      row-gap: 10px;
      column-gap: 8px;
    }
    .rows-header .mat-mdc-card-title {
      margin: 0;
      line-height: 1.25;
    }
    .rows-header p { margin: 5px 0 0; color: var(--app-text-muted); font-size: 13px; }
    .editor-eyebrow { margin-bottom: 4px; color: #0f766e; font-size: 10px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .rows-header {
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .draft-editor-toolbar { display: grid; gap: 10px; margin-bottom: 12px; }
    .draft-change-summary { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 12px 15px; border: 1px solid color-mix(in srgb, #14b8a6 25%, var(--app-border)); border-radius: 14px; background: linear-gradient(100deg, color-mix(in srgb, #14b8a6 9%, var(--app-surface-elevated)), var(--app-surface-elevated)); }
    .draft-change-heading { display: flex; align-items: center; gap: 11px; }
    .draft-live-dot { width: 10px; height: 10px; border: 2px solid var(--app-surface-elevated); border-radius: 50%; background: #14b8a6; box-shadow: 0 0 0 4px color-mix(in srgb, #14b8a6 18%, transparent); }
    .draft-change-heading > div { display: flex; flex-direction: column; gap: 2px; }
    .draft-change-heading strong { font-size: 14px; }
    .draft-change-heading small { color: var(--app-text-muted); font-size: 11px; }
    .draft-change-counts { display: flex; align-items: center; gap: 7px; }
    .draft-change-counts > span, .draft-change-counts > button { display: inline-flex; align-items: center; gap: 5px; min-height: 31px; padding: 0 10px; border: 1px solid var(--app-border); border-radius: 999px; color: var(--app-text-muted); background: var(--app-surface); font: inherit; font-size: 11px; }
    .draft-change-counts strong { color: var(--app-text); font-size: 13px; }
    .draft-change-counts button { cursor: pointer; }
    .draft-change-counts mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .change-added { border-color: color-mix(in srgb, #22c55e 35%, var(--app-border)) !important; }
    .change-modified { border-color: color-mix(in srgb, #3b82f6 35%, var(--app-border)) !important; }
    .change-removed { border-color: color-mix(in srgb, #ef4444 30%, var(--app-border)) !important; }
    .draft-command-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 13px; border: 1px solid var(--app-border); border-radius: 14px; background: var(--app-surface); transition: border-color .18s ease, background .18s ease; }
    .draft-command-bar--selection { border-color: color-mix(in srgb, var(--app-accent) 38%, var(--app-border)); background: color-mix(in srgb, var(--app-accent) 6%, var(--app-surface)); }
    .selection-copy { display: flex; align-items: center; gap: 10px; }
    .selection-copy > span { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: white; background: var(--app-accent); font-weight: 900; }
    .selection-copy > mat-icon { display: grid; place-items: center; width: 34px; height: 34px; color: var(--app-accent); }
    .selection-copy > div { display: flex; flex-direction: column; gap: 1px; }
    .selection-copy strong { font-size: 13px; }
    .selection-copy small { color: var(--app-text-muted); font-size: 11px; }
    .draft-actions { display: flex; align-items: center; justify-content: flex-end; gap: 7px; }
    .draft-actions button { min-height: 38px; border-radius: 11px; font-weight: 800; }
    .delete-selection:not(:disabled) { border-color: color-mix(in srgb, #ef4444 40%, var(--app-border)); color: #dc2626; }
    .removed-rows-tray { overflow: hidden; border: 1px solid color-mix(in srgb, #ef4444 25%, var(--app-border)); border-radius: 14px; background: color-mix(in srgb, #ef4444 4%, var(--app-surface)); }
    .removed-tray-heading, .removed-tray-heading > div { display: flex; align-items: center; }
    .removed-tray-heading { justify-content: space-between; gap: 14px; padding: 11px 13px; border-bottom: 1px solid var(--app-border); }
    .removed-tray-heading > div { gap: 9px; }
    .removed-tray-heading > div > mat-icon { color: #dc2626; }
    .removed-tray-heading span { display: flex; flex-direction: column; }
    .removed-tray-heading strong { font-size: 13px; }
    .removed-tray-heading small { color: var(--app-text-muted); font-size: 11px; }
    .removed-tray-heading .removed-tray-actions { display: flex; align-items: center; gap: 5px; }
    .removed-tray-actions .restore-all { color: var(--app-accent); border-color: color-mix(in srgb, var(--app-accent) 45%, var(--app-border)); font-weight: 800; white-space: nowrap; }
    .removed-tray-actions .restore-all mat-icon { color: inherit; }
    .removed-tray-actions .restore-all span { display: inline; margin-left: 3px; }
    .removed-row-list { max-height: 190px; overflow: auto; padding: 4px 12px; }
    .removed-row-list > div { display: grid; grid-template-columns: auto minmax(0,1fr) auto auto; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--app-border); }
    .removed-row-list > div:last-child { border: 0; }
    .removed-row-list > div > span { color: var(--app-text-muted); font-size: 11px; }
    .removed-row-number { padding: 4px 6px; border-radius: 6px; background: color-mix(in srgb, #ef4444 10%, transparent); }
    .removed-row-list button { color: var(--app-accent); font-weight: 800; }
    .removed-empty { padding: 18px; color: var(--app-text-muted); text-align: center; font-size: 12px; }
    .table-wrapper { overflow-x: auto; width: 100%; }
    .desktop-rows { display: block; min-height: 360px; max-height: calc(100dvh - 330px); overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
    .mobile-rows { display: none; }
    table { width: 100%; min-width: 980px; }
    .desktop-rows th.mat-mdc-header-cell,
    .desktop-rows td.mat-mdc-cell {
      vertical-align: top;
    }
    .desktop-rows th.mat-mdc-header-cell {
      padding: 12px 14px;
      font-size: 14px;
      font-weight: 600;
    }
    .desktop-rows td.mat-mdc-cell {
      padding: 12px 14px;
      word-break: break-word;
    }
    .desktop-rows .mat-mdc-row:hover { background: color-mix(in srgb, var(--app-accent) 5%, transparent); }
    .desktop-rows .mat-mdc-row.row-selected { background: color-mix(in srgb, var(--app-accent) 9%, transparent); }
    .mobile-row-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #f8fafc;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .mobile-row-toggle {
      width: 100%;
      border: 0;
      margin: 0;
      background: transparent;
      text-align: left;
      padding: 10px;
      cursor: pointer;
    }
    .mobile-row-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .mobile-row-right { display: flex; align-items: center; gap: 6px; }
    .mobile-row-index { font-size: 12px; color: #64748b; font-weight: 700; letter-spacing: 0.02em; }
    .mobile-primary { font-size: 13px; color: #0f172a; margin-top: 3px; font-weight: 500; }
    .expand-icon { color: #64748b; transition: transform 0.2s ease; }
    .expand-icon.expanded { transform: rotate(180deg); }
    .mobile-row-details { border-top: 1px solid #e2e8f0; padding: 8px 10px 10px; }
    .mobile-fields { display: grid; gap: 6px; margin-bottom: 8px; }
    .mobile-field { display: grid; gap: 2px; }
    .mobile-field-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .mobile-more { font-size: 11px; color: #475569; }
    .mobile-validation { border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .mobile-actions { margin-top: 10px; display: flex; }
    .mobile-actions button { width: 100%; justify-content: center; }
    .validation-msg { display: block; font-size: 11px; margin-bottom: 2px; }
    .msg-error { color: #c62828; }
    .msg-warning { color: #f57f17; }
    .msg-info { color: #1565c0; }

    :host-context(html.theme-dark) .action-working-copy { color: #5eead4 !important; border-color: rgba(45,212,191,.38) !important; background: rgba(15,118,110,.16); }
    :host-context(html.theme-dark) .action-working-copy:hover:not(:disabled) { background: rgba(15,118,110,.26); }
    :host-context(html.theme-dark) .editor-eyebrow { color: #5eead4; }
    :host-context(html.theme-dark) .delete-selection:not(:disabled) { color: #fca5a5; }
    :host-context(html.theme-dark) .mobile-row-card { border-color: var(--app-border); background: var(--app-surface); }
    :host-context(html.theme-dark) .mobile-primary { color: var(--app-text); }
    :host-context(html.theme-dark) .mobile-row-details, :host-context(html.theme-dark) .mobile-validation { border-color: var(--app-border); }

    /* Readability pass for comparison and workflow decisions. */
    :host { font-size: 15px; }
    h1 { font-size: 23px; font-weight: 600; }
    .header-action-btn { min-height: 40px; font-size: 14px; }
    .summary-item { padding: 13px; }
    .summary-item .label { font-size: 12px; }
    .summary-item .value { font-size: 19px; }
    .workflow-status-pill { padding: 7px 11px; font-size: 13px; }
    .workflow-status-pill mat-icon { width: 18px; height: 18px; font-size: 18px; line-height: 18px; }
    .workspace-gate .mat-mdc-card-content { padding: 26px !important; }
    .workspace-gate__icon { width: 54px; height: 54px; }
    .workspace-gate__icon mat-icon { width: 29px; height: 29px; font-size: 29px; }
    .workspace-gate__eyebrow { font-size: 12px; }
    .workspace-gate h2 { font-size: 23px; }
    .workspace-gate p { font-size: 15px; }
    .visibility-badge { padding: 8px 12px; font-size: 13px; }
    .visibility-badge mat-icon { width: 18px; height: 18px; font-size: 18px; line-height: 18px; }
    .workflow-rail { padding: 17px; }
    .workflow-rail__step > span { width: 32px; height: 32px; font-size: 12px; }
    .workflow-rail__step small { font-size: 11px; }
    .workflow-rail__step strong { font-size: 14px; }
    .workspace-gate__impact { padding: 15px 16px; }
    .workspace-gate__impact > mat-icon { width: 25px; height: 25px; font-size: 25px; }
    .workspace-gate__impact strong { font-size: 16px; }
    .workspace-gate__impact span { font-size: 15px; }
    .workspace-gate__actions button { min-height: 44px; font-size: 14px; }
    .submitted-lock-note { padding: 14px 16px; font-size: 14px; }

    :host-context(html.theme-dark) .action-card {
      border-color: rgba(126, 162, 255, 0.18);
      background: rgba(15, 23, 42, 0.92);
    }
    .mobile-row-card.row-selected { border-color: var(--app-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 12%, transparent); }
    .mobile-row-select { display: flex; justify-content: flex-end; padding: 5px 8px 0; }
    :host-context(html.theme-dark) .workflow-status-pill { color:#5eead4; border-color:rgba(45,212,191,.32); background:rgba(15,118,110,.2); }
    :host-context(html.theme-dark) .workflow-status-pill--shared { color:#93c5fd; border-color:rgba(96,165,250,.32); background:rgba(30,64,175,.22); }
    :host-context(html.theme-dark) .workspace-gate--private { border-color:rgba(45,212,191,.28); background:linear-gradient(145deg,#111d2b 0%,#0b1920 100%); box-shadow:0 14px 32px rgba(0,0,0,.28); }
    :host-context(html.theme-dark) .workspace-gate--submitted { border-color:rgba(96,165,250,.28); background:linear-gradient(145deg,#111a31 0%,#0b1428 100%); box-shadow:0 14px 32px rgba(0,0,0,.28); }
    :host-context(html.theme-dark) .workspace-gate h2 { color:#f8fafc; }
    :host-context(html.theme-dark) .workspace-gate p { color:#cbd5e1; }
    :host-context(html.theme-dark) .workspace-gate__eyebrow { color:#5eead4; }
    :host-context(html.theme-dark) .workspace-gate--submitted .workspace-gate__eyebrow { color:#93c5fd; }
    :host-context(html.theme-dark) .visibility-badge { color:#5eead4; border-color:rgba(45,212,191,.3); background:rgba(15,23,42,.7); }
    :host-context(html.theme-dark) .visibility-badge--shared { color:#93c5fd; border-color:rgba(96,165,250,.3); }
    :host-context(html.theme-dark) .workflow-rail { border-color:rgba(148,163,184,.2); background:rgba(7,13,27,.55); }
    :host-context(html.theme-dark) .workflow-rail__step > span { border-color:#475569; background:#172033; }
    :host-context(html.theme-dark) .workflow-rail__step strong { color:#94a3b8; }
    :host-context(html.theme-dark) .workflow-rail__step--active strong { color:#f8fafc; }
    :host-context(html.theme-dark) .workflow-rail__step--done > span { border-color:#059669; background:#059669; }
    :host-context(html.theme-dark) .workspace-gate__impact { color:#ccfbf1; border-color:rgba(45,212,191,.24); background:rgba(15,118,110,.14); }
    :host-context(html.theme-dark) .workspace-gate__impact span { color:#cbd5e1; }
    :host-context(html.theme-dark) .submitted-lock-note { color:#bfdbfe; border-color:rgba(96,165,250,.24); background:rgba(30,64,175,.16); }
    :host-context(html.theme-dark) .discard-draft-btn { color:#fca5a5 !important; }
    :host-context(html.theme-dark) .withdraw-review-btn { color:#93c5fd !important; border-color:rgba(96,165,250,.45) !important; }
    :host-context(html.theme-dark) .governance-path { border-color: rgba(129,140,248,.24); background: linear-gradient(90deg,rgba(49,46,129,.25),rgba(15,23,42,.7)); }
    :host-context(html.theme-dark) .governance-path__step > span { border-color:#475569; background:#172033; }
    :host-context(html.theme-dark) .governance-path__step strong { color:#cbd5e1; }
    :host-context(html.theme-dark) .governance-path__step--active > span { border-color:#818cf8; background:#4f46e5; }
    :host-context(html.theme-dark) .governance-path__step--active strong { color:#c7d2fe; }

    :host-context(html.theme-dark) .comparison-card {
      border-color: rgba(126, 162, 255, 0.18);
      background: rgba(15, 23, 42, 0.92);
    }

    :host-context(html.theme-dark) .comparison-copy h3 {
      color: #f8fafc;
    }

    :host-context(html.theme-dark) .comparison-copy p {
      color: #cbd5e1;
    }

    :host-context(html.theme-dark) .comparison-status-pill {
      border-color: rgba(74, 222, 128, 0.35);
      background: rgba(22, 101, 52, 0.28);
      color: #bbf7d0;
    }

    :host-context(html.theme-dark) .action-bar {
      color: var(--app-text);
    }

    :host-context(html.theme-dark) .action-info {
      color: #dbeafe;
      background: linear-gradient(180deg, rgba(17, 28, 53, 0.98) 0%, rgba(10, 16, 33, 0.98) 100%);
      border-color: rgba(126, 162, 255, 0.24);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    :host-context(html.theme-dark) .action-info mat-icon {
      color: #93c5fd;
    }

    :host-context(html.theme-dark) .action-info strong {
      color: #f8fafc;
    }

    :host-context(html.theme-dark) .reject-form {
      border-top-color: rgba(126, 162, 255, 0.18);
      padding: 14px;
      margin-top: 14px;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(17, 28, 53, 0.92) 0%, rgba(10, 16, 33, 0.96) 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    :host-context(html.theme-dark) .reject-field__label {
      color: #f8fafc;
    }

    :host-context(html.theme-dark) .reject-field__hint {
      color: #94a3b8;
    }

    :host-context(html.theme-dark) .reject-textarea {
      border-color: rgba(148, 163, 184, 0.28);
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(11, 18, 36, 0.98) 100%);
      color: #f8fafc;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    }

    :host-context(html.theme-dark) .reject-textarea::placeholder {
      color: rgba(203, 213, 225, 0.72);
      opacity: 1;
    }

    :host-context(html.theme-dark) .reject-textarea:hover {
      border-color: rgba(96, 165, 250, 0.55);
    }

    :host-context(html.theme-dark) .reject-textarea:focus {
      border-color: #93c5fd;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.16);
      background: rgba(15, 23, 42, 0.98);
    }

    :host-context(html.theme-dark) .reject-actions button[mat-raised-button] {
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    }

    :host-context(html.theme-dark) .reject-actions button[mat-button] {
      color: #e2e8f0;
    }

    :host-context(html.theme-dark) .reject-actions button[mat-raised-button].mat-mdc-button-disabled,
    :host-context(html.theme-dark) .reject-actions button[mat-raised-button]:disabled {
      color: rgba(248, 250, 252, 0.7);
      background: rgba(51, 65, 85, 0.88);
      box-shadow: none;
      border: 1px solid rgba(148, 163, 184, 0.24);
      opacity: 1;
    }

    :host-context(html.theme-dark) .reject-actions button[mat-button].mat-mdc-button-disabled,
    :host-context(html.theme-dark) .reject-actions button[mat-button]:disabled {
      color: rgba(226, 232, 240, 0.6);
      opacity: 1;
    }

    @media (max-width: 900px) {
      .page-header { flex-direction: column; gap: 10px; }
      .header-actions { margin-top: 0; width: 100%; flex-wrap: wrap; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .summary-grid-metadata, .summary-grid-stats { grid-template-columns: repeat(2, 1fr); }
      .comparison-header { flex-direction: column; }
      .action-bar { flex-direction: column; align-items: flex-start; }
      .action-buttons { width: 100%; flex-wrap: wrap; }
      .action-buttons button { flex: 1; min-width: 180px; }
      .workspace-gate__header { flex-direction:column; }
      .workflow-rail { grid-template-columns:1fr; }
      .workflow-rail > mat-icon { transform:rotate(90deg); margin-left:2px; }
      .workflow-rail__step strong { white-space:normal; }
      .desktop-rows { max-height: 620px; }
    }

    @media (max-width: 600px) {
      h1 { font-size: 18px; }
      .rows-card .mat-mdc-card-header {
        padding: 12px 12px 0;
      }
      .rows-card .mat-mdc-card-content {
        padding: 0 12px 10px !important;
      }
      .summary-grid-metadata, .summary-grid-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .summary-item { padding: 8px; }
      .summary-item .value { font-size: 15px; }
      .rows-header {
        margin-bottom: 6px;
        padding-bottom: 8px;
      }
      .rows-header.mat-mdc-card-header {
        align-items: stretch;
        row-gap: 10px;
      }
      .draft-change-summary { align-items: flex-start; flex-direction: column; padding: 12px; }
      .draft-change-counts { width: 100%; flex-wrap: wrap; }
      .draft-change-counts > span, .draft-change-counts > button { flex: 1; justify-content: center; min-width: 90px; }
      .draft-command-bar { align-items: stretch; flex-direction: column; }
      .draft-actions { display: grid; grid-template-columns: 1fr 1fr; }
      .draft-actions button { width: 100%; }
      .draft-actions button:first-child { grid-column: 1 / -1; }
      .removed-row-list > div { grid-template-columns: auto minmax(0,1fr) auto; }
      .removed-row-list > div > span:not(.removed-row-number) { display: none; }
      .removed-row-list button { min-width: 0; padding-inline: 7px; }
      .removed-tray-heading { align-items: flex-start; }
      .removed-tray-actions .restore-all { padding-inline: 9px; }
      .removed-tray-actions .restore-all span { display: none; }
      .header-actions { grid-template-columns: 1fr; gap: 6px; }
      .header-action-btn { width: 100%; justify-content: center; min-height: 38px; border-radius: 10px; }
      .action-info {
        border-radius: 10px;
        width: 100%;
        align-items: flex-start;
        padding: 8px 10px;
      }
      .header-actions button,
      .action-buttons button,
      .reject-actions button { width: 100%; justify-content: center; }
      .action-buttons,
      .reject-actions { gap: 8px; display: flex; flex-direction: column; width: 100%; }
      .ml-8 { margin-left: 0; }
      .btn-commit,
      .btn-reject { min-height: 40px; }
      .governance-path { align-items: stretch; flex-direction: column; }
      .governance-path > mat-icon { transform: rotate(90deg); align-self: flex-start; margin-left: 2px; }
      .reject-textarea {
        min-height: 96px;
        padding: 12px 13px;
      }
      .correction-card {
        flex-direction: column;
        align-items: stretch;
      }
      .correction-card button { width: 100%; }
      .workspace-gate .mat-mdc-card-content { padding:16px !important; }
      .workspace-gate__identity { gap:10px; }
      .workspace-gate__icon { width:42px; height:42px; border-radius:12px; }
      .workspace-gate h2 { font-size:18px; }
      .visibility-badge { width:100%; justify-content:center; box-sizing:border-box; }
      .workspace-gate__actions { align-items:stretch; flex-direction:column; }
      .workspace-gate__actions button { width:100%; margin-left:0; }
      .correction-copy,
      .cancelled-copy {
        align-items: flex-start;
      }
      .correction-copy > div,
      .cancelled-copy > div {
        min-width: 0;
      }
      .cancelled-card {
        padding: 12px;
      }
      .desktop-rows { display: none; }
      .mobile-rows { display: block; }

      :host-context(html.theme-dark) .action-info {
        background: linear-gradient(180deg, rgba(17, 28, 53, 0.98) 0%, rgba(10, 16, 33, 0.98) 100%);
      }

      :host-context(html.theme-dark) .reject-form {
        padding: 12px;
      }
    }

    @media (max-width: 390px) {
      .summary-grid-metadata, .summary-grid-stats { grid-template-columns: 1fr; }
    }
  `]
})
export class ImportPreviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly importService = inject(ImportService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly auth = inject(AuthFacade);

  job: ImportJob | null = null;
  datasetRequirement: DatasetRequirement | null = null;
  comparison: ImportComparison | null = null;
  approvalSnapshot: ApprovedComparisonSnapshot | null = null;
  portfolioReadiness: PortfolioReadiness | null = null;
  rows: PagedResult<StagingRow> | null = null;
  loading = false;
  comparisonLoading = false;
  approvalSnapshotLoading = false;
  rowsLoading = false;
  refreshingValidation = false;
  rowPage = 1;
  rowPageSize = 50;
  committing = false;
  approving = false;
  returningToReview = false;
  rejecting = false;
  showRejectPanel = false;
  rejectionReason = '';
  workflowActionRunning = false;
  publicationApproval: PublicationApprovalDraft | null = null;
  activeDraftEditorMode: DraftEditorMode | null = null;
  activeDraftEditorRow: StagingRow | null = null;
  showRemovedRows = false;
  contextExpanded = false;
  mobileImpactOpen = false;
  draftMutationRunning = false;
  readonly selectedRowIds = new Set<string>();
  removedRows: StagingRow[] = [];
  private readonly expandedRows = new Set<number>();
  private readonly comparisonMap = new Map<string, ComparisonRow>();
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly rowStatusOptions: { value: RowStatus; label: string }[] = [
    { value: 'Valid', label: 'Valid' },
    { value: 'Warning', label: 'Warnings' },
    { value: 'Error', label: 'Errors' }
  ];

  readonly comparisonStatusOptions: { value: ComparisonStatus; label: string }[] = [
    { value: 'New', label: 'New' },
    { value: 'Modified', label: 'Modified' },
    { value: 'Unchanged', label: 'Unchanged' }
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
    comparison: ['']
  });

  dynamicColumns: string[] = [];
  get allColumns() { return [...(this.isPrivateWorkspace ? ['select'] : []), 'rowNum', 'status', 'comparison', ...this.dynamicColumns, 'messages', 'actions']; }

  get hasDraftChanges(): boolean {
    return !!this.job && (this.job.draftAddedRows > 0 || this.job.draftModifiedRows > 0 || this.job.draftRemovedRows > 0);
  }

  get validationReadinessPercent(): number {
    if (!this.job?.totalRows) return 0;
    return Math.round((this.job.validRows / this.job.totalRows) * 100);
  }

  focusRows(status: RowStatus | '' = '', comparison: ComparisonStatus | '' = ''): void {
    this.mobileImpactOpen = false;
    this.rowPage = 1;
    this.filtersForm.patchValue({ status, comparison });
    window.setTimeout(() => this.scrollToElement(document.getElementById('data-workbench')));
  }

  toggleContext(): void {
    this.contextExpanded = !this.contextExpanded;
    if (this.contextExpanded) {
      window.setTimeout(() => this.scrollToElement(document.querySelector('.context-zone')));
    }
  }

  openEvidence(anchorId?: string): void {
    this.mobileImpactOpen = false;
    this.contextExpanded = true;
    window.setTimeout(() => {
      const target = anchorId ? document.getElementById(anchorId) : document.querySelector('.context-zone');
      this.scrollToElement(target);
    });
  }

  openDecisionPanel(): void {
    this.contextExpanded = true;
    this.showRejectPanel = true;
    window.setTimeout(() => this.scrollToElement(document.querySelector('.reject-panel')));
  }

  private scrollToElement(target: Element | null): void {
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 86;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  get allVisibleRowsSelected(): boolean {
    return !!this.rows?.items.length && this.rows.items.every(row => this.selectedRowIds.has(row.id));
  }

  get someVisibleRowsSelected(): boolean {
    return !this.allVisibleRowsSelected && !!this.rows?.items.some(row => this.selectedRowIds.has(row.id));
  }

  comparisonForRow(row: StagingRow): ComparisonRow | null {
    return this.comparisonMap.get(row.id) ?? null;
  }

  comparisonChangeForField(row: StagingRow, field: string): ComparisonFieldChange | null {
    const comparisonRow = this.comparisonForRow(row);
    if (!comparisonRow || comparisonRow.comparisonStatus !== 'Modified') {
      return null;
    }

    return comparisonRow.changes.find(change => change.field.toLowerCase() === field.toLowerCase() && change.isDifferent) ?? null;
  }

  isFieldChanged(row: StagingRow, field: string): boolean {
    return this.comparisonChangeForField(row, field) !== null;
  }

  comparisonIcon(status: ComparisonRow['comparisonStatus']): string {
    switch (status) {
      case 'New':
        return 'add_circle';
      case 'Modified':
        return 'swap_horiz';
      case 'Unchanged':
        return 'check_circle';
      default:
        return 'help';
    }
  }

  comparisonBaselineLabel(): string {
    return 'Active baseline';
  }

  activeBaselineLink(): string | null {
    if (!this.comparison?.hasBaseline || !this.comparison.baselineJobId || this.comparison.baselineJobId === this.job?.id) {
      return null;
    }

    return `/import/${this.comparison.baselineJobId}`;
  }

  getMobileColumns(row: StagingRow): string[] {
    return Object.keys(row.fields).slice(0, 3);
  }

  remainingFieldCount(row: StagingRow): number {
    const total = Object.keys(row.fields).length;
    return total > 3 ? total - 3 : 0;
  }

  getPrimaryColumn(row: StagingRow): string | null {
    const cols = Object.keys(row.fields);
    return cols.length ? cols[0] : null;
  }

  isRowExpanded(rowNumber: number): boolean {
    return this.expandedRows.has(rowNumber);
  }

  toggleRow(rowNumber: number): void {
    if (this.expandedRows.has(rowNumber)) {
      this.expandedRows.delete(rowNumber);
      return;
    }

    this.expandedRows.add(rowNumber);
  }

  canEditRow(row: StagingRow): boolean {
    return this.auth.hasCapability('imports.correct_own')
      && this.job?.createdBy === this.auth.userId
      && this.isPrivateWorkspace
      && this.job?.statusLabel !== 'Approved'
      && this.job?.statusLabel !== 'Committed'
      && this.job?.statusLabel !== 'Rejected'
      && this.job?.statusLabel !== 'Failed'
      && this.job?.statusLabel !== 'Cancelled';
  }

  toggleRowSelection(row: StagingRow): void {
    if (this.selectedRowIds.has(row.id)) this.selectedRowIds.delete(row.id);
    else this.selectedRowIds.add(row.id);
  }

  toggleAllVisibleRows(): void {
    if (!this.rows) return;
    if (this.allVisibleRowsSelected) this.rows.items.forEach(row => this.selectedRowIds.delete(row.id));
    else this.rows.items.forEach(row => this.selectedRowIds.add(row.id));
  }

  clearRowSelection(): void {
    this.selectedRowIds.clear();
  }

  openAddRowEditor(): void {
    this.activeDraftEditorRow = null;
    this.activeDraftEditorMode = 'add';
  }

  duplicateSelectedRow(): void {
    if (!this.rows || this.selectedRowIds.size !== 1) return;
    const row = this.rows.items.find(item => this.selectedRowIds.has(item.id));
    if (!row) return;
    this.activeDraftEditorRow = row;
    this.activeDraftEditorMode = 'duplicate';
  }

  closeDraftEditor(): void {
    this.activeDraftEditorMode = null;
    this.activeDraftEditorRow = null;
  }

  applyDraftRowChange(fields: Record<string, string | null>): void {
    if (!this.job || !this.activeDraftEditorMode || this.draftMutationRunning) return;
    const mode = this.activeDraftEditorMode;
    const request = mode === 'edit' && this.activeDraftEditorRow
      ? this.importService.updateRow(this.job.id, this.activeDraftEditorRow.id, fields)
      : this.importService.addRow(this.job.id, fields);

    this.draftMutationRunning = true;
    request.subscribe({
      next: updatedJob => {
        this.job = updatedJob;
        this.draftMutationRunning = false;
        this.clearRowSelection();
        this.closeDraftEditor();
        this.reloadDraftData();
        const message = mode === 'edit'
          ? 'Draft row updated and revalidated.'
          : mode === 'duplicate' ? 'A validated copy was added to the draft.' : 'A new row was added and validated.';
        this.snackBar.open(message, 'Close', { duration: 4500 });
      },
      error: error => {
        this.draftMutationRunning = false;
        this.snackBar.open(error?.error?.error ?? 'The draft row could not be saved.', 'Close', { duration: 7000 });
      }
    });
  }

  removeSelectedRows(): void {
    if (!this.job || !this.selectedRowIds.size || this.draftMutationRunning) return;
    const rowIds = Array.from(this.selectedRowIds);
    this.draftMutationRunning = true;
    this.importService.deleteRows(this.job.id, rowIds).subscribe({
      next: updatedJob => {
        this.job = updatedJob;
        this.draftMutationRunning = false;
        this.clearRowSelection();
        this.showRemovedRows = true;
        this.reloadDraftData();
        this.snackBar.open(`${rowIds.length} row${rowIds.length === 1 ? '' : 's'} removed from the working draft.`, 'Close', { duration: 4500 });
      },
      error: error => {
        this.draftMutationRunning = false;
        this.snackBar.open(error?.error?.error ?? 'The selected rows could not be removed.', 'Close', { duration: 7000 });
      }
    });
  }

  restoreDraftRow(row: StagingRow): void {
    if (!this.job || this.draftMutationRunning) return;
    this.draftMutationRunning = true;
    this.importService.restoreRows(this.job.id, [row.id]).subscribe({
      next: updatedJob => {
        this.job = updatedJob;
        this.draftMutationRunning = false;
        this.reloadDraftData();
        this.snackBar.open(`Row #${row.rowNumber} restored and revalidated.`, 'Close', { duration: 4500 });
      },
      error: error => {
        this.draftMutationRunning = false;
        this.snackBar.open(error?.error?.error ?? 'The row could not be restored.', 'Close', { duration: 7000 });
      }
    });
  }

  restoreAllDraftRows(): void {
    if (!this.job || !this.removedRows.length || this.draftMutationRunning) return;
    const rowIds = this.removedRows.map(row => row.id);
    this.draftMutationRunning = true;
    this.importService.restoreRows(this.job.id, rowIds).subscribe({
      next: updatedJob => {
        this.job = updatedJob;
        this.draftMutationRunning = false;
        this.reloadDraftData();
        this.snackBar.open(`${rowIds.length} rows restored and revalidated.`, 'Close', { duration: 4500 });
      },
      error: error => {
        this.draftMutationRunning = false;
        this.snackBar.open(error?.error?.error ?? 'The removed rows could not be restored.', 'Close', { duration: 7000 });
      }
    });
  }

  primaryRowValue(row: StagingRow): string {
    const primary = Object.values(row.fields).find(value => !!value);
    return primary || `Row ${row.rowNumber}`;
  }

  downloadWorkingCopy(): void {
    if (!this.job || !this.hasDraftChanges) return;
    this.importService.downloadWorkingCopy(this.job.id).subscribe({
      next: blob => {
        const extension = this.job!.fileExtension || '.xlsx';
        const stem = this.job!.originalFileName;
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `${stem}_working-copy${extension}`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
      },
      error: error => this.snackBar.open(error?.error?.error ?? 'The working copy could not be generated.', 'Close', { duration: 7000 })
    });
  }

  private reloadDraftData(): void {
    this.loadRows();
    this.loadComparison();
    this.loadRemovedRows();
  }

  private loadRemovedRows(): void {
    if (!this.job || !this.isPrivateWorkspace) {
      this.removedRows = [];
      return;
    }
    this.importService.getRemovedRows(this.job.id).subscribe({
      next: rows => {
        this.removedRows = rows;
        if (!rows.length) this.showRemovedRows = false;
      },
      error: () => { this.removedRows = []; }
    });
  }

  showErrorRows(): void {
    this.filtersForm.setValue({ search: '', status: 'Error', comparison: '' });
    this.rowPage = 1;
    this.loadRows();
  }

  canCancelJob(): boolean {
    if (!this.job) {
      return false;
    }

    return this.auth.hasCapability('imports.withdraw_own')
      && this.job.workflowStageLabel === 'Private'
      && this.auth.userId !== ''
      && this.job.createdBy === this.auth.userId;
  }

  get isPrivateWorkspace(): boolean {
    return !!this.job
      && this.job.createdBy === this.auth.userId
      && this.job.workflowStageLabel === 'Private';
  }

  canRenameUpload(): boolean {
    return this.isPrivateWorkspace && this.auth.hasCapability('imports.correct_own');
  }

  renameUpload(): void {
    if (!this.job || !this.canRenameUpload()) return;

    const job = this.job;
    this.dialog.open(RenameUploadDialogComponent, {
      data: { fileName: job.originalFileName },
      autoFocus: false,
      panelClass: 'app-dialog-panel',
      width: '520px',
      maxWidth: 'calc(100vw - 24px)'
    }).afterClosed().subscribe(requestedName => {
      if (!requestedName) return;
      this.workflowActionRunning = true;
      this.importService.renameUpload(job.id, requestedName).subscribe({
        next: updated => {
          this.job = updated;
          this.workflowActionRunning = false;
          this.snackBar.open('Upload renamed.', 'Close', { duration: 3500 });
        },
        error: error => {
          this.workflowActionRunning = false;
          this.snackBar.open(error?.error?.error ?? 'The upload could not be renamed.', 'Close', { duration: 6000 });
        }
      });
    });
  }

  get isDependentDataset(): boolean {
    return !!this.job && (this.job.entityType === 2 || this.job.entityType === 3);
  }

  get isPortfolioDataset(): boolean {
    return !!this.job && (this.job.entityType === 1 || this.job.entityType === 2);
  }

  get canSubmitProjectedState(): boolean {
    return !this.isPortfolioDataset || this.portfolioReadiness?.isConsistent === true;
  }

  get portfolioRefreshKey(): string {
    if (!this.job) return '';
    return [this.job.id, this.job.processedAt, this.job.totalRows, this.job.draftAddedRows,
      this.job.draftModifiedRows, this.job.draftRemovedRows].join(':');
  }

  focusReleaseWorkflow(): void {
    this.contextExpanded = true;
    if (this.job?.entityType === 1) {
      setTimeout(() => document.getElementById('article-release-workflow')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }
    document.getElementById('dependency-workflow')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  handleDependencyJobChanged(updated: ImportJob): void {
    this.job = updated;
    this.loadRows();
  }

  handleArticleReleaseCreated(): void {
    if (!this.job) return;
    this.importService.getJob(this.job.id).subscribe({
      next: updated => {
        this.job = updated;
        this.portfolioReadiness = null;
        this.loadRows();
        this.loadComparison();
        setTimeout(() => document.getElementById('dependency-workflow')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      },
      error: () => this.snackBar.open('The release was created. Refresh the page to open it.', 'Close', { duration: 6000 })
    });
  }

  get isSubmittedOwner(): boolean {
    return !!this.job
      && this.job.statusLabel === 'AwaitingApproval'
      && this.job.createdBy === this.auth.userId
      && this.job.workflowStageLabel === 'Submitted';
  }

  get canShowApprovalGate(): boolean {
    return !!this.job
      && this.job.statusLabel === 'AwaitingApproval'
      && this.job.workflowStageLabel === 'Submitted'
      && this.job.createdBy !== this.auth.userId
      && this.canReviewApproval;
  }

  get detailStatusLabel(): string {
    if (this.isSubmittedOwner) return 'In team review';
    if (!this.job) return '';
    if (this.job.errorRows > 0 || this.job.statusLabel === 'NeedsCorrection') return 'Needs correction';
    if (this.job.statusLabel === 'Processing') return 'Validating';
    if (this.job.statusLabel === 'Pending') return 'Private draft';
    return 'Ready to submit';
  }

  get privateGateTitle(): string {
    if (!this.job) return '';
    if (this.job.errorRows > 0 || this.job.statusLabel === 'NeedsCorrection') return 'Finish preparing this upload';
    if (this.job.statusLabel === 'Processing' || this.job.statusLabel === 'Pending') return 'Your upload is being prepared';
    return 'Ready when you are';
  }

  get privateGateCopy(): string {
    if (!this.job) return '';
    if (this.job.errorRows > 0 || this.job.statusLabel === 'NeedsCorrection') return 'Resolve the blocking rows before sharing this version with the review team.';
    if (this.job.statusLabel === 'Processing' || this.job.statusLabel === 'Pending') return 'You can inspect and refine this version without anyone else seeing it.';
    return 'Review the comparison, then deliberately share this exact version for approval.';
  }

  get canReviewApproval(): boolean {
    return this.auth.hasCapability('imports.approve') || this.auth.hasCapability('imports.reject');
  }

  get canControlPublication(): boolean {
    return this.auth.hasCapability('imports.publish') || this.auth.hasCapability('imports.return_to_review');
  }

  canRefreshValidation(): boolean {
    if (!this.job) {
      return false;
    }

    return this.auth.hasCapability('imports.correct_own')
      && this.job.createdBy === this.auth.userId
      && this.isPrivateWorkspace
      && !['Approved', 'Committed', 'Rejected', 'Failed', 'Cancelled'].includes(this.job.statusLabel);
  }

  submitForReview(): void {
    if (!this.job || !this.isPrivateWorkspace || this.job.statusLabel !== 'AwaitingApproval'
      || this.job.errorRows > 0 || !this.canSubmitProjectedState) {
      return;
    }

    this.workflowActionRunning = true;
    this.importService.submitForReview(this.job.id).subscribe({
      next: submitted => {
        this.job = submitted;
        this.workflowActionRunning = false;
        this.snackBar.open('This version is now visible in the Review Queue.', 'Close', { duration: 5000 });
      },
      error: error => {
        this.workflowActionRunning = false;
        this.snackBar.open(error?.error?.error ?? 'The upload could not be submitted.', 'Close', { duration: 7000 });
      }
    });
  }

  withdrawFromReview(): void {
    if (!this.job || !this.isSubmittedOwner) return;

    this.workflowActionRunning = true;
    this.importService.withdrawFromReview(this.job.id).subscribe({
      next: withdrawn => {
        this.job = withdrawn;
        this.workflowActionRunning = false;
        this.snackBar.open('The upload is private again. You can continue refining it.', 'Close', { duration: 5000 });
      },
      error: error => {
        this.workflowActionRunning = false;
        this.snackBar.open(error?.error?.error ?? 'The submission could not be withdrawn.', 'Close', { duration: 7000 });
      }
    });
  }

  canDownloadComparisonReport(): boolean {
    return !!this.comparison && (
      this.comparison.newRows > 0 ||
      this.comparison.modifiedRows > 0 ||
      this.comparison.missingBaselineRows > 0
    );
  }

  ngOnInit() {
    this.filtersForm.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.rowPage = 1;
        this.loadRows();
      });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (!id) {
        return;
      }

      this.resetViewState();
      this.loading = true;
      this.importService.getJob(id).subscribe({
        next: j => {
          this.job = j;
          this.hydratePublicationApproval(j);
          this.loadRemovedRows();
          this.loading = false;
          this.loadDatasetRequirement(j.entityType);
          if (j.statusLabel === 'Approved' || j.statusLabel === 'Committed') {
            this.loadApprovalSnapshot();
          }
          if (this.canRefreshValidation()) {
            this.refreshValidation(false);
          } else {
            this.loadComparison();
            this.loadRows();
          }
        },
        error: () => { this.loading = false; }
      });
    });
  }

  private resetViewState(): void {
    this.job = null;
    this.datasetRequirement = null;
    this.comparison = null;
    this.approvalSnapshot = null;
    this.portfolioReadiness = null;
    this.approvalSnapshotLoading = false;
    this.publicationApproval = null;
    this.rows = null;
    this.comparisonMap.clear();
    this.selectedRowIds.clear();
    this.removedRows = [];
    this.showRemovedRows = false;
    this.closeDraftEditor();
    this.rowPage = 1;
    this.filtersForm.reset({ search: '', status: '', comparison: '' }, { emitEvent: false });
    this.expandedRows.clear();
  }

  private loadApprovalSnapshot(): void {
    if (!this.job || (this.job.statusLabel !== 'Approved' && this.job.statusLabel !== 'Committed')) {
      this.approvalSnapshot = null;
      return;
    }

    this.approvalSnapshotLoading = true;
    this.importService.getApprovalSnapshot(this.job.id).subscribe({
      next: snapshot => {
        this.approvalSnapshot = snapshot;
        if (snapshot && this.job?.statusLabel === 'Approved') {
          this.publicationApproval = {
            approvedAt: snapshot.approvedAtUtc,
            approvedBy: snapshot.approvedByDisplayName,
            newRows: snapshot.comparison.newRows,
            modifiedRows: snapshot.comparison.modifiedRows,
            missingRows: snapshot.comparison.missingBaselineRows
          };
        }
        this.approvalSnapshotLoading = false;
      },
      error: () => {
        this.approvalSnapshot = null;
        this.approvalSnapshotLoading = false;
      }
    });
  }

  private loadDatasetRequirement(entityType: number): void {
    this.importService.getDatasetRequirement(entityType).subscribe({
      next: req => {
        this.datasetRequirement = req;
      },
      error: () => {
        this.datasetRequirement = null;
      }
    });
  }

  private loadComparison(): void {
    if (!this.job) {
      return;
    }

    this.comparisonLoading = true;
    this.importService.getComparison(this.job.id).subscribe({
      next: comparison => {
        this.comparison = comparison;
        this.comparisonMap.clear();
        for (const row of comparison.rows) {
          this.comparisonMap.set(row.rowId, row);
        }
        this.comparisonLoading = false;
      },
      error: () => {
        this.comparison = null;
        this.comparisonMap.clear();
        this.comparisonLoading = false;
      }
    });
  }

  loadRows() {
    if (!this.job) return;
    this.rowsLoading = true;
    const { search, status, comparison } = this.filtersForm.getRawValue();
    this.importService.getRows(
      this.job.id,
      this.rowPage,
      this.rowPageSize,
      search.trim() || undefined,
      (status || undefined) as RowStatus | undefined,
      (comparison || undefined) as ComparisonStatus | undefined
    ).subscribe({
      next: r => {
        this.rows = r;
        this.expandedRows.clear();
        if (r.items.length > 0)
          this.dynamicColumns = Object.keys(r.items[0].fields);
        this.rowsLoading = false;
      },
      error: () => { this.rowsLoading = false; }
    });
  }

  refreshValidation(manual = false): void {
    if (!this.job || !this.canRefreshValidation() || this.refreshingValidation) {
      return;
    }

    this.refreshingValidation = true;
    this.importService.refreshValidation(this.job.id).subscribe({
      next: updatedJob => {
        this.job = updatedJob;
        this.refreshingValidation = false;
        if (manual) {
          this.snackBar.open('Validation refreshed against the latest master data.', 'Close', { duration: 5000 });
        }
        this.loadComparison();
        this.loadRows();
      },
      error: err => {
        this.refreshingValidation = false;
        this.snackBar.open(err?.error?.error ?? 'Unable to refresh validation.', 'Close', { duration: 7000 });
        this.loadComparison();
        this.loadRows();
      }
    });
  }

  clearFilters(): void {
    this.filtersForm.reset({ search: '', status: '', comparison: '' });
  }

  onRowPage(e: PageEvent) { this.rowPage = e.pageIndex + 1; this.rowPageSize = e.pageSize; this.loadRows(); }

  approveForPublication(): void {
    if (!this.job || this.job.statusLabel !== 'AwaitingApproval' || this.approving) return;

    const summary: { newRows: number; modifiedRows: number; unchangedRows: number; missingRows: ComparisonMissingItem[] } = this.comparison
      ? {
          newRows: this.comparison.newRows,
          modifiedRows: this.comparison.modifiedRows,
          unchangedRows: this.comparison.unchangedRows,
          missingRows: this.comparison.missingRows
        }
      : {
          newRows: this.job.validRows + this.job.warningRows,
          modifiedRows: 0,
          unchangedRows: 0,
          missingRows: []
        };

    const dialogRef = this.dialog.open(AnnualCommitConfirmDialogComponent, {
      width: '980px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      autoFocus: false,
      disableClose: false,
      panelClass: 'annual-commit-dialog-panel',
      data: {
        datasetLabel: this.job.entityTypeLabel,
        originalFileName: this.job.originalFileName,
        hasBaseline: !!this.comparison?.hasBaseline,
        newRows: summary.newRows,
        modifiedRows: summary.modifiedRows,
        unchangedRows: summary.unchangedRows,
        missingRows: summary.missingRows
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.approving = true;
        this.importService.approve(this.job!.id).subscribe({
          next: approvedJob => {
            this.job = approvedJob;
            this.approving = false;
            this.showRejectPanel = false;
            this.rejectionReason = '';
            this.hydratePublicationApproval(approvedJob, summary);
            this.loadApprovalSnapshot();
            this.snackBar.open('Approved for publication. CPQ has not been changed yet.', 'Close', { duration: 6000 });
          },
          error: err => {
            this.approving = false;
            this.snackBar.open(err?.error?.error ?? 'Approval failed.', 'Close', { duration: 7000 });
          }
        });
      }
    });
  }

  publishToCpq(): void {
    if (!this.job || !this.publicationApproval || this.committing) {
      return;
    }

    const dialogRef = this.dialog.open(PublicationConfirmDialogComponent, {
      width: '680px',
      maxWidth: '94vw',
      autoFocus: false,
      data: {
        datasetLabel: this.job.entityTypeLabel,
        originalFileName: this.job.originalFileName,
        approval: this.publicationApproval
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.executePublication();
      }
    });
  }

  returnToReview(): void {
    if (!this.job || this.job.statusLabel !== 'Approved' || this.committing || this.returningToReview) {
      return;
    }

    this.returningToReview = true;
    this.importService.returnToReview(this.job.id).subscribe({
      next: reviewedJob => {
        this.job = reviewedJob;
        this.publicationApproval = null;
        this.approvalSnapshot = null;
        this.returningToReview = false;
        this.loadComparison();
        this.snackBar.open('Approval returned to review. CPQ was not changed.', 'Close', { duration: 5000 });
      },
      error: err => {
        this.returningToReview = false;
        this.snackBar.open(err?.error?.error ?? 'Could not return the submission to review.', 'Close', { duration: 7000 });
      }
    });
  }

  private executePublication(): void {
    if (!this.job) return;
    this.committing = true;
    this.importService.publish(this.job.id).subscribe({
      next: result => {
        this.publicationApproval = null;
        this.snackBar.open(result.message, 'Close', { duration: 5000, panelClass: 'snack-success' });
        this.committing = false;
        this.importService.getJob(this.job!.id).subscribe(j => {
          this.job = j;
          this.loadApprovalSnapshot();
          this.loadComparison();
        });
      },
      error: err => {
        const isForbidden = err?.status === 403;
        const message = isForbidden
          ? 'You are not authorized to publish. If your role was just updated, sign out and sign in again.'
          : (err?.error?.error ?? 'Publication failed.');

        this.snackBar.open(message, 'Close', { duration: 7000 });
        this.committing = false;
      }
    });
  }

  reject() {
    if (!this.job || !this.rejectionReason) return;
    this.rejecting = true;
    this.importService.reject(this.job.id, this.rejectionReason).subscribe({
      next: j => {
        this.job = j;
        this.rejecting = false;
        this.showRejectPanel = false;
        this.rejectionReason = '';
        this.snackBar.open('Import rejected.', 'Close', { duration: 4000 });
      },
      error: err => {
        this.snackBar.open(err?.error?.error ?? 'Reject failed.', 'Close', { duration: 6000 });
        this.rejecting = false;
      }
    });
  }

  cancelImport(): void {
    if (!this.job || !this.canCancelJob()) {
      return;
    }

    const confirmed = window.confirm(
      'Permanently delete this private draft and all of its staged rows? This cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    this.workflowActionRunning = true;
    this.importService.deletePrivateDraft(this.job.id).subscribe({
      next: () => {
        this.workflowActionRunning = false;
        this.snackBar.open('Private draft permanently deleted.', 'Close', { duration: 5000 });
        this.router.navigate(['/uploads'], { queryParams: { space: 'workspace' } });
      },
      error: err => {
        this.workflowActionRunning = false;
        this.snackBar.open(err?.error?.error ?? 'The private draft could not be deleted.', 'Close', { duration: 7000 });
      }
    });
  }

  private hydratePublicationApproval(
    job: ImportJob,
    summary?: { newRows: number; modifiedRows: number; missingRows: ComparisonMissingItem[] }
  ): void {
    this.publicationApproval = null;
    if (job.statusLabel !== 'Approved' || !job.approvedAt || !job.approvedByDisplayName) {
      return;
    }

    this.publicationApproval = {
      approvedAt: job.approvedAt,
      approvedBy: job.approvedByDisplayName,
      newRows: summary?.newRows ?? 0,
      modifiedRows: summary?.modifiedRows ?? 0,
      missingRows: summary?.missingRows.length ?? 0
    };
  }

  downloadOriginal() {
    if (!this.job) return;
    this.importService.downloadOriginal(this.job.id).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${this.job!.originalFileName}${this.job!.fileExtension}`;
      a.click();
    });
  }

  downloadErrors() {
    if (!this.job) return;
    this.importService.downloadErrorReport(this.job.id).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `errors_${this.job!.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, async (err) => {
      let message = 'Failed to download the error report.';

      if (err?.error instanceof Blob) {
        try {
          const text = await err.error.text();
          message = text || message;
        } catch {
          // Keep the generic message if the blob cannot be read.
        }
      } else if (err?.error?.error) {
        message = err.error.error;
      }

      this.snackBar.open(message, 'Close', { duration: 7000 });
    });
  }

  downloadComparisonReport(): void {
    if (!this.job || !this.canDownloadComparisonReport()) return;
    this.importService.downloadComparisonReport(this.job.id).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `comparison_${this.job!.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, async (err) => {
      let message = 'Failed to download the comparison report.';

      if (err?.error instanceof Blob) {
        try {
          const text = await err.error.text();
          message = text || message;
        } catch {
          // Keep the generic message if the blob cannot be read.
        }
      } else if (err?.error?.error) {
        message = err.error.error;
      }

      this.snackBar.open(message, 'Close', { duration: 7000 });
    });
  }

  editRow(row: StagingRow): void {
    if (!this.job || !this.isPrivateWorkspace) return;
    this.activeDraftEditorRow = row;
    this.activeDraftEditorMode = 'edit';
  }
}

