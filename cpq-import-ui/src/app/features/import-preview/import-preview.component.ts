import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { MatDividerModule } from '@angular/material/divider';
import { ImportService } from '../../core/services/import.service';
import { ImportJob, PagedResult, RowStatus, StagingRow } from '../../core/models/import.models';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { AuthFacade } from '../../core/auth/auth.facade';

@Component({
  selector: 'app-import-preview',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatChipsModule, MatProgressSpinnerModule, MatPaginatorModule,
    MatTabsModule, MatDialogModule, MatSnackBarModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, MatDividerModule, StatusBadgeComponent],
  template: `
    <div class="page-header">
      <div>
        <a mat-button routerLink="/dashboard" class="back-btn">
          <mat-icon>arrow_back</mat-icon> Dashboard
        </a>
        <h1 *ngIf="job">{{ job.originalFileName }}</h1>
      </div>
      <div class="header-actions" *ngIf="job">
        <button mat-stroked-button (click)="downloadOriginal()" matTooltip="Download original file">
          <mat-icon>download</mat-icon> Original
        </button>
        <button mat-stroked-button *ngIf="job.errorRows > 0" (click)="downloadErrors()" matTooltip="Download error report">
          <mat-icon>error_outline</mat-icon> Error Report
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
              <div class="label">Data Type</div>
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
              — {{ job.committedRows }} rows written to database.
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Approval actions (approvers only, when AwaitingApproval) -->
      <mat-card class="action-card" *ngIf="job.statusLabel === 'AwaitingApproval' && auth.isApprover">
        <mat-card-content>
          <div class="action-bar">
            <div class="action-info">
              <mat-icon color="primary">info</mat-icon>
              <span>
                {{ job.validRows + job.warningRows }} rows are ready to commit
                <span *ngIf="job.errorRows > 0"> ({{ job.errorRows }} error rows will be skipped)</span>.
              </span>
            </div>
            <div class="action-buttons">
              <button mat-raised-button color="primary" (click)="commit()" [disabled]="committing">
                <mat-icon>check</mat-icon> {{ committing ? 'Committing...' : 'Approve & Commit' }}
              </button>
              <button mat-stroked-button color="warn" (click)="showRejectPanel = true" class="ml-8">
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
      <mat-card>
        <mat-card-header>
          <mat-card-title>Data Preview</mat-card-title>
          <div class="filter-chips">
            <button mat-stroked-button [class.active-filter]="!rowFilter" (click)="setFilter(null)">All ({{ job.totalRows }})</button>
            <button mat-stroked-button [class.active-filter]="rowFilter === 'Valid'" (click)="setFilter('Valid')">
              ✓ Valid ({{ job.validRows }})
            </button>
            <button mat-stroked-button [class.active-filter]="rowFilter === 'Warning'" (click)="setFilter('Warning')">
              ⚠ Warnings ({{ job.warningRows }})
            </button>
            <button mat-stroked-button color="warn" [class.active-filter]="rowFilter === 'Error'" (click)="setFilter('Error')">
              ✗ Errors ({{ job.errorRows }})
            </button>
          </div>
        </mat-card-header>

        <mat-card-content>
          <div class="loading-container" *ngIf="rowsLoading">
            <mat-spinner diameter="32"></mat-spinner>
          </div>

          <div class="table-wrapper" *ngIf="rows && !rowsLoading">
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

              <ng-container *ngFor="let col of dynamicColumns" [matColumnDef]="col">
                <th mat-header-cell *matHeaderCellDef>{{ col }}</th>
                <td mat-cell *matCellDef="let row">{{ row.fields[col] }}</td>
              </ng-container>

              <ng-container matColumnDef="messages">
                <th mat-header-cell *matHeaderCellDef>Validation</th>
                <td mat-cell *matCellDef="let row">
                  <span *ngFor="let m of row.validationMessages" class="validation-msg" [class]="'msg-' + m.severity.toLowerCase()">
                    {{ m.field }}: {{ m.message }}
                  </span>
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
    .header-actions { display: flex; gap: 8px; margin-top: 24px; }
    .loading-container { display: flex; justify-content: center; padding: 60px; }
    .summary-card { margin-bottom: 16px; }
    .summary-grid-metadata, .summary-grid-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .summary-item { padding: 0; }
    .summary-item .label { font-size: 11px; color: rgba(0,0,0,0.54); text-transform: uppercase; margin-bottom: 4px; font-weight: 600; }
    .summary-item .value { font-size: 16px; font-weight: 600; color: rgba(0,0,0,0.65); }
    .summary-item .valid-count { color: #2e7d32; }
    .summary-item .warning-count { color: #f57f17; }
    .summary-item .error-count { color: #c62828; }
    .rejection-box, .commit-box { display: flex; align-items: flex-start; gap: 12px; margin-top: 16px; padding: 12px; border-radius: 4px; background: #fff3e0; }
    .rejection-box { background: #ffebee; }
    .commit-box { background: #e8f5e9; }
    .rejection-reason { color: rgba(0,0,0,0.7); margin-top: 4px; }
    .action-card { margin-bottom: 16px; }
    .action-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
    .action-info { display: flex; align-items: center; gap: 8px; color: rgba(0,0,0,0.7); }
    .action-buttons { display: flex; }
    .ml-8 { margin-left: 8px; }
    .reject-panel { margin-top: 16px; }
    .reject-form { padding-top: 16px; }
    .full-width { width: 100%; }
    .reject-actions { display: flex; align-items: center; }
    mat-card-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .filter-chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .active-filter { background: #e8eaf6 !important; border-color: #3f51b5 !important; color: #3f51b5; }
    .table-wrapper { overflow-x: auto; }
    table { min-width: 600px; }
    .validation-msg { display: block; font-size: 11px; margin-bottom: 2px; }
    .msg-error { color: #c62828; }
    .msg-warning { color: #f57f17; }
    .msg-info { color: #1565c0; }
  `]
})
export class ImportPreviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly importService = inject(ImportService);
  private readonly snackBar = inject(MatSnackBar);
  readonly auth = inject(AuthFacade);

  job: ImportJob | null = null;
  rows: PagedResult<StagingRow> | null = null;
  loading = false;
  rowsLoading = false;
  rowFilter: RowStatus | null = null;
  rowPage = 1;
  rowPageSize = 50;
  committing = false;
  rejecting = false;
  showRejectPanel = false;
  rejectionReason = '';

  dynamicColumns: string[] = [];
  get allColumns() { return ['rowNum', 'status', ...this.dynamicColumns, 'messages']; }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loading = true;
    this.importService.getJob(id).subscribe({
      next: j => { this.job = j; this.loading = false; this.loadRows(); },
      error: () => { this.loading = false; }
    });
  }

  loadRows() {
    if (!this.job) return;
    this.rowsLoading = true;
    this.importService.getRows(this.job.id, this.rowPage, this.rowPageSize, this.rowFilter ?? undefined).subscribe({
      next: r => {
        this.rows = r;
        if (r.items.length > 0)
          this.dynamicColumns = Object.keys(r.items[0].fields);
        this.rowsLoading = false;
      },
      error: () => { this.rowsLoading = false; }
    });
  }

  setFilter(f: RowStatus | null) { this.rowFilter = f; this.rowPage = 1; this.loadRows(); }

  onRowPage(e: PageEvent) { this.rowPage = e.pageIndex + 1; this.rowPageSize = e.pageSize; this.loadRows(); }

  commit() {
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
    });
  }
}
