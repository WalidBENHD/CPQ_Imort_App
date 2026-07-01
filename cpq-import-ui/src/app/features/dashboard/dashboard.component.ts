import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DashboardAttentionItem, DashboardOverview, ImportJob } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    StatusBadgeComponent
  ],
  template: `
    <div class="dashboard-shell">
      <div class="page-header">
        <div>
          <div class="eyebrow">Operational workspace</div>
          <h1>Dashboard</h1>
          <p class="page-intro">A compact view of current queue status, exceptions and recent uploads.</p>
        </div>

        <div class="header-actions">
        </div>
      </div>

      <ng-container *ngIf="overview; else loadingState">
        <section class="summary-cards">
          <mat-card class="summary-card awaiting">
            <div class="summary-top">
              <mat-icon>pending_actions</mat-icon>
              <span>Awaiting Approval</span>
            </div>
            <div class="summary-value">{{ overview.summary.awaitingApproval }}</div>
          </mat-card>

          <mat-card class="summary-card committed">
            <div class="summary-top">
              <mat-icon>check_circle</mat-icon>
              <span>Committed Today</span>
            </div>
            <div class="summary-value">{{ overview.summary.committedToday }}</div>
          </mat-card>

          <mat-card class="summary-card rejected">
            <div class="summary-top">
              <mat-icon>cancel</mat-icon>
              <span>Rejected</span>
            </div>
            <div class="summary-value">{{ overview.summary.rejected }}</div>
          </mat-card>

          <mat-card class="summary-card total">
            <div class="summary-top">
              <mat-icon>description</mat-icon>
              <span>Total Submissions</span>
            </div>
            <div class="summary-value">{{ overview.summary.totalSubmissions }}</div>
          </mat-card>
        </section>

        <mat-card class="status-strip" *ngIf="topAttention">
          <div class="status-strip-copy">
            <span class="status-strip-label">Priority</span>
            <strong>{{ topAttention.dataset }}</strong>
            <span>{{ topAttention.message }}</span>
          </div>
          <button mat-stroked-button color="primary" (click)="openAttention(topAttention)">
            Review
          </button>
        </mat-card>

        <mat-card class="panel">
          <mat-card-header class="panel-header">
            <mat-card-title>Latest uploads</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="recent-list">
              <button type="button" class="recent-item" *ngFor="let job of overview.recentSubmissions" (click)="view(job)">
                <app-status-badge [status]="job.statusLabel" />
                <div class="recent-main">
                  <div class="recent-name">{{ job.originalFileName }}</div>
                  <div class="recent-meta">
                    <span>{{ job.entityTypeLabel }}</span>
                    <span>{{ job.createdByDisplayName }}</span>
                    <span>{{ job.createdAt | date:'dd/MM HH:mm' }}</span>
                  </div>
                </div>
                <mat-icon class="open-icon">chevron_right</mat-icon>
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </ng-container>

      <ng-template #loadingState>
        <mat-card class="loading-card">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Loading dashboard</span>
        </mat-card>
      </ng-template>
    </div>
  `,
  styles: [`
    .dashboard-shell { display: flex; flex-direction: column; gap: 16px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
    .eyebrow { color: #2563eb; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    h1 { margin: 0; font-size: 28px; font-weight: 800; color: #0f172a; }
    .page-intro { margin: 8px 0 0; color: #475569; }
    .header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .header-actions button { border-radius: 999px; min-height: 40px; font-weight: 700; }
    .header-actions mat-icon { margin-right: 4px; }
    .summary-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .summary-card { border: 1px solid #dbe4f0; box-shadow: none; padding: 14px; }
    .summary-top { display: flex; align-items: center; gap: 8px; color: #475569; font-size: 13px; font-weight: 700; margin-bottom: 8px; }
    .summary-top mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .summary-value { font-size: 30px; font-weight: 800; color: #0f172a; line-height: 1; }
    .summary-card.awaiting { border-top: 3px solid #f59e0b; }
    .summary-card.committed { border-top: 3px solid #16a34a; }
    .summary-card.rejected { border-top: 3px solid #dc2626; }
    .summary-card.total { border-top: 3px solid #2563eb; }
    .summary-card.awaiting mat-icon { color: #f59e0b; }
    .summary-card.committed mat-icon { color: #16a34a; }
    .summary-card.rejected mat-icon { color: #dc2626; }
    .summary-card.total mat-icon { color: #2563eb; }
    .status-strip { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid #dbe4f0; box-shadow: none; background: #fff; }
    .status-strip-copy { display: flex; align-items: center; gap: 10px; color: #334155; flex-wrap: wrap; }
    .status-strip-label { color: #2563eb; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .status-strip strong { font-weight: 800; }
    .panel { border: 1px solid #dbe4f0; box-shadow: none; }
    .panel-header { display: flex; justify-content: space-between; align-items: center; }
    .panel-header button { border-radius: 999px; }
    .recent-list { display: flex; flex-direction: column; gap: 10px; }
    .recent-item { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; border: 1px solid #e2e8f0; background: #fff; border-radius: 14px; padding: 12px; cursor: pointer; }
    .recent-item:hover { border-color: #c7d2fe; box-shadow: 0 8px 16px rgba(15, 23, 42, 0.05); }
    .recent-main { flex: 1; min-width: 0; }
    .recent-name { font-weight: 800; color: #0f172a; word-break: break-word; }
    .recent-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; color: #64748b; font-size: 12px; }
    .open-icon { color: #94a3b8; }
    .loading-card { display: flex; align-items: center; gap: 12px; padding: 18px; border: 1px solid #dbe4f0; box-shadow: none; }
    @media (max-width: 900px) {
      .page-header { flex-direction: column; align-items: flex-start; }
      .header-actions { width: 100%; }
      .header-actions button { width: 100%; justify-content: center; }
      .summary-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .status-strip { flex-direction: column; align-items: flex-start; }
      .status-strip button { width: 100%; }
    }
    @media (max-width: 640px) {
      h1 { font-size: 24px; }
      .summary-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .summary-card { padding: 12px; }
      .summary-value { font-size: 26px; }
      .panel-header { flex-direction: column; align-items: flex-start; }
      .panel-header button { width: 100%; }
    }
    @media (max-width: 380px) {
      .summary-cards { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly importService = inject(ImportService);
  private readonly router = inject(Router);

  overview: DashboardOverview | null = null;
  loading = false;

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.importService.getDashboardOverview().subscribe({
      next: overview => {
        this.overview = overview;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get topAttention(): DashboardAttentionItem | null {
    return this.overview?.attentionItems?.[0] ?? null;
  }

  openAttention(item: DashboardAttentionItem) {
    if (item.jobId) {
      this.router.navigate(['/import', item.jobId]);
    } else {
      this.router.navigate(['/uploads']);
    }
  }

  view(job: ImportJob) {
    this.router.navigate(['/import', job.id]);
  }

}
