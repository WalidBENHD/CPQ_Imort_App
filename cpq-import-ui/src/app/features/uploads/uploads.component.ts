import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
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
import { debounceTime } from 'rxjs';
import { AuthFacade } from '../../core/auth/auth.facade';
import { DATASET_CATALOG, EntityType, ImportJob } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { RenameUploadDialogComponent } from '../../shared/rename-upload-dialog/rename-upload-dialog.component';

type UploadSpace = 'workspace' | 'review' | 'history';

interface UploadSpaceDefinition {
  key: UploadSpace;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
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
    entityType: ['']
  });

  jobs: ImportJob[] = [];
  activeSpace: UploadSpace = 'workspace';
  loading = false;
  searchFocused = false;
  actionJobId: string | null = null;
  copySource: ImportJob | null = null;
  workingCopyName = '';

  ngOnInit(): void {
    const requestedSpace = this.route.snapshot.queryParamMap.get('space');
    if (requestedSpace === 'workspace' || requestedSpace === 'review' || requestedSpace === 'history') {
      this.activeSpace = requestedSpace;
    }
    this.filtersForm.valueChanges
      .pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe();
    this.load();
  }

  get filteredJobs(): ImportJob[] {
    const { search, entityType } = this.filtersForm.getRawValue();
    const normalizedSearch = search.trim().toLowerCase();

    return this.jobs.filter(job => {
      if (!this.isInSpace(job, this.activeSpace)) return false;
      if (entityType && job.entityTypeLabel !== entityType) return false;
      if (!normalizedSearch) return true;

      return job.originalFileName.toLowerCase().includes(normalizedSearch)
        || job.createdByDisplayName.toLowerCase().includes(normalizedSearch)
        || job.entityTypeLabel.toLowerCase().includes(normalizedSearch);
    });
  }

  load(): void {
    this.loading = true;
    this.importService.getJobs(1, 100).subscribe({
      next: result => {
        this.jobs = result.items;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Uploads could not be loaded.', 'Close', { duration: 5000 });
      }
    });
  }

  selectSpace(space: UploadSpace): void {
    this.activeSpace = space;
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

  clearFilters(): void {
    this.filtersForm.reset({ search: '', entityType: '' });
  }

  view(job: ImportJob): void {
    this.router.navigate(['/import', job.id]);
  }

  downloadOriginal(job: ImportJob, event?: Event): void {
    event?.stopPropagation();
    this.importService.downloadOriginal(job.id).subscribe(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = job.originalFileName;
      link.click();
      URL.revokeObjectURL(link.href);
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
      panelClass: 'app-dialog-panel'
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
    const extensionIndex = fileName.lastIndexOf('.');
    if (extensionIndex <= 0) return `${fileName} - Working Copy`;
    return `${fileName.slice(0, extensionIndex)} - Working Copy${fileName.slice(extensionIndex)}`;
  }

}
