import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ImportService } from '../../core/services/import.service';
import { DATASET_CATALOG, EntityType, ImportJob, ImportStatus, PagedResult } from '../../core/models/import.models';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-uploads',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    StatusBadgeComponent
  ],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Operational workspace</div>
        <h1>Uploads</h1>
        <p class="page-intro">
          Search, filter and manage every submission from one place. The dashboard stays focused on the latest activity.
        </p>
      </div>

      <div class="header-actions">
        <button mat-raised-button color="primary" (click)="newImport()">
          <mat-icon>add</mat-icon> New Import
        </button>
      </div>
    </div>

    <mat-card class="filters-card">
      <form class="filters-toolbar" [formGroup]="filtersForm">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
          <mat-label>Search</mat-label>
          <input
            matInput
            formControlName="search"
            [placeholder]="searchFocused ? 'File name or uploader' : ''"
            (focus)="searchFocused = true"
            (blur)="searchFocused = false" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="select-field">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            <mat-option value="">All statuses</mat-option>
            <mat-option *ngFor="let status of statusOptions" [value]="status.value">{{ status.label }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="select-field">
          <mat-label>Dataset</mat-label>
          <mat-select formControlName="entityType">
            <mat-option value="">All datasets</mat-option>
            <mat-option *ngFor="let dataset of datasetOptions" [value]="dataset.key">{{ dataset.name }}</mat-option>
          </mat-select>
        </mat-form-field>

        <div class="filter-actions">
          <button mat-button type="button" (click)="clearFilters()">
            <mat-icon>filter_alt_off</mat-icon> Clear
          </button>
        </div>
      </form>
    </mat-card>

    <mat-card class="list-card" *ngIf="result; else loadingState">
      <mat-card-header>
        <mat-card-title>All uploads</mat-card-title>
        <div class="list-meta">{{ result.total }} matching submissions</div>
      </mat-card-header>

      <mat-card-content>
        <div class="desktop-table-wrap">
          <table mat-table [dataSource]="result.items" class="full-width-table">
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let job">
                <app-status-badge [status]="job.statusLabel" />
              </td>
            </ng-container>

            <ng-container matColumnDef="file">
              <th mat-header-cell *matHeaderCellDef>File</th>
              <td mat-cell *matCellDef="let job">
                <div class="file-cell">
                  <div class="file-icon-wrap" [class.file-icon-wrap--active]="job.isActiveBaseline">
                    <mat-icon>description</mat-icon>
                    <span class="file-icon-led" *ngIf="job.isActiveBaseline"></span>
                  </div>
                  <div>
                    <div class="file-name">{{ job.originalFileName }}</div>
                    <div class="file-subtitle">Uploaded by {{ job.createdByDisplayName }}</div>
                  </div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="dataset">
              <th mat-header-cell *matHeaderCellDef>Dataset</th>
              <td mat-cell *matCellDef="let job">{{ job.entityTypeLabel }}</td>
            </ng-container>

            <ng-container matColumnDef="rows">
              <th mat-header-cell *matHeaderCellDef>Rows</th>
              <td mat-cell *matCellDef="let job">
                <span class="row-count">{{ job.totalRows }}</span>
                <div class="row-hint">{{ job.validRows }} valid · {{ job.warningRows }} warnings · {{ job.errorRows }} errors</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef>Date</th>
              <td mat-cell *matCellDef="let job">{{ job.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let job">
                <div class="row-actions">
                  <button mat-icon-button color="primary" (click)="view(job)" matTooltip="Open preview">
                    <mat-icon>visibility</mat-icon>
                  </button>
                  <button mat-icon-button (click)="downloadOriginal(job)" matTooltip="Download original file">
                    <mat-icon>download</mat-icon>
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="clickable-row" (click)="view(row)"></tr>
          </table>
        </div>

        <div class="mobile-list">
          <button type="button" class="mobile-item" *ngFor="let job of result.items" (click)="view(job)">
            <div class="mobile-top">
              <app-status-badge [status]="job.statusLabel" />
              <span class="mobile-date">{{ job.createdAt | date:'dd/MM HH:mm' }}</span>
            </div>
            <div class="mobile-file">
              <div class="file-icon-wrap mobile-file-icon-wrap" [class.file-icon-wrap--active]="job.isActiveBaseline">
                <mat-icon>description</mat-icon>
                <span class="file-icon-led" *ngIf="job.isActiveBaseline"></span>
              </div>
              <span>{{ job.originalFileName }}</span>
            </div>
            <div class="mobile-sub">{{ job.entityTypeLabel }}</div>
            <div class="mobile-meta">
              <span>{{ job.totalRows }} rows</span>
              <span>{{ job.createdByDisplayName }}</span>
            </div>
            <div class="mobile-errors" *ngIf="job.errorRows > 0">
              {{ job.errorRows }} errors · {{ job.warningRows }} warnings
            </div>
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

    <ng-template #loadingState>
      <mat-card class="loading-card">
        <mat-icon>hourglass_top</mat-icon>
        <div>
          <div class="loading-title">Loading uploads</div>
          <div class="loading-copy">Fetching the full submission list and applying your filters.</div>
        </div>
      </mat-card>
    </ng-template>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 18px;
    }

    .eyebrow {
      color: var(--app-accent);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    h1 {
      margin: 0;
      font-size: 30px;
      font-weight: 800;
      color: var(--app-text);
    }

    .page-intro {
      margin: 10px 0 0;
      color: var(--app-text-muted);
      line-height: 1.6;
      max-width: 780px;
    }

    .header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .header-actions button,
    .header-actions a {
      border-radius: 999px;
      min-height: 40px;
      font-weight: 700;
    }

    .header-actions mat-icon {
      margin-right: 4px;
    }

    .filters-card {
      margin-bottom: 16px;
      background: var(--app-surface-elevated);
      border: 1px solid var(--app-border);
      box-shadow: 0 16px 36px rgba(2, 6, 23, 0.12);
      border-radius: 20px;
      padding: 16px;
    }

    .filters-toolbar {
      display: grid;
      grid-template-columns: 2fr repeat(2, minmax(150px, 1fr)) auto;
      gap: 10px;
      align-items: end;
      padding: 0;
    }

    .search-field,
    .select-field {
      width: 100%;
      min-width: 0;
      margin-bottom: 0;
    }

    .filter-actions {
      display: flex;
      gap: 6px;
      align-items: center;
      padding-bottom: 2px;
      justify-self: end;
    }

    .filter-actions button {
      border-radius: 999px;
      min-height: 40px;
      font-weight: 700;
    }

    .list-card {
      border: 1px solid var(--app-border);
      box-shadow: none;
    }

    .filter-actions button[mat-button] {
      color: var(--app-accent);
      background: rgba(126, 162, 255, 0.1);
      border: 1px solid rgba(126, 162, 255, 0.18);
      padding-inline: 14px;
    }

    :host ::ng-deep .filters-card .mat-mdc-form-field {
      --mdc-outlined-text-field-container-shape: 16px;
      --mdc-outlined-text-field-label-text-color: var(--app-text-muted);
      --mdc-outlined-text-field-focus-label-text-color: var(--app-accent);
      --mdc-outlined-text-field-input-text-color: var(--app-text);
      --mdc-outlined-text-field-input-text-placeholder-color: var(--app-text-muted);
      --mdc-outlined-text-field-caret-color: var(--app-accent);
    }

    :host ::ng-deep .filters-card .mat-mdc-text-field-wrapper {
      background: var(--app-surface) !important;
      border-radius: 16px;
    }

    html.theme-dark :host ::ng-deep .filters-card .mat-mdc-text-field-wrapper {
      background: rgba(15, 23, 42, 0.6) !important;
    }

    :host ::ng-deep .filters-card .mat-mdc-form-field-infix {
      min-height: 48px;
      padding-top: 12px;
      padding-bottom: 12px;
    }

    :host ::ng-deep .filters-card .mat-mdc-form-field-icon-suffix .mat-icon {
      color: var(--app-accent);
    }

    :host ::ng-deep .filters-card .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    :host ::ng-deep .filters-card .mat-mdc-form-field-label,
    :host ::ng-deep .filters-card .mat-mdc-select-value,
    :host ::ng-deep .filters-card .mat-mdc-input-element {
      color: var(--app-text) !important;
    }

    :host ::ng-deep .filters-card .mat-mdc-input-element::placeholder {
      color: var(--app-text-muted);
      opacity: 1;
    }

    :host ::ng-deep .filters-card .mdc-text-field__input {
      color: var(--app-text) !important;
      caret-color: var(--app-accent);
    }

    :host ::ng-deep .filters-card .mdc-text-field__input::placeholder {
      color: var(--app-text-muted) !important;
      opacity: 1;
    }

    :host ::ng-deep .filters-card .mat-mdc-floating-label {
      color: var(--app-text-muted) !important;
    }

    :host ::ng-deep .filters-card .mdc-notched-outline__leading,
    :host ::ng-deep .filters-card .mdc-notched-outline__notch,
    :host ::ng-deep .filters-card .mdc-notched-outline__trailing {
      border-color: var(--app-border) !important;
    }

    html.theme-dark .filter-actions button[mat-button] {
      background: rgba(126, 162, 255, 0.08);
      border-color: rgba(126, 162, 255, 0.22);
    }

    .list-card mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding-bottom: 8px;
    }

    .list-meta {
      color: var(--app-text-muted);
      font-size: 13px;
      white-space: nowrap;
    }

    .desktop-table-wrap {
      overflow-x: auto;
    }

    .full-width-table {
      width: 100%;
    }

    .file-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .file-icon-wrap {
      position: relative;
      flex: none;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
    }

    .file-icon-wrap--active {
      color: #16a34a;
    }

    .file-icon-wrap mat-icon {
      color: currentColor;
      width: 20px;
      height: 20px;
      font-size: 20px;
      line-height: 20px;
    }

    .file-icon-wrap--active mat-icon {
      color: #16a34a;
    }

    .file-icon-led {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.88);
    }

    .file-name {
      font-weight: 500;
      color: #334155;
      line-height: 1.35;
      font-size: 12.5px;
    }

    .file-subtitle,
    .row-hint {
      color: #64748b;
      font-size: 12px;
      line-height: 1.35;
    }

    .row-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      padding: 3px 10px;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 800;
    }

    .row-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .clickable-row {
      cursor: pointer;
    }

    .clickable-row:hover {
      background: #f8fafc;
    }

    .mobile-list {
      display: none;
    }

    .mobile-item {
      width: 100%;
      text-align: left;
      border: 1px solid #e2e8f0;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      border-radius: 16px;
      padding: 12px;
      margin-bottom: 10px;
    }

    .mobile-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .mobile-date {
      color: #64748b;
      font-size: 12px;
    }

    .mobile-file {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }

    .mobile-file-icon-wrap {
      width: 22px;
      height: 22px;
    }

    .mobile-file span {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }

    .mobile-sub {
      color: #1d4ed8;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .mobile-meta,
    .mobile-errors {
      color: #64748b;
      font-size: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .loading-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px;
      border: 1px solid #dbe4f0;
      box-shadow: none;
    }

    .loading-title {
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .loading-copy {
      color: #475569;
    }

    html.theme-dark app-uploads .file-icon-wrap {
      color: #94a3b8;
    }

    html.theme-dark app-uploads .file-icon-wrap--active {
      color: #86efac;
    }

    html.theme-dark app-uploads .file-icon-wrap--active mat-icon {
      color: #4ade80;
    }

    html.theme-dark app-uploads .file-icon-led {
      border-color: rgba(15, 23, 42, 0.95);
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.22);
    }

    @media (max-width: 980px) {
      .page-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .header-actions {
        width: 100%;
      }

      .header-actions button,
      .header-actions a {
        flex: 1;
        justify-content: center;
      }

      .filters-toolbar {
        grid-template-columns: 1fr 1fr;
      }

      .search-field {
        grid-column: 1 / -1;
      }

      .filter-actions {
        justify-self: end;
      }
    }

    @media (max-width: 640px) {
      h1 {
        font-size: 24px;
      }

      .filters-toolbar {
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .filter-actions {
        grid-column: 1 / -1;
        flex-direction: column;
        align-items: stretch;
        width: 100%;
        justify-self: stretch;
      }

      .filter-actions button {
        width: 100%;
      }

      .list-card mat-card-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .desktop-table-wrap {
        display: none;
      }

      .mobile-list {
        display: block;
      }
    }
  `]
})
export class UploadsComponent implements OnInit {
  private readonly importService = inject(ImportService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  searchFocused = false;

  result: PagedResult<ImportJob> | null = null;
  loading = false;
  page = 1;
  pageSize = 20;

  readonly displayedColumns = ['status', 'file', 'dataset', 'rows', 'date', 'actions'];
  readonly datasetOptions = DATASET_CATALOG;
  readonly statusOptions: { value: ImportStatus; label: string }[] = [
    { value: 'Pending', label: 'Pending' },
    { value: 'Processing', label: 'Processing' },
    { value: 'AwaitingApproval', label: 'Awaiting approval' },
    { value: 'NeedsCorrection', label: 'Needs correction' },
    { value: 'Committed', label: 'Committed' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Failed', label: 'Failed' },
    { value: 'Cancelled', label: 'Cancelled' }
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
    entityType: ['']
  });

  ngOnInit(): void {
    this.filtersForm.valueChanges.pipe(debounceTime(200), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.page = 1;
      this.load();
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    const { search, status, entityType } = this.filtersForm.getRawValue();
    this.importService.getJobs(
      this.page,
      this.pageSize,
      search.trim() || null,
      status || null,
      (entityType || null) as EntityType | null
    ).subscribe({
      next: result => {
        this.result = result;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  clearFilters(): void {
    this.filtersForm.reset({ search: '', status: '', entityType: '' });
  }

  onPage(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.load();
  }

  view(job: ImportJob): void {
    this.router.navigate(['/import', job.id]);
  }

  downloadOriginal(job: ImportJob): void {
    this.importService.downloadOriginal(job.id).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = job.originalFileName;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  newImport(): void {
    this.router.navigate(['/import/new']);
  }
}
