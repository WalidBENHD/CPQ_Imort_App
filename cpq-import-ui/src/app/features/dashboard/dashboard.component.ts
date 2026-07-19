import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthFacade } from '../../core/auth/auth.facade';
import { isLocalAuthMode } from '../../core/auth/auth-mode';
import { LocalAuthService } from '../../core/auth/local-auth.service';
import { AuthUser } from '../../core/models/auth.models';
import { DashboardOverview, ImportJob, PILOT_SCOPE } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

type UploadSpace = 'workspace' | 'review' | 'history';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    StatusBadgeComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  readonly auth = inject(AuthFacade);
  private readonly importService = inject(ImportService);
  private readonly localAuth = inject(LocalAuthService);
  private readonly router = inject(Router);

  readonly pilotScope = PILOT_SCOPE;
  readonly pilotChips = [PILOT_SCOPE.site, PILOT_SCOPE.productFamily, ...PILOT_SCOPE.dataDomains];

  overview: DashboardOverview | null = null;
  jobs: ImportJob[] = [];
  users: AuthUser[] = [];
  loading = false;
  traceQuery = '';

  ngOnInit(): void {
    this.load();
    if (this.showAdminInsights) this.loadAdminUsers();
  }

  get privateJobs(): ImportJob[] {
    return this.jobs
      .filter(job => this.isPrivate(job))
      .sort((left, right) => this.toTime(right.createdAt) - this.toTime(left.createdAt));
  }

  get sharedJobs(): ImportJob[] {
    return this.jobs
      .filter(job => this.isShared(job))
      .sort((left, right) => this.toTime(right.createdAt) - this.toTime(left.createdAt));
  }

  get historyJobs(): ImportJob[] {
    return this.jobs
      .filter(job => ['Committed', 'Rejected', 'Cancelled'].includes(job.statusLabel))
      .filter(job => ['Published', 'Rejected', 'Withdrawn'].includes(job.workflowStageLabel))
      .sort((left, right) => this.toTime(right.committedAt ?? right.rejectedAt ?? right.createdAt) - this.toTime(left.committedAt ?? left.rejectedAt ?? left.createdAt));
  }

  get privateCorrections(): ImportJob[] {
    return this.privateJobs.filter(job => job.statusLabel === 'NeedsCorrection' || job.errorRows > 0);
  }

  get readyToSubmit(): ImportJob[] {
    return this.privateJobs.filter(job => job.statusLabel === 'AwaitingApproval' && job.errorRows === 0);
  }

  get awaitingApproval(): ImportJob[] {
    return this.sharedJobs.filter(job => job.statusLabel === 'AwaitingApproval' && job.createdBy !== this.auth.userId);
  }

  get readyToPublish(): ImportJob[] {
    return this.sharedJobs.filter(job => job.statusLabel === 'Approved');
  }

  get needsMyAttentionCount(): number {
    let count = this.privateCorrections.length;
    if (this.auth.hasCapability('imports.approve')) count += this.awaitingApproval.length;
    if (this.auth.hasCapability('imports.publish')) count += this.readyToPublish.length;
    return count;
  }

  get latestPublished(): ImportJob | null {
    return this.historyJobs.find(job => job.statusLabel === 'Committed') ?? null;
  }

  get activeMaster(): ImportJob | null {
    return this.activeDataset('Article Master');
  }

  get activePriceList(): ImportJob | null {
    return this.activeDataset('Basis Price');
  }

  get portfolioIsReady(): boolean {
    const master = this.activeMaster;
    const prices = this.activePriceList;
    return !!master && !!prices && master.committedRows === prices.committedRows && master.errorRows === 0 && prices.errorRows === 0;
  }

  get portfolioStatus(): string {
    if (!this.activeMaster && !this.activePriceList) return 'Portfolio not published';
    if (!this.activeMaster || !this.activePriceList) return 'Portfolio incomplete';
    return this.portfolioIsReady ? 'Portfolio aligned' : 'Portfolio attention required';
  }

  get portfolioStatusCopy(): string {
    if (!this.activeMaster && !this.activePriceList) return 'Publish the first coordinated datasets to establish the governed portfolio.';
    if (!this.activeMaster) return 'A published Basis Price exists without an active Article Master.';
    if (!this.activePriceList) return 'An active Article Master exists without a published Basis Price.';
    if (!this.portfolioIsReady) return `${this.activeMaster.committedRows} active articles and ${this.activePriceList.committedRows} priced articles need reconciliation.`;
    return `${this.activeMaster.committedRows} active articles are covered by ${this.activePriceList.committedRows} governed price records.`;
  }

  get activeReleaseName(): string {
    const master = this.activeMaster;
    const prices = this.activePriceList;
    if (master?.releasePackageId && master.releasePackageId === prices?.releasePackageId) {
      return master.releasePackageName || 'Coordinated release';
    }
    return 'Governed active versions';
  }

  get latestPortfolioPublication(): string | null {
    const dates = [this.activeMaster?.committedAt, this.activePriceList?.committedAt]
      .filter((value): value is string => !!value)
      .sort((left, right) => this.toTime(right) - this.toTime(left));
    return dates[0] ?? null;
  }

  get publishedThisMonth(): number {
    const now = new Date();
    return this.historyJobs.filter(job => {
      if (job.statusLabel !== 'Committed' || !job.committedAt) return false;
      const date = new Date(job.committedAt);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).length;
  }

  get activityJobs(): ImportJob[] {
    return [...this.sharedJobs, ...this.historyJobs]
      .sort((left, right) => this.toTime(right.committedAt ?? right.approvedAt ?? right.rejectedAt ?? right.createdAt) - this.toTime(left.committedAt ?? left.approvedAt ?? left.rejectedAt ?? left.createdAt))
      .slice(0, 5);
  }

  get userFirstName(): string {
    return this.auth.userName.trim().split(/\s+/)[0] || 'there';
  }

  get showEvolisAdminMetric(): boolean {
    return this.auth.hasCapability('tools.evolis.audit');
  }

  get attentionTitle(): string {
    if (this.privateCorrections.length) return `${this.privateCorrections.length} private ${this.privateCorrections.length === 1 ? 'draft needs' : 'drafts need'} correction`;
    if (this.auth.hasCapability('imports.approve') && this.awaitingApproval.length) return `${this.awaitingApproval.length} ${this.awaitingApproval.length === 1 ? 'submission is' : 'submissions are'} waiting for approval`;
    if (this.auth.hasCapability('imports.publish') && this.readyToPublish.length) return `${this.readyToPublish.length} approved ${this.readyToPublish.length === 1 ? 'submission is' : 'submissions are'} ready to publish`;
    if (this.readyToSubmit.length) return `${this.readyToSubmit.length} private ${this.readyToSubmit.length === 1 ? 'comparison is' : 'comparisons are'} ready to submit`;
    return 'You are all caught up';
  }

  get attentionCopy(): string {
    if (this.privateCorrections.length) return 'Correct the blocking rows privately, then run the comparison again.';
    if (this.auth.hasCapability('imports.approve') && this.awaitingApproval.length) return 'The contributor has frozen and shared these versions for formal review.';
    if (this.auth.hasCapability('imports.publish') && this.readyToPublish.length) return 'Approval evidence is ready for the final controlled CPQ publication gate.';
    if (this.readyToSubmit.length) return 'Nobody else sees these versions until you deliberately submit them.';
    return 'There are no corrections, reviews or publication actions assigned to you.';
  }

  get attentionIcon(): string {
    if (this.privateCorrections.length) return 'build_circle';
    if (this.auth.hasCapability('imports.approve') && this.awaitingApproval.length) return 'approval';
    if (this.auth.hasCapability('imports.publish') && this.readyToPublish.length) return 'rocket_launch';
    if (this.readyToSubmit.length) return 'send';
    return 'task_alt';
  }

  load(): void {
    this.loading = true;
    forkJoin({
      overview: this.importService.getDashboardOverview(),
      jobs: this.importService.getJobs(1, 100)
    }).subscribe({
      next: result => {
        this.overview = result.overview;
        this.jobs = result.jobs.items;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  openSpace(space: UploadSpace): void {
    this.router.navigate(['/uploads'], { queryParams: { space } });
  }

  openAttention(): void {
    if (this.privateCorrections[0]) return this.view(this.privateCorrections[0]);
    if (this.auth.hasCapability('imports.approve') && this.awaitingApproval[0]) return this.view(this.awaitingApproval[0]);
    if (this.auth.hasCapability('imports.publish') && this.readyToPublish[0]) return this.view(this.readyToPublish[0]);
    if (this.readyToSubmit[0]) return this.view(this.readyToSubmit[0]);
    this.openSpace('workspace');
  }

  view(job: ImportJob): void {
    this.router.navigate(['/import', job.id]);
  }

  newImport(): void {
    this.router.navigate(['/import/new']);
  }

  openEvolisHistory(): void {
    this.router.navigate(['/internal-tools/evolis-decryptor'], { queryParams: { history: 'all' }, fragment: 'decryption-history' });
  }

  openBusinessTrace(): void {
    const identifier = this.traceQuery.trim();
    this.router.navigate(['/business-trace'], { queryParams: identifier ? { identifier } : undefined });
  }

  openActiveDataset(job: ImportJob | null): void {
    if (job) this.view(job);
  }

  privateStatus(job: ImportJob): string {
    if (job.statusLabel === 'AwaitingApproval') return 'Ready to submit';
    if (job.statusLabel === 'Processing') return 'Validating';
    return job.statusLabel;
  }

  activityLabel(job: ImportJob): string {
    if (job.statusLabel === 'Committed') return 'Published to CPQ';
    if (job.statusLabel === 'Approved') return 'Approved for publication';
    if (job.statusLabel === 'AwaitingApproval') return 'Submitted for review';
    if (job.statusLabel === 'Rejected') return 'Returned by approver';
    if (job.statusLabel === 'Cancelled') return 'Withdrawn';
    return job.statusLabel;
  }

  activityIcon(job: ImportJob): string {
    if (job.statusLabel === 'Committed') return 'verified';
    if (job.statusLabel === 'Approved') return 'approval';
    if (job.statusLabel === 'AwaitingApproval') return 'send';
    if (job.statusLabel === 'Rejected') return 'undo';
    return 'history';
  }

  get showAdminInsights(): boolean {
    return this.auth.isAdmin && isLocalAuthMode();
  }

  get currentUsersCount(): number {
    return this.users.filter(user => user.isApproved).length;
  }

  get liveUsersCount(): number {
    return this.users.filter(user => this.getPresenceStatus(user) === 'online').length;
  }

  get recentConnections(): AuthUser[] {
    return [...this.users]
      .filter(user => user.isApproved)
      .sort((left, right) => {
        const rank = this.getPresenceRank(left) - this.getPresenceRank(right);
        return rank || this.getPresenceTimestamp(right) - this.getPresenceTimestamp(left);
      })
      .slice(0, 5);
  }

  getPresenceStatus(user: AuthUser): 'online' | 'recent' | 'offline' {
    const age = this.getPresenceAgeMs(user);
    if (age === null) return 'offline';
    if (age <= 45_000) return 'online';
    if (age <= 10 * 60_000) return 'recent';
    return 'offline';
  }

  getPresenceLabel(user: AuthUser): string {
    const status = this.getPresenceStatus(user);
    if (status === 'online') return 'Online';
    if (status === 'recent') return 'Recently active';
    return 'Offline';
  }

  formatLastSeen(user: AuthUser): string {
    const lastSeen = user.lastSeenAt ?? user.lastLoginAt;
    if (!lastSeen) return 'Never signed in';
    if (this.getPresenceStatus(user) === 'online') return 'Active now';
    const minutes = Math.max(1, Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60_000));
    if (minutes < 60) return `Seen ${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `Seen ${hours}h ago` : `Last seen ${new Date(lastSeen).toLocaleDateString()}`;
  }

  private isPrivate(job: ImportJob): boolean {
    return job.createdBy === this.auth.userId && job.workflowStageLabel === 'Private';
  }

  private isShared(job: ImportJob): boolean {
    return job.workflowStageLabel === 'Submitted' || job.workflowStageLabel === 'Approved';
  }

  private activeDataset(entityTypeLabel: string): ImportJob | null {
    const published = this.historyJobs.filter(job => job.statusLabel === 'Committed' && job.entityTypeLabel === entityTypeLabel);
    return published.find(job => job.isActiveBaseline) ?? published[0] ?? null;
  }

  private loadAdminUsers(): void {
    this.localAuth.getUsers().subscribe({ next: users => this.users = users, error: () => this.users = [] });
  }

  private getPresenceAgeMs(user: AuthUser): number | null {
    const lastSeen = user.lastSeenAt ?? user.lastLoginAt;
    return lastSeen ? Math.max(0, Date.now() - new Date(lastSeen).getTime()) : null;
  }

  private getPresenceTimestamp(user: AuthUser): number {
    const lastSeen = user.lastSeenAt ?? user.lastLoginAt;
    return lastSeen ? new Date(lastSeen).getTime() : 0;
  }

  private getPresenceRank(user: AuthUser): number {
    const status = this.getPresenceStatus(user);
    return status === 'online' ? 0 : status === 'recent' ? 1 : 2;
  }

  private toTime(value: string | null): number {
    return value ? new Date(value).getTime() : 0;
  }
}
