import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { ImportService } from '../../core/services/import.service';
import { ComparisonFieldChange, ComparisonMissingItem, ComparisonRow, ComparisonStatus, DatasetRequirement, ImportComparison, ImportJob, PagedResult, RowStatus, StagingRow } from '../../core/models/import.models';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { AuthFacade } from '../../core/auth/auth.facade';
import { EditRowDialogComponent } from './edit-row-dialog.component';
import { AnnualCommitConfirmDialogComponent } from './annual-commit-confirm-dialog.component';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-import-preview',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatChipsModule, MatProgressSpinnerModule, MatPaginatorModule,
    MatTabsModule, MatDialogModule, MatSnackBarModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDividerModule,
    StatusBadgeComponent, AnnualCommitConfirmDialogComponent],
  template: `
    <div class="page-header">
      <div>
        <a mat-button routerLink="/dashboard" class="back-btn">
          <mat-icon>arrow_back</mat-icon> Dashboard
        </a>
        <h1 *ngIf="job">{{ job.originalFileName }}</h1>
      </div>
      <div class="header-actions" *ngIf="job">
        <button mat-stroked-button class="header-action-btn action-original" (click)="downloadOriginal()" matTooltip="Download original file">
          <mat-icon>download</mat-icon> Original
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
        <button
          mat-stroked-button
          class="header-action-btn action-cancel"
          *ngIf="canCancelJob()"
          (click)="cancelImport()"
          matTooltip="Cancel this request and upload a corrected file">
          <mat-icon>block</mat-icon> Cancel request
        </button>
      </div>
    </div>

    <div class="loading-container" *ngIf="loading && !job">
      <mat-spinner diameter="40"></mat-spinner>
    </div>

    <ng-container *ngIf="job">
      <!-- Job summary -->
      <mat-card class="summary-card">
        <mat-card-content>
          <div class="summary-grid-metadata">
            <div class="summary-item">
              <div class="label">Status</div>
              <app-status-badge [status]="job.statusLabel" />
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
              <strong>Committed by {{ job.committedBy }}</strong> on {{ job.committedAt | date:'dd/MM/yyyy HH:mm' }}
              â€” {{ job.committedRows }} rows written to database.
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="comparison-card">
        <mat-card-content>
          <div class="comparison-header">
            <div class="comparison-copy">
              <div class="label">{{ comparison?.hasBaseline ? 'Annual update comparison' : 'Initial baseline submission' }}</div>
              <h3>
                {{ comparison?.hasBaseline
                  ? 'Compared against the latest approved baseline'
                  : 'This submission establishes the approved baseline' }}
              </h3>
              <p *ngIf="comparison?.hasBaseline; else noBaselineMessage">
                This pilot treats the upload as a new annual submission, then compares it to the last approved baseline.
                Approvers focus on new, modified, and missing rows instead of reviewing every row from scratch.
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
        </mat-card-content>
      </mat-card>

      <mat-card class="correction-card" *ngIf="job.statusLabel === 'NeedsCorrection' || (job.statusLabel === 'AwaitingApproval' && job.errorRows > 0)">
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

      <!-- Approval actions (approvers only, when AwaitingApproval) -->
      <mat-card class="action-card" *ngIf="job.statusLabel === 'AwaitingApproval' && auth.isApprover">
        <mat-card-content>
          <div class="action-bar">
            <div class="action-info">
              <mat-icon color="primary">info</mat-icon>
              <span>
                <ng-container *ngIf="comparison; else actionFallback">
                  {{ comparison.newRows + comparison.modifiedRows + comparison.unchangedRows }} rows are compared with the baseline.
                  {{ comparison.newRows }} new, {{ comparison.modifiedRows }} modified, and {{ comparison.missingBaselineRows }} missing rows need attention.
                </ng-container>
                <ng-template #actionFallback>
                  {{ job.validRows + job.warningRows }} rows are ready to commit
                  <span *ngIf="job.errorRows > 0"> ({{ job.errorRows }} error rows will be skipped)</span>.
                </ng-template>
              </span>
            </div>
            <div class="action-buttons">
              <button mat-raised-button color="primary" class="btn-commit" (click)="commit()" [disabled]="committing">
                <mat-icon>check</mat-icon> {{ committing ? 'Committing...' : 'Approve annual update' }}
              </button>
              <button mat-stroked-button color="warn" class="btn-reject ml-8" (click)="showRejectPanel = true">
                <mat-icon>close</mat-icon> Reject
              </button>
            </div>
          </div>

          <div class="reject-panel" *ngIf="showRejectPanel">
            <mat-divider></mat-divider>
            <div class="reject-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Rejection Reason</mat-label>
                <textarea matInput [(ngModel)]="rejectionReason" rows="2" placeholder="Enter reason..."></textarea>
              </mat-form-field>
              <div class="reject-actions">
                <button mat-raised-button color="warn" (click)="reject()" [disabled]="!rejectionReason || rejecting">
                  Confirm Rejection
                </button>
                <button mat-button (click)="showRejectPanel = false; rejectionReason = ''" class="ml-8">Cancel</button>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Rows table -->
      <mat-card class="rows-card">
        <mat-card-header class="rows-header">
          <mat-card-title>Data Preview</mat-card-title>
          <div class="list-meta">{{ rows?.total ?? job.totalRows }} matching rows</div>
        </mat-card-header>

        <mat-card-content>
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
                    matTooltip="Correct row">
                    <mat-icon>edit</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="allColumns; sticky: true"></tr>
              <tr mat-row *matRowDef="let row; columns: allColumns"
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
              [class.row-valid]="row.statusLabel === 'Valid'"
              [class.row-warning]="row.statusLabel === 'Warning'"
              [class.row-error]="row.statusLabel === 'Error'">

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
                    Correct row
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
    </ng-container>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .back-btn { margin-bottom: 4px; }
    h1 { margin: 0; font-size: 20px; font-weight: 400; }
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
    }
    .full-width { width: 100%; }
    .reject-actions { display: flex; align-items: center; }
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
    .rows-header {
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .table-wrapper { overflow-x: auto; width: 100%; }
    .desktop-rows { display: block; }
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
    .desktop-rows .mat-mdc-row:hover { background: #f5f5f5; }
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
    @media (max-width: 900px) {
      .page-header { flex-direction: column; gap: 10px; }
      .header-actions { margin-top: 0; width: 100%; flex-wrap: wrap; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .summary-grid-metadata, .summary-grid-stats { grid-template-columns: repeat(2, 1fr); }
      .action-bar { flex-direction: column; align-items: flex-start; }
      .action-buttons { width: 100%; flex-wrap: wrap; }
      .action-buttons button { flex: 1; min-width: 180px; }
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
      .correction-card {
        flex-direction: column;
        align-items: stretch;
      }
      .correction-card button { width: 100%; }
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
    }

    @media (max-width: 390px) {
      .summary-grid-metadata, .summary-grid-stats { grid-template-columns: 1fr; }
    }
  `]
})
export class ImportPreviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly importService = inject(ImportService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly auth = inject(AuthFacade);

  job: ImportJob | null = null;
  datasetRequirement: DatasetRequirement | null = null;
  comparison: ImportComparison | null = null;
  rows: PagedResult<StagingRow> | null = null;
  loading = false;
  comparisonLoading = false;
  rowsLoading = false;
  refreshingValidation = false;
  rowPage = 1;
  rowPageSize = 50;
  committing = false;
  rejecting = false;
  showRejectPanel = false;
  rejectionReason = '';
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
  get allColumns() { return ['rowNum', 'status', 'comparison', ...this.dynamicColumns, 'messages', 'actions']; }

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
    return this.job?.statusLabel !== 'Committed'
      && this.job?.statusLabel !== 'Rejected'
      && this.job?.statusLabel !== 'Failed'
      && this.job?.statusLabel !== 'Cancelled'
      && row.statusLabel === 'Error';
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

    const canCancelStatus = this.job.statusLabel === 'AwaitingApproval' || this.job.statusLabel === 'NeedsCorrection';
    return canCancelStatus && this.auth.userId !== '' && this.job.createdBy === this.auth.userId;
  }

  canRefreshValidation(): boolean {
    if (!this.job) {
      return false;
    }

    return !['Committed', 'Rejected', 'Failed', 'Cancelled'].includes(this.job.statusLabel);
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
          this.loading = false;
          this.loadDatasetRequirement(j.entityTypeLabel);
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
    this.rows = null;
    this.comparisonMap.clear();
    this.rowPage = 1;
    this.filtersForm.reset({ search: '', status: '', comparison: '' }, { emitEvent: false });
    this.expandedRows.clear();
  }

  private loadDatasetRequirement(entityTypeLabel: string): void {
    this.importService.getDatasetRequirement(entityTypeLabel).subscribe({
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

  commit(): void {
    if (!this.job || this.committing) return;

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
        this.executeCommit();
      }
    });
  }

  private executeCommit(): void {
    if (!this.job) return;
    this.committing = true;
    this.importService.commit(this.job.id).subscribe({
      next: result => {
        this.snackBar.open(result.message, 'Close', { duration: 5000, panelClass: 'snack-success' });
        this.committing = false;
        this.importService.getJob(this.job!.id).subscribe(j => { this.job = j; });
      },
      error: err => {
        const isForbidden = err?.status === 403;
        const message = isForbidden
          ? 'You are not authorized to commit yet. If your role was just updated, sign out and sign in again.'
          : (err?.error?.error ?? 'Commit failed.');

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
      'Cancel this import request? You can upload a corrected file afterwards.'
    );

    if (!confirmed) {
      return;
    }

    this.loading = true;
    this.importService.cancel(this.job.id).subscribe({
      next: updatedJob => {
        this.job = updatedJob;
        this.loading = false;
        this.snackBar.open(
          'Import request cancelled. Fix the source file and submit a fresh upload.',
          'Close',
          { duration: 6000 }
        );
      },
      error: err => {
        this.loading = false;
        this.snackBar.open(err?.error?.error ?? 'Cancellation failed.', 'Close', { duration: 7000 });
      }
    });
  }

  downloadOriginal() {
    if (!this.job) return;
    this.importService.downloadOriginal(this.job.id).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = this.job!.originalFileName;
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
    if (!this.job) return;

    const errorFields = Array.from(new Set(
      row.validationMessages
        .filter(m => m.severity === 'Error')
        .map(m => m.field)
    ));

    const dialogRef = this.dialog.open(EditRowDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      disableClose: true,
      data: {
        rowNumber: row.rowNumber,
        fields: row.fields,
        errorFields
      }
    });

    dialogRef.afterClosed().subscribe((fields: Record<string, string | null> | null) => {
      if (!fields) {
        return;
      }

      this.rowsLoading = true;
      this.importService.updateRow(this.job!.id, row.id, fields).subscribe({
        next: updatedJob => {
          this.job = updatedJob;
          this.snackBar.open(`Row #${row.rowNumber} updated and revalidated.`, 'Close', { duration: 5000 });
          this.loadRows();
        },
        error: err => {
          this.rowsLoading = false;
          this.snackBar.open(err?.error?.error ?? 'Unable to update row.', 'Close', { duration: 7000 });
        }
      });
    });
  }
}

