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
      <button mat-raised-button color="primary" routerLink="/import/new">
        <mat-icon>add</mat-icon> New Import
      </button>
    </div>

    <!-- Summary cards -->
    <div class="summary-cards" *ngIf="result">
      <mat-card class="summary-card awaiting">
        <mat-icon>pending_actions</mat-icon>
        <div class="value">{{ awaitingCount }}</div>
        <div class="label">Awaiting Approval</div>
      </mat-card>
      <mat-card class="summary-card committed">
        <mat-icon>check_circle</mat-icon>
        <div class="value">{{ committedCount }}</div>
        <div class="label">Committed Today</div>
      </mat-card>
      <mat-card class="summary-card rejected">
        <mat-icon>cancel</mat-icon>
        <div class="value">{{ rejectedCount }}</div>
        <div class="label">Rejected</div>
      </mat-card>
      <mat-card class="summary-card total">
        <mat-icon>list</mat-icon>
        <div class="value">{{ result.total }}</div>
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
    .summary-card { display: flex; flex-direction: column; align-items: center; padding: 16px; }
    .summary-card mat-icon { font-size: 36px; height: 36px; width: 36px; }
    .summary-card .value { font-size: 28px; font-weight: 500; margin-top: 8px; }
    .summary-card .label { font-size: 12px; color: rgba(0,0,0,0.54); margin-top: 4px; }
    .summary-card.awaiting mat-icon { color: #f57f17; }
    .summary-card.committed mat-icon { color: #2e7d32; }
    .summary-card.rejected mat-icon { color: #c62828; }
    .summary-card.total mat-icon { color: #1565c0; }
    .loading-container { display: flex; justify-content: center; padding: 60px; }
    .full-width-table { width: 100%; }
    .file-cell { display: flex; align-items: center; gap: 8px; }
    .file-icon { font-size: 18px; color: rgba(0,0,0,0.38); }
    .row-count { display: flex; align-items: center; gap: 4px; }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background: #f5f5f5; }
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
}
