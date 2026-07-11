import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthFacade } from '../../core/auth/auth.facade';
import { isLocalAuthMode } from '../../core/auth/auth-mode';
import { LocalAuthService } from '../../core/auth/local-auth.service';
import { AuthUser } from '../../core/models/auth.models';
import { DashboardAttentionItem, DashboardOverview, ImportJob, PILOT_SCOPE } from '../../core/models/import.models';
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
          <p class="page-intro">A compact view of current queue status, exceptions and recent uploads for the pilot scope.</p>
        </div>

        <div class="header-actions">
        </div>
      </div>

      <mat-card class="pilot-scope-strip">
        <div class="pilot-scope-copy">
          <span class="eyebrow eyebrow--soft">Pilot scope</span>
          <strong>{{ pilotScope.site }} - {{ pilotScope.productFamily }}</strong>
          <span>{{ pilotScope.submissionType }} for {{ pilotScope.dataDomains.join(' + ') }}.</span>
        </div>
        <div class="pilot-scope-chips">
          <span class="pilot-chip" *ngFor="let chip of pilotChips">{{ chip }}</span>
        </div>
      </mat-card>

      <ng-container *ngIf="overview; else loadingState">
        <div
          class="dashboard-grid"
          [class.dashboard-grid--admin]="showAdminInsights"
          [class.dashboard-grid--solo]="!showAdminInsights"
        >
          <section class="dashboard-main">
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
                    <app-status-badge class="recent-status desktop-status" [status]="job.statusLabel" [small]="true" />
                    <mat-icon class="open-icon desktop-icon">chevron_right</mat-icon>
                    <div class="recent-item-top">
                      <app-status-badge [status]="job.statusLabel" [small]="true" />
                      <mat-icon class="open-icon">chevron_right</mat-icon>
                    </div>
                    <div class="recent-main">
                      <div class="recent-name">{{ job.originalFileName }}</div>
                      <div class="recent-meta">
                        <span>{{ job.entityTypeLabel }}</span>
                        <span>{{ job.createdByDisplayName }}</span>
                        <span>{{ job.createdAt | date:'dd/MM HH:mm' }}</span>
                      </div>
                    </div>
                  </button>
                </div>
              </mat-card-content>
            </mat-card>
          </section>

          <aside class="dashboard-aside" *ngIf="showAdminInsights">
            <mat-card class="admin-insights">
              <div class="admin-insights-head">
                <div>
                  <span class="eyebrow eyebrow--soft">Admin pulse</span>
                  <h2>People online and recently active</h2>
                  <p>Live users are shown first, then the newest connections after that.</p>
                </div>
                <div class="admin-insights-stats">
                  <div class="mini-stat">
                    <span class="mini-stat-value">{{ currentUsersCount }}</span>
                    <span class="mini-stat-label">Current users</span>
                  </div>
                  <div class="mini-stat">
                    <span class="mini-stat-value">{{ liveUsersCount }}</span>
                    <span class="mini-stat-label">Live now</span>
                  </div>
                </div>
              </div>

              <div class="connection-list" *ngIf="recentConnections.length; else noConnectionsState">
                <div class="connection-item" *ngFor="let user of recentConnections">
                  <div class="connection-badge" [class]="'connection-badge connection-' + getPresenceStatus(user)">
                    <span class="connection-dot"></span>
                    {{ getPresenceLabel(user) }}
                  </div>
                  <div class="connection-copy">
                    <div class="connection-name">{{ user.displayName }}</div>
                    <div class="connection-meta">
                      <span>{{ user.role }}</span>
                      <span>{{ formatLastSeen(user) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <ng-template #noConnectionsState>
                <div class="admin-insights-empty">
                  <mat-icon>people</mat-icon>
                  <div>
                    <strong>No recent connections yet.</strong>
                    <p>The list will populate as soon as users sign in or stay active.</p>
                  </div>
                </div>
              </ng-template>
            </mat-card>
          </aside>
        </div>
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
    .pilot-scope-strip {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      border: 1px solid #dbe4f0;
      box-shadow: none;
      background: linear-gradient(180deg, #ffffff, #f8fafc);
      padding: 14px 16px;
    }
    .pilot-scope-copy {
      display: grid;
      gap: 4px;
      color: #0f172a;
    }
    .pilot-scope-copy strong { font-size: 16px; font-weight: 800; }
    .pilot-scope-copy span { color: #475569; }
    .pilot-scope-chips { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .pilot-chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid #dbe4f0;
      background: #eff6ff;
      color: #1d4ed8;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .dashboard-grid {
      display: grid;
      gap: 16px;
      align-items: start;
    }
    .dashboard-grid--admin {
      grid-template-columns: minmax(0, 1.6fr) minmax(340px, 0.9fr);
    }
    .dashboard-grid--solo {
      grid-template-columns: minmax(0, 1fr);
    }
    .dashboard-main,
    .dashboard-aside {
      display: grid;
      gap: 16px;
      align-content: start;
    }
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
    .admin-insights {
      border: 1px solid #dbe4f0;
      box-shadow: none;
      padding: 14px;
      background:
        radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 32%),
        linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
    }
    .admin-insights-head {
      display: grid;
      gap: 10px;
      margin-bottom: 12px;
      align-items: start;
    }
    .admin-insights-head h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
    }
    .admin-insights-head p {
      margin: 6px 0 0;
      color: #64748b;
    }
    .eyebrow--soft { color: #0f766e; }
    .admin-insights-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
    }
    .mini-stat {
      min-width: 0;
      width: 100%;
      padding: 10px 12px;
      border-radius: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      text-align: left;
    }
    .mini-stat-value {
      font-size: 24px;
      line-height: 1;
      font-weight: 800;
      color: #0f172a;
    }
    .mini-stat-label {
      color: #64748b;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .connection-list {
      display: grid;
      gap: 8px;
    }
    .connection-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 16px;
      background: #fff;
      border: 1px solid #e2e8f0;
    }
    .connection-badge {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .connection-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: currentColor;
      box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 16%, transparent);
    }
    .connection-online {
      background: #ecfdf5;
      color: #15803d;
      border-color: #bbf7d0;
    }
    .connection-recent {
      background: #eff6ff;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }
    .connection-offline {
      background: #f8fafc;
      color: #64748b;
      border-color: #cbd5e1;
    }
    .connection-copy {
      min-width: 0;
      flex: 1;
    }
    .connection-name {
      font-weight: 700;
      color: #0f172a;
      line-height: 1.25;
    }
    .connection-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 3px;
      color: #64748b;
      font-size: 12px;
    }
    .admin-insights-empty {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border-radius: 14px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      color: #475569;
    }
    .admin-insights-empty mat-icon {
      color: #2563eb;
      margin-top: 1px;
    }
    .status-strip { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid #dbe4f0; box-shadow: none; background: #fff; }
    .status-strip-copy { display: flex; align-items: center; gap: 10px; color: #334155; flex-wrap: wrap; }
    .status-strip-label { color: #2563eb; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .status-strip strong { font-weight: 800; }
    .panel { border: 1px solid #dbe4f0; box-shadow: none; }
    .panel-header { display: flex; justify-content: space-between; align-items: center; }
    .panel-header button { border-radius: 999px; }
    .recent-list { display: flex; flex-direction: column; gap: 10px; }
    .recent-item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      text-align: left;
      border: 1px solid #e2e8f0;
      background: #fff;
      border-radius: 14px;
      padding: 12px;
      cursor: pointer;
    }
    .recent-item:hover { border-color: #c7d2fe; box-shadow: 0 8px 16px rgba(15, 23, 42, 0.05); }
    .desktop-status {
      order: 0;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      flex: 0 0 136px;
      width: 136px;
    }
    .desktop-status .badge {
      width: auto;
      justify-content: flex-start;
      box-sizing: border-box;
    }
    .recent-main { order: 1; flex: 1; min-width: 0; }
    .desktop-icon { order: 2; margin-left: auto; flex: 0 0 auto; }
    .recent-item-top { display: none; }
    .recent-name {
      font-weight: 600;
      color: #334155;
      word-break: break-word;
      font-size: 13px;
      line-height: 1.35;
    }
    .recent-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; color: #64748b; font-size: 12px; }
    .open-icon { color: #94a3b8; }
    .loading-card { display: flex; align-items: center; gap: 12px; padding: 18px; border: 1px solid #dbe4f0; box-shadow: none; }
    @media (max-width: 900px) {
      .page-header { flex-direction: column; align-items: flex-start; }
      .header-actions { width: 100%; }
      .header-actions button { width: 100%; justify-content: center; }
      .pilot-scope-strip { flex-direction: column; }
      .pilot-scope-chips { justify-content: flex-start; }
      .summary-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .dashboard-grid--admin,
      .dashboard-grid--solo { grid-template-columns: 1fr; }
      .admin-insights-head { grid-template-columns: 1fr; }
      .admin-insights-stats { grid-template-columns: 1fr 1fr; }
      .status-strip { flex-direction: column; align-items: flex-start; }
      .status-strip button { width: 100%; }
    }
    @media (max-width: 640px) {
      h1 { font-size: 24px; }
      .summary-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .summary-card { padding: 12px; }
      .summary-value { font-size: 26px; }
      .admin-insights { padding: 12px; }
      .admin-insights-head h2 { font-size: 19px; }
      .admin-insights-stats { grid-template-columns: 1fr; }
      .mini-stat { padding: 9px 11px; }
      .mini-stat-value { font-size: 21px; }
      .connection-item { align-items: flex-start; padding: 10px 11px; }
      .panel-header { flex-direction: column; align-items: flex-start; }
      .panel-header button { width: 100%; }
      .recent-item {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 12px;
      }
      .desktop-status,
      .desktop-icon {
        display: none;
      }
      .recent-item-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .recent-main { min-width: 0; }
      .recent-name { font-size: 13.5px; line-height: 1.3; word-break: break-word; }
      .recent-meta { gap: 8px; margin-top: 3px; }
    }
    @media (max-width: 380px) {
      .summary-cards { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly importService = inject(ImportService);
  private readonly auth = inject(AuthFacade);
  private readonly localAuth = inject(LocalAuthService);
  private readonly router = inject(Router);

  readonly pilotScope = PILOT_SCOPE;
  readonly pilotChips = [
    PILOT_SCOPE.site,
    PILOT_SCOPE.productFamily,
    ...PILOT_SCOPE.dataDomains,
    PILOT_SCOPE.submissionType,
    `Currency: ${PILOT_SCOPE.currency}`
  ];
  overview: DashboardOverview | null = null;
  loading = false;
  users: AuthUser[] = [];

  ngOnInit() {
    this.load();
    if (this.showAdminInsights) {
      this.loadAdminUsers();
    }
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

  get showAdminInsights(): boolean {
    return this.auth.isAdmin && isLocalAuthMode();
  }

  get currentUsersCount(): number {
    return this.users.filter((user) => user.isApproved).length;
  }

  get liveUsersCount(): number {
    return this.users.filter((user) => this.getPresenceStatus(user) === 'online').length;
  }

  get recentConnections(): AuthUser[] {
    return [...this.users]
      .filter((user) => user.isApproved)
      .sort((left, right) => {
        const leftRank = this.getPresenceRank(left);
        const rightRank = this.getPresenceRank(right);

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return this.getPresenceTimestamp(right) - this.getPresenceTimestamp(left);
      })
      .slice(0, 6);
  }

  getPresenceStatus(user: AuthUser): 'online' | 'recent' | 'offline' {
    const diffMs = this.getPresenceAgeMs(user);
    if (diffMs === null) {
      return 'offline';
    }

    if (diffMs <= 45_000) {
      return 'online';
    }

    if (diffMs <= 10 * 60_000) {
      return 'recent';
    }

    return 'offline';
  }

  getPresenceLabel(user: AuthUser): string {
    switch (this.getPresenceStatus(user)) {
      case 'online':
        return 'Online';
      case 'recent':
        return 'Recently active';
      default:
        return 'Offline';
    }
  }

  formatLastSeen(user: AuthUser): string {
    const lastSeen = user.lastSeenAt ?? user.lastLoginAt;
    if (!lastSeen) {
      return 'Never signed in';
    }

    const presenceStatus = this.getPresenceStatus(user);
    if (presenceStatus === 'online') {
      return 'Active now';
    }

    const lastSeenDate = new Date(lastSeen);
    const diffMs = Date.now() - lastSeenDate.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 60) {
      return `Seen ${Math.max(1, diffMinutes)} min ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `Seen ${diffHours}h ago`;
    }

    return `Last seen ${lastSeenDate.toLocaleString()}`;
  }

  private loadAdminUsers(): void {
    this.localAuth.getUsers().subscribe({
      next: (users) => {
        this.users = users;
      },
      error: () => {
        this.users = [];
      }
    });
  }

  private getPresenceAgeMs(user: AuthUser): number | null {
    const lastSeen = user.lastSeenAt ?? user.lastLoginAt;
    if (!lastSeen) {
      return null;
    }

    return Math.max(0, Date.now() - new Date(lastSeen).getTime());
  }

  private getPresenceTimestamp(user: AuthUser): number {
    const lastSeen = user.lastSeenAt ?? user.lastLoginAt;
    return lastSeen ? new Date(lastSeen).getTime() : 0;
  }

  private getPresenceRank(user: AuthUser): number {
    switch (this.getPresenceStatus(user)) {
      case 'online':
        return 0;
      case 'recent':
        return 1;
      default:
        return 2;
    }
  }

}
