import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ImportService } from '../../core/services/import.service';
import { ImportJob, PagedResult } from '../../core/models/import.models';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatChipsModule, MatProgressSpinnerModule, MatPaginatorModule,
    MatTooltipModule, StatusBadgeComponent],
  template: `
    <div class="page-header">
      <h1>Import Dashboard</h1>
      <button mat-raised-button color="primary" (click)="newImport()">
        <mat-icon>add</mat-icon> New Import
      </button>
    </div>

    <!-- Summary cards -->
    <div class="summary-cards" *ngIf="result">
      <mat-card class="summary-card awaiting">
        <div class="summary-main">
          <mat-icon>pending_actions</mat-icon>
          <div class="value">{{ awaitingCount }}</div>
        </div>
        <div class="label">Awaiting Approval</div>
      </mat-card>
      <mat-card class="summary-card committed">
        <div class="summary-main">
          <mat-icon>check_circle</mat-icon>
          <div class="value">{{ committedCount }}</div>
        </div>
        <div class="label">Committed Today</div>
      </mat-card>
      <mat-card class="summary-card rejected">
        <div class="summary-main">
          <mat-icon>cancel</mat-icon>
          <div class="value">{{ rejectedCount }}</div>
        </div>
        <div class="label">Rejected</div>
      </mat-card>
      <mat-card class="summary-card total">
        <div class="summary-main">
          <mat-icon>list</mat-icon>
          <div class="value">{{ result.total }}</div>
        </div>
        <div class="label">Total Imports</div>
      </mat-card>
    </div>

    <!-- Loading -->
    <div class="loading-container" *ngIf="loading">
      <mat-spinner diameter="40"></mat-spinner>
    </div>

    <!-- Table -->
    <mat-card *ngIf="result && !loading">
      <mat-card-header>
        <mat-card-title>Recent Imports</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="table-scroll desktop-table-wrap">
        <table mat-table [dataSource]="result.items" class="full-width-table">
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let job">
              <app-status-badge [status]="job.statusLabel" />
            </td>
          </ng-container>

          <ng-container matColumnDef="fileName">
            <th mat-header-cell *matHeaderCellDef>File</th>
            <td mat-cell *matCellDef="let job">
              <div class="file-cell">
                <mat-icon class="file-icon">description</mat-icon>
                <span>{{ job.originalFileName }}</span>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="entityType">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let job">{{ job.entityTypeLabel }}</td>
          </ng-container>

          <ng-container matColumnDef="rows">
            <th mat-header-cell *matHeaderCellDef>Rows</th>
            <td mat-cell *matCellDef="let job">
              <span class="row-count" [matTooltip]="'Valid: ' + job.validRows + ', Warnings: ' + job.warningRows + ', Errors: ' + job.errorRows">
                {{ job.totalRows }}
                <mat-icon *ngIf="job.errorRows > 0" color="warn" style="font-size:16px">warning</mat-icon>
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="createdBy">
            <th mat-header-cell *matHeaderCellDef>Uploaded By</th>
            <td mat-cell *matCellDef="let job">{{ job.createdByDisplayName }}</td>
          </ng-container>

          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let job">{{ job.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let job">
              <button mat-icon-button color="primary" (click)="view(job)" matTooltip="View preview">
                <mat-icon>visibility</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="clickable-row" (click)="view(row)"></tr>
        </table>
        </div>

        <div class="mobile-list" aria-label="Recent imports mobile list">
          <button type="button" class="mobile-job-card" *ngFor="let job of result.items" (click)="view(job)">
            <div class="mobile-card-top">
              <app-status-badge [status]="job.statusLabel" />
              <span class="mobile-date">{{ job.createdAt | date:'dd/MM HH:mm' }}</span>
            </div>

            <div class="mobile-file">
              <mat-icon class="file-icon">description</mat-icon>
              <span>{{ job.originalFileName }}</span>
            </div>

            <div class="mobile-meta">
              <span class="meta-pill">{{ job.entityTypeLabel }}</span>
              <span class="meta-pill">{{ job.totalRows }} rows</span>
              <span class="meta-pill warn" *ngIf="job.errorRows > 0">{{ job.errorRows }} errors</span>
            </div>

            <div class="mobile-byline">Uploaded by {{ job.createdByDisplayName }}</div>
          </button>
        </div>

        <mat-paginator
          [length]="result.total"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPage($event)">
        </mat-paginator>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 24px; font-weight: 400; }
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .summary-card { display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 12px 14px; border-top: 3px solid transparent; }
    .summary-main { display: flex; align-items: center; gap: 10px; }
    .summary-card mat-icon { font-size: 26px; height: 26px; width: 26px; }
    .summary-card .value { font-size: 30px; font-weight: 600; line-height: 1; }
    .summary-card .label { font-size: 12px; color: rgba(0,0,0,0.62); }
    .summary-card.awaiting { border-top-color: #f57f17; }
    .summary-card.committed { border-top-color: #2e7d32; }
    .summary-card.rejected { border-top-color: #c62828; }
    .summary-card.total { border-top-color: #1565c0; }
    .summary-card.awaiting mat-icon { color: #f57f17; }
    .summary-card.committed mat-icon { color: #2e7d32; }
    .summary-card.rejected mat-icon { color: #c62828; }
    .summary-card.total mat-icon { color: #1565c0; }
    .loading-container { display: flex; justify-content: center; padding: 60px; }
    .table-scroll { overflow-x: auto; }
    .desktop-table-wrap { display: block; }
    .full-width-table { width: 100%; }
    .mobile-list { display: none; }
    .mobile-job-card {
      width: 100%; text-align: left; border: 1px solid #e5e7eb; background: #fff; border-radius: 12px;
      padding: 10px; margin-bottom: 10px; cursor: pointer;
    }
    .mobile-card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
    .mobile-date { font-size: 12px; color: rgba(0,0,0,0.54); white-space: nowrap; }
    .mobile-file { display: flex; align-items: center; gap: 6px; font-weight: 500; margin-bottom: 8px; }
    .mobile-file span {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }
    .mobile-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .meta-pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #f3f4f6; color: #334155; }
    .meta-pill.warn { background: #fff1f2; color: #b91c1c; }
    .mobile-byline { font-size: 12px; color: rgba(0,0,0,0.65); }
    .file-cell { display: flex; align-items: center; gap: 8px; }
    .file-icon { font-size: 18px; color: rgba(0,0,0,0.38); }
    .row-count { display: flex; align-items: center; gap: 4px; }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background: #f5f5f5; }

    @media (max-width: 900px) {
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
      .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
      .desktop-table-wrap { display: none; }
      .mobile-list { display: block; }
    }

    @media (max-width: 600px) {
      .summary-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      h1 { font-size: 22px; }
      .summary-card { padding: 10px; gap: 4px; }
      .summary-main { gap: 8px; }
      .summary-card mat-icon { font-size: 22px; height: 22px; width: 22px; }
      .summary-card .value { font-size: 24px; }
      .summary-card .label { font-size: 11px; line-height: 1.2; }
      .mobile-job-card { padding: 9px; margin-bottom: 8px; }
    }

    @media (max-width: 380px) {
      .summary-cards { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly importService = inject(ImportService);
  private readonly router = inject(Router);

  result: PagedResult<ImportJob> | null = null;
  loading = false;
  page = 1;
  pageSize = 20;
  displayedColumns = ['status', 'fileName', 'entityType', 'rows', 'createdBy', 'createdAt', 'actions'];

  get awaitingCount() { return this.result?.items.filter(j => j.statusLabel === 'AwaitingApproval').length ?? 0; }
  get committedCount() { return this.result?.items.filter(j => j.statusLabel === 'Committed').length ?? 0; }
  get rejectedCount() { return this.result?.items.filter(j => j.statusLabel === 'Rejected').length ?? 0; }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.importService.getJobs(this.page, this.pageSize).subscribe({
      next: r => { this.result = r; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  onPage(e: PageEvent) {
    this.page = e.pageIndex + 1;
    this.pageSize = e.pageSize;
    this.load();
  }

  view(job: ImportJob) {
    this.router.navigate(['/import', job.id]);
  }

  newImport() {
    this.router.navigate(['/import/new']);
  }
}
