import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthFacade } from '../../core/auth/auth.facade';
import { DATASET_CATALOG, EntityType, ImportJob } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { RenameUploadDialogComponent } from '../../shared/rename-upload-dialog/rename-upload-dialog.component';
import { ReleaseWithdrawDialogComponent } from '../../shared/release-withdraw-dialog/release-withdraw-dialog.component';

type UploadSpace = 'workspace' | 'review' | 'history';
type UploadViewMode = 'detailed' | 'compact';
type UploadSort = 'latest' | 'oldest' | 'name' | 'status';

interface UploadSpaceDefinition {
  key: UploadSpace;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
}

interface UploadDisplayGroup {
  key: string;
  name: string;
  isRelease: boolean;
  jobs: ImportJob[];
}

@Component({
  selector: 'app-uploads',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    StatusBadgeComponent
  ],
  templateUrl: './uploads.component.html',
  styleUrl: './uploads.component.scss'
})
export class UploadsComponent implements OnInit {
  private static readonly pageSize = 100;
  private static readonly viewPreferenceKey = 'cpq.uploads.view';
  private static readonly groupingPreferenceKey = 'cpq.uploads.groupReleases';

  readonly auth = inject(AuthFacade);
  private readonly importService = inject(ImportService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly spaces: UploadSpaceDefinition[] = [
    {
      key: 'workspace',
      eyebrow: 'Private preparation',
      title: 'My Workspace',
      description: 'Validate, compare and refine your files before anyone else sees them.',
      icon: 'lock_person'
    },
    {
      key: 'review',
      eyebrow: 'Shared workflow',
      title: 'Review Queue',
      description: 'Submissions formally shared for approval or waiting for publication.',
      icon: 'groups'
    },
    {
      key: 'history',
      eyebrow: 'Governed evidence',
      title: 'Publication History',
      description: 'Published, rejected and withdrawn submissions retained for traceability.',
      icon: 'history'
    }
  ];

  readonly datasetOptions = DATASET_CATALOG;
  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    entityType: [''],
    status: [''],
    sort: ['latest' as UploadSort]
  });

  jobs: ImportJob[] = [];
  activeSpace: UploadSpace = 'workspace';
  loading = false;
  loadError = false;
  searchFocused = false;
  actionJobId: string | null = null;
  copySource: ImportJob | null = null;
  workingCopyName = '';
  viewMode: UploadViewMode = this.readViewPreference();
  groupByRelease = this.readGroupingPreference();
  compactMenuJobId: string | null = null;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const requestedSpace = params.get('space');
    if (requestedSpace === 'workspace' || requestedSpace === 'review' || requestedSpace === 'history') {
      this.activeSpace = requestedSpace;
    }

    const requestedView = params.get('view');
    if (requestedView === 'detailed' || requestedView === 'compact') this.viewMode = requestedView;
    if (params.get('grouped') === 'false') this.groupByRelease = false;

    const requestedSort = params.get('sort');
    const sort: UploadSort = requestedSort === 'oldest' || requestedSort === 'name' || requestedSort === 'status'
      ? requestedSort
      : 'latest';
    this.filtersForm.patchValue({
      search: params.get('q') ?? '',
      entityType: params.get('dataset') ?? '',
      status: params.get('status') ?? '',
      sort
    }, { emitEvent: false });

    this.filtersForm.valueChanges
      .pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncRouteState());
    this.load();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeCompactMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeCompactMenu();
  }

  get filteredJobs(): ImportJob[] {
    const { search, entityType, status, sort } = this.filtersForm.getRawValue();
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = this.jobs.filter(job => {
      if (!this.isInSpace(job, this.activeSpace)) return false;
      if (entityType && job.entityTypeLabel !== entityType) return false;
      if (status && this.displayStatus(job) !== status) return false;
      if (!normalizedSearch) return true;

      return job.originalFileName.toLowerCase().includes(normalizedSearch)
        || job.createdByDisplayName.toLowerCase().includes(normalizedSearch)
        || job.entityTypeLabel.toLowerCase().includes(normalizedSearch)
        || job.releasePackageName?.toLowerCase().includes(normalizedSearch);
    });

    return [...filtered].sort((left, right) => {
      if (sort === 'oldest') return this.activityTime(left) - this.activityTime(right);
      if (sort === 'name') return left.originalFileName.localeCompare(right.originalFileName);
      if (sort === 'status') return this.displayStatus(left).localeCompare(this.displayStatus(right));
      return this.activityTime(right) - this.activityTime(left);
    });
  }

  get displayGroups(): UploadDisplayGroup[] {
    if (!this.groupByRelease) {
      return this.filteredJobs.map(job => ({ key: job.id, name: '', isRelease: false, jobs: [job] }));
    }

    const groups = new Map<string, UploadDisplayGroup>();
    for (const job of this.filteredJobs) {
      const key = job.releasePackageId ? `release-${job.releasePackageId}` : `job-${job.id}`;
      const existing = groups.get(key);
      if (existing) {
        existing.jobs.push(job);
        continue;
      }
      groups.set(key, {
        key,
        name: job.releasePackageName || '',
        isRelease: !!job.releasePackageId,
        jobs: [job]
      });
    }
    return [...groups.values()];
  }

  get statusOptions(): string[] {
    return [...new Set(this.jobs
      .filter(job => this.isInSpace(job, this.activeSpace))
      .map(job => this.displayStatus(job)))].sort();
  }

  get activeFilterCount(): number {
    const value = this.filtersForm.getRawValue();
    return [value.search.trim(), value.entityType, value.status].filter(Boolean).length;
  }

  load(): void {
    this.loading = true;
    this.loadError = false;
    this.importService.getJobs(1, UploadsComponent.pageSize).pipe(
      switchMap(firstPage => {
        const pageCount = Math.ceil(firstPage.total / UploadsComponent.pageSize);
        if (pageCount <= 1) return of(firstPage.items);

        const remainingPages = Array.from(
          { length: pageCount - 1 },
          (_, index) => this.importService.getJobs(index + 2, UploadsComponent.pageSize)
        );
        return forkJoin(remainingPages).pipe(
          map(results => [firstPage.items, ...results.map(result => result.items)].flat())
        );
      })
    ).subscribe({
      next: jobs => {
        this.jobs = [...new Map(jobs
          .filter(job => job.fileExtension.toLowerCase() !== '.hmi')
          .map(job => [job.id, job])).values()];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
        this.snackBar.open('Uploads could not be loaded.', 'Close', { duration: 5000 });
      }
    });
  }

  selectSpace(space: UploadSpace): void {
    this.activeSpace = space;
    this.compactMenuJobId = null;
    this.filtersForm.patchValue({ status: '' });
    this.syncRouteState();
  }

  spaceCount(space: UploadSpace): number {
    return this.jobs.filter(job => this.isInSpace(job, space)).length;
  }

  spaceTitle(): string {
    return this.spaces.find(space => space.key === this.activeSpace)?.title ?? '';
  }

  spaceDescription(): string {
    return this.spaces.find(space => space.key === this.activeSpace)?.description ?? '';
  }

  spaceSummary(): string {
    const jobs = this.jobs.filter(job => this.isInSpace(job, this.activeSpace));
    if (this.activeSpace === 'workspace') {
      const ready = jobs.filter(job => this.canSubmit(job)).length;
      const correction = jobs.filter(job => job.errorRows > 0 || job.statusLabel === 'NeedsCorrection').length;
      return `${jobs.length} private ${jobs.length === 1 ? 'draft' : 'drafts'} · ${ready} ready to submit · ${correction} need correction`;
    }
    if (this.activeSpace === 'review') {
      const awaiting = jobs.filter(job => job.statusLabel === 'AwaitingApproval').length;
      const approved = jobs.filter(job => job.statusLabel === 'Approved').length;
      return `${awaiting} awaiting approval · ${approved} ready to publish`;
    }
    const published = jobs.filter(job => job.statusLabel === 'Committed').length;
    const active = jobs.filter(job => job.isActiveBaseline).length;
    return `${published} publications · ${active} active ${active === 1 ? 'baseline' : 'baselines'} · Evidence retained`;
  }

  setViewMode(mode: UploadViewMode): void {
    this.viewMode = mode;
    this.compactMenuJobId = null;
    if (typeof localStorage !== 'undefined') localStorage.setItem(UploadsComponent.viewPreferenceKey, mode);
    this.syncRouteState();
  }

  toggleReleaseGrouping(): void {
    this.groupByRelease = !this.groupByRelease;
    this.compactMenuJobId = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(UploadsComponent.groupingPreferenceKey, String(this.groupByRelease));
    }
    this.syncRouteState();
  }

  toggleCompactMenu(job: ImportJob, event: Event): void {
    event.stopPropagation();
    this.compactMenuJobId = this.compactMenuJobId === job.id ? null : job.id;
  }

  closeCompactMenu(): void {
    this.compactMenuJobId = null;
  }

  clearFilters(): void {
    this.filtersForm.reset({ search: '', entityType: '', status: '', sort: 'latest' });
  }

  view(job: ImportJob): void {
    this.router.navigate(['/import', job.id]);
  }

  downloadOriginal(job: ImportJob, event?: Event): void {
    event?.stopPropagation();
    if (this.actionJobId === job.id) return;
    this.actionJobId = job.id;
    this.importService.downloadOriginal(job.id).subscribe({
      next: blob => {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `${job.originalFileName}${job.fileExtension}`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.actionJobId = null;
      },
      error: () => {
        this.actionJobId = null;
        this.snackBar.open('The original file could not be downloaded.', 'Close', { duration: 5000 });
      }
    });
  }

  newImport(): void {
    this.router.navigate(['/import/new']);
  }

  openCopyDialog(job: ImportJob, event: Event): void {
    event.stopPropagation();
    if (!this.canCopyToWorkspace(job)) return;
    this.copySource = job;
    this.workingCopyName = this.suggestWorkingCopyName(job.originalFileName);
  }

  closeCopyDialog(): void {
    if (this.actionJobId) return;
    this.copySource = null;
    this.workingCopyName = '';
  }

  createWorkingCopy(): void {
    const source = this.copySource;
    const fileName = this.workingCopyName.trim();
    if (!source || !fileName) return;
    this.actionJobId = source.id;
    this.importService.copyToWorkspace(source.id, fileName).subscribe({
      next: copy => {
        this.jobs = [copy, ...this.jobs];
        this.actionJobId = null;
        this.copySource = null;
        this.workingCopyName = '';
        this.activeSpace = 'workspace';
        this.clearFilters();
        this.snackBar.open('Private working copy created.', 'Close', { duration: 4000 });
        this.router.navigate(['/import', copy.id]);
      },
      error: error => {
        this.actionJobId = null;
        this.snackBar.open(error?.error?.error ?? 'The private copy could not be created.', 'Close', { duration: 6000 });
      }
    });
  }

  submitForReview(job: ImportJob, event: Event): void {
    event.stopPropagation();
    if (!this.canSubmit(job)) return;
    this.actionJobId = job.id;
    this.importService.submitForReview(job.id).subscribe({
      next: updated => {
        this.replaceJob(updated);
        this.actionJobId = null;
        this.snackBar.open('Submission shared with the review team.', 'Close', { duration: 4000 });
      },
      error: error => {
        this.actionJobId = null;
        this.snackBar.open(error?.error?.error ?? 'The upload could not be submitted.', 'Close', { duration: 6000 });
      }
    });
  }

  withdraw(job: ImportJob, event: Event): void {
    event.stopPropagation();
    if (job.createdBy !== this.auth.userId) return;

    if (job.releasePackageId) {
      this.confirmReleaseWithdrawal(job);
      return;
    }

    this.actionJobId = job.id;
    this.importService.withdrawFromReview(job.id).subscribe({
      next: updated => {
        this.replaceJob(updated);
        this.actionJobId = null;
        this.snackBar.open('Submission returned to your private workspace.', 'Close', { duration: 4000 });
      },
      error: error => {
        this.actionJobId = null;
        this.snackBar.open(error?.error?.error ?? 'The submission could not be withdrawn.', 'Close', { duration: 6000 });
      }
    });
  }

  private confirmReleaseWithdrawal(job: ImportJob): void {
    const packageId = job.releasePackageId;
    if (!packageId) return;

    this.actionJobId = job.id;
    this.importService.getReleasePackage(packageId).subscribe({
      next: release => {
        this.actionJobId = null;
        this.dialog.open(ReleaseWithdrawDialogComponent, {
          data: release,
          autoFocus: false,
          disableClose: true,
          panelClass: 'app-dialog-panel',
          width: '610px',
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100dvh - 24px)'
        }).afterClosed().subscribe(confirmed => {
          if (!confirmed) return;
          this.actionJobId = job.id;
          this.importService.withdrawReleasePackage(packageId).subscribe({
            next: () => {
              this.actionJobId = null;
              this.load();
              this.snackBar.open('The entire release returned to your private workspace.', 'Close', { duration: 5000 });
            },
            error: error => {
              this.actionJobId = null;
              this.snackBar.open(error?.error?.error ?? 'The release could not be withdrawn.', 'Close', { duration: 7000 });
            }
          });
        });
      },
      error: error => {
        this.actionJobId = null;
        this.snackBar.open(error?.error?.error ?? 'The release details could not be loaded.', 'Close', { duration: 7000 });
      }
    });
  }

  discard(job: ImportJob, event: Event): void {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Permanently delete ${job.originalFileName}? This private draft and its staged rows cannot be recovered.`
    );
    if (!confirmed) return;

    this.actionJobId = job.id;
    this.importService.deletePrivateDraft(job.id).subscribe({
      next: () => {
        this.jobs = this.jobs.filter(item => item.id !== job.id);
        this.actionJobId = null;
        this.snackBar.open('Private draft permanently deleted.', 'Close', { duration: 4000 });
      },
      error: error => {
        this.actionJobId = null;
        this.snackBar.open(error?.error?.error ?? 'The draft could not be discarded.', 'Close', { duration: 6000 });
      }
    });
  }

  rename(job: ImportJob, event: Event): void {
    event.stopPropagation();
    if (!this.canRename(job)) return;

    this.dialog.open(RenameUploadDialogComponent, {
      data: { fileName: job.originalFileName },
      autoFocus: false,
      panelClass: 'app-dialog-panel',
      width: '520px',
      maxWidth: 'calc(100vw - 24px)'
    }).afterClosed().subscribe(requestedName => {
      if (!requestedName) return;
      this.actionJobId = job.id;
      this.importService.renameUpload(job.id, requestedName).subscribe({
        next: updated => {
          this.replaceJob(updated);
          this.actionJobId = null;
          this.snackBar.open('Upload renamed.', 'Close', { duration: 3500 });
        },
        error: error => {
          this.actionJobId = null;
          this.snackBar.open(error?.error?.error ?? 'The upload could not be renamed.', 'Close', { duration: 6000 });
        }
      });
    });
  }

  canSubmit(job: ImportJob): boolean {
    return job.statusLabel === 'AwaitingApproval'
      && job.workflowStageLabel === 'Private'
      && job.createdBy === this.auth.userId
      && !job.releasePackageId
      && job.errorRows === 0;
  }

  canDiscard(job: ImportJob): boolean {
    return job.createdBy === this.auth.userId
      && job.workflowStageLabel === 'Private';
  }

  canRename(job: ImportJob): boolean {
    return job.createdBy === this.auth.userId
      && job.workflowStageLabel === 'Private'
      && this.auth.hasCapability('imports.correct_own');
  }

  canWithdraw(job: ImportJob): boolean {
    return job.statusLabel === 'AwaitingApproval'
      && job.workflowStageLabel === 'Submitted'
      && job.createdBy === this.auth.userId
      && this.auth.hasCapability('imports.withdraw_own');
  }

  canCopyToWorkspace(_job: ImportJob): boolean {
    return this.activeSpace !== 'workspace'
      && this.auth.hasCapability('imports.upload')
      && this.auth.hasCapability('imports.correct_own');
  }

  workspaceStatus(job: ImportJob): string {
    if (job.statusLabel === 'AwaitingApproval' && job.workflowStageLabel === 'Private') return 'Ready to submit';
    if (job.statusLabel === 'NeedsCorrection') return 'Needs correction';
    if (job.statusLabel === 'Processing') return 'Validating';
    if (job.statusLabel === 'Pending') return 'Draft';
    return job.statusLabel;
  }

  displayStatus(job: ImportJob): string {
    if (this.activeSpace === 'workspace') return this.workspaceStatus(job);
    if (job.statusLabel === 'Committed') return 'Published';
    if (job.statusLabel === 'Approved') return 'Ready to publish';
    if (job.statusLabel === 'AwaitingApproval') return 'Awaiting approval';
    if (job.statusLabel === 'Rejected') return 'Returned by approver';
    if (job.statusLabel === 'Cancelled') return 'Withdrawn';
    return job.statusLabel;
  }

  releaseGroupStatus(group: UploadDisplayGroup): string {
    if (group.jobs.some(job => job.statusLabel === 'NeedsCorrection' || job.errorRows > 0)) return 'Needs correction';
    if (group.jobs.every(job => job.statusLabel === 'Committed')) return 'Published';
    if (group.jobs.some(job => job.statusLabel === 'Approved')) return 'Ready to publish';
    if (group.jobs.some(job => job.statusLabel === 'AwaitingApproval' && job.workflowStageLabel === 'Submitted')) return 'Awaiting approval';
    return group.jobs[0] ? this.displayStatus(group.jobs[0]) : '';
  }

  releaseGroupRows(group: UploadDisplayGroup): number {
    return group.jobs.reduce((total, job) => total + job.totalRows, 0);
  }

  trackGroup(_index: number, group: UploadDisplayGroup): string {
    return group.key;
  }

  trackJob(_index: number, job: ImportJob): string {
    return job.id;
  }

  emptyIcon(): string {
    if (this.activeSpace === 'workspace') return 'note_add';
    if (this.activeSpace === 'review') return 'task_alt';
    return 'inventory_2';
  }

  emptyTitle(): string {
    if (this.activeSpace === 'workspace') return 'Your workspace is clear';
    if (this.activeSpace === 'review') return 'Nothing is waiting for review';
    return 'No history matches these filters';
  }

  emptyCopy(): string {
    if (this.activeSpace === 'workspace') return 'Start a private upload when you are ready. It stays yours until you submit it.';
    if (this.activeSpace === 'review') return 'Shared submissions will appear here once contributors formally submit them.';
    return 'Published, rejected and withdrawn submissions will remain available here.';
  }

  private isInSpace(job: ImportJob, space: UploadSpace): boolean {
    const isOwner = job.createdBy === this.auth.userId;
    const isHistory = ['Published', 'Rejected', 'Withdrawn'].includes(job.workflowStageLabel);
    const isShared = ['Submitted', 'Approved'].includes(job.workflowStageLabel);
    const isPrivate = isOwner && job.workflowStageLabel === 'Private';

    if (space === 'workspace') return isPrivate;
    if (space === 'review') return isShared;
    return isHistory;
  }

  private replaceJob(updated: ImportJob): void {
    this.jobs = this.jobs.map(job => job.id === updated.id ? updated : job);
  }

  private suggestWorkingCopyName(fileName: string): string {
    return `${fileName} - Working Copy`;
  }

  private activityTime(job: ImportJob): number {
    return new Date(job.committedAt ?? job.approvedAt ?? job.rejectedAt ?? job.submittedAt ?? job.createdAt).getTime();
  }

  private readViewPreference(): UploadViewMode {
    if (typeof localStorage === 'undefined') return 'detailed';
    return localStorage.getItem(UploadsComponent.viewPreferenceKey) === 'compact' ? 'compact' : 'detailed';
  }

  private readGroupingPreference(): boolean {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(UploadsComponent.groupingPreferenceKey) !== 'false';
  }

  private syncRouteState(): void {
    const filters = this.filtersForm.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParamsHandling: 'merge',
      queryParams: {
        space: this.activeSpace,
        q: filters.search.trim() || null,
        dataset: filters.entityType || null,
        status: filters.status || null,
        sort: filters.sort === 'latest' ? null : filters.sort,
        view: this.viewMode === 'detailed' ? null : this.viewMode,
        grouped: this.groupByRelease ? null : 'false'
      }
    });
  }

}
