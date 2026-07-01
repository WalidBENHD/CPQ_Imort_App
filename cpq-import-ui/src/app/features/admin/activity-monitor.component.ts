import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, debounceTime } from 'rxjs';
import { ActivityEvent, ActivityOverview } from '../../core/models/activity.models';
import { ActivityMonitorService } from '../../core/services/activity-monitor.service';

@Component({
  selector: 'app-activity-monitor',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTableModule,
    MatPaginatorModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <section class="activity-page">
      <header class="page-header">
        <div>
          <h1>Activity Monitor</h1>
          <p>Track sign-ins, admin operations, imports, and user navigation activity.</p>
        </div>
        <button mat-stroked-button (click)="refresh()">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </header>

      <div class="summary-cards" *ngIf="overview">
        <mat-card class="summary-card total">
          <div class="summary-main"><mat-icon>timeline</mat-icon><div class="value">{{ overview.totalLast24h }}</div></div>
          <div class="label">Events Last 24h</div>
        </mat-card>
        <mat-card class="summary-card auth">
          <div class="summary-main"><mat-icon>login</mat-icon><div class="value">{{ overview.authEventsLast24h }}</div></div>
          <div class="label">Auth Events</div>
        </mat-card>
        <mat-card class="summary-card import">
          <div class="summary-main"><mat-icon>cloud_upload</mat-icon><div class="value">{{ overview.importEventsLast24h }}</div></div>
          <div class="label">Import Events</div>
        </mat-card>
        <mat-card class="summary-card error">
          <div class="summary-main"><mat-icon>error_outline</mat-icon><div class="value">{{ overview.failuresLast24h }}</div></div>
          <div class="label">Failures</div>
        </mat-card>
      </div>

      <mat-card class="panel">
        <form class="filter-toolbar" [formGroup]="filterForm">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search</mat-label>
            <input matInput formControlName="search" placeholder="User, action, route, city" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category">
              <mat-option value="">All</mat-option>
              <mat-option value="Authentication">Authentication</mat-option>
              <mat-option value="Import">Import</mat-option>
              <mat-option value="Admin">Admin</mat-option>
              <mat-option value="Navigation">Navigation</mat-option>
              <mat-option value="System">System</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
            <mat-select formControlName="statusCode">
              <mat-option value="">All</mat-option>
              <mat-option value="200">200</mat-option>
              <mat-option value="201">201</mat-option>
              <mat-option value="204">204</mat-option>
              <mat-option value="400">400</mat-option>
              <mat-option value="401">401</mat-option>
              <mat-option value="403">403</mat-option>
              <mat-option value="404">404</mat-option>
              <mat-option value="500">500</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-stroked-button type="button" (click)="clearFilters()">
            <mat-icon>filter_alt_off</mat-icon>
            Clear
          </button>

          <mat-checkbox class="hide-mine-toggle" formControlName="hideMine">
            Hide my activity
          </mat-checkbox>
        </form>

        <div class="table-wrapper desktop-table" *ngIf="rows.length > 0; else emptyState">
          <table mat-table [dataSource]="rows">
            <ng-container matColumnDef="when">
              <th mat-header-cell *matHeaderCellDef>When (UTC)</th>
              <td mat-cell *matCellDef="let row">{{ row.occurredAtUtc | date:'yyyy-MM-dd HH:mm:ss' }}</td>
            </ng-container>

            <ng-container matColumnDef="actor">
              <th mat-header-cell *matHeaderCellDef>Actor</th>
              <td mat-cell *matCellDef="let row">
                <div class="actor-name">{{ row.userDisplayName || 'Unknown' }}</div>
                <div class="actor-meta">{{ row.userId || '-' }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row">
                <mat-chip class="chip-category">{{ row.categoryLabel }}</mat-chip>
                <div class="action-name">{{ row.action }}</div>
                <div class="action-desc" *ngIf="row.description">{{ row.description }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="target">
              <th mat-header-cell *matHeaderCellDef>Target</th>
              <td mat-cell *matCellDef="let row">
                <div>{{ row.targetType || '-' }}</div>
                <div class="actor-meta">{{ row.targetId || '-' }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="route">
              <th mat-header-cell *matHeaderCellDef>Route / Method</th>
              <td mat-cell *matCellDef="let row">
                <div>{{ row.httpMethod || '-' }}</div>
                <div class="actor-meta" [matTooltip]="row.route || ''">{{ row.route || '-' }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="location">
              <th mat-header-cell *matHeaderCellDef>Location</th>
              <td mat-cell *matCellDef="let row">
                <div>{{ row.country || '-' }}<span *ngIf="row.city">, {{ row.city }}</span></div>
                <div class="actor-meta">{{ maskIp(row.ipAddress) }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <span class="status-chip" [class.error]="(row.statusCode || 0) >= 400">{{ row.statusCode ?? '-' }}</span>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>

        <div class="mobile-list" *ngIf="rows.length > 0">
          <article class="mobile-item" *ngFor="let row of rows">
            <div class="mobile-item-top">
              <mat-chip class="chip-category">{{ row.categoryLabel }}</mat-chip>
              <span class="status-chip" [class.error]="(row.statusCode || 0) >= 400">{{ row.statusCode ?? '-' }}</span>
            </div>

            <div class="mobile-item-title">{{ row.action }}</div>
            <div class="mobile-item-desc" *ngIf="row.description">{{ row.description }}</div>

            <div class="mobile-meta-grid">
              <div class="mobile-meta-block">
                <span class="mobile-meta-label">When (UTC)</span>
                <span class="mobile-meta-value">{{ row.occurredAtUtc | date:'yyyy-MM-dd HH:mm:ss' }}</span>
              </div>

              <div class="mobile-meta-block">
                <span class="mobile-meta-label">Actor</span>
                <span class="mobile-meta-value">{{ row.userDisplayName || 'Unknown' }}</span>
                <span class="mobile-meta-sub">{{ row.userId || '-' }}</span>
              </div>

              <div class="mobile-meta-block">
                <span class="mobile-meta-label">Target</span>
                <span class="mobile-meta-value">{{ row.targetType || '-' }}</span>
                <span class="mobile-meta-sub">{{ row.targetId || '-' }}</span>
              </div>

              <div class="mobile-meta-block">
                <span class="mobile-meta-label">Route / Method</span>
                <span class="mobile-meta-value">{{ row.httpMethod || '-' }}</span>
                <span class="mobile-meta-sub">{{ row.route || '-' }}</span>
              </div>

              <div class="mobile-meta-block">
                <span class="mobile-meta-label">Location</span>
                <span class="mobile-meta-value">{{ row.country || '-' }}<span *ngIf="row.city">, {{ row.city }}</span></span>
                <span class="mobile-meta-sub">{{ maskIp(row.ipAddress) }}</span>
              </div>
            </div>
          </article>
        </div>

        <ng-template #emptyState>
          <div class="empty-state">
            <mat-icon>manage_search</mat-icon>
            <span>No activity entries match your current filters.</span>
          </div>
        </ng-template>

        <mat-paginator
          [length]="total"
          [pageSize]="pageSize"
          [pageSizeOptions]="[25, 50, 100]"
          (page)="onPage($event)">
        </mat-paginator>
      </mat-card>
    </section>
  `,
  styles: [`
    .activity-page { max-width: 1200px; margin: 0 auto; display: grid; gap: 16px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
    .page-header h1 { margin: 0; font-size: 30px; line-height: 1.05; }
    .page-header p { margin: 6px 0 0; color: #64748b; }

    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .summary-card { padding: 12px 14px; border-top: 3px solid transparent; box-shadow: none; }
    .summary-main { display: flex; gap: 10px; align-items: center; }
    .summary-card .value { font-size: 24px; font-weight: 700; line-height: 1; }
    .summary-card .label { margin-top: 5px; font-size: 12px; color: #475569; }
    .summary-card.total { border-top-color: #2563eb; }
    .summary-card.auth { border-top-color: #0f766e; }
    .summary-card.import { border-top-color: #7c3aed; }
    .summary-card.error { border-top-color: #dc2626; }

    .panel { padding: 16px; border: 1px solid #e2e8f0; box-shadow: none; border-radius: 12px; }

    .filter-toolbar {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr auto auto;
      gap: 10px;
      align-items: start;
      margin-bottom: 10px;
    }
    .hide-mine-toggle {
      align-self: center;
      color: #334155;
      font-size: 13px;
      font-weight: 600;
      margin-top: 6px;
      white-space: nowrap;
    }

    .search-field { min-width: 220px; }
    .table-wrapper { overflow-x: auto; }
    .desktop-table { display: block; }
    .mobile-list { display: none; }
    table { width: 100%; min-width: 1050px; }
    th.mat-mdc-header-cell { font-weight: 700; color: #334155; }
    td.mat-mdc-cell { vertical-align: top; padding-top: 12px; padding-bottom: 12px; }

    .actor-name { font-weight: 600; color: #0f172a; }
    .actor-meta { font-size: 12px; color: #64748b; margin-top: 2px; max-width: 280px; word-break: break-word; }
    .action-name { margin-top: 6px; font-weight: 600; color: #0f172a; }
    .action-desc { margin-top: 3px; color: #475569; font-size: 12px; max-width: 300px; }
    .chip-category { font-size: 11px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }

    .status-chip {
      display: inline-block;
      min-width: 42px;
      text-align: center;
      border-radius: 999px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
      padding: 2px 8px;
    }
    .status-chip.error { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }

    .mobile-item {
      border: 1px solid #e2e8f0;
      background: #fff;
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .mobile-item:last-child { margin-bottom: 0; }
    .mobile-item-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .mobile-item-title {
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
      margin-bottom: 4px;
      word-break: break-word;
    }
    .mobile-item-desc {
      color: #475569;
      font-size: 12px;
      margin-bottom: 8px;
      word-break: break-word;
    }
    .mobile-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
    .mobile-meta-block {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .mobile-meta-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
      font-weight: 700;
    }
    .mobile-meta-value {
      font-size: 13px;
      color: #0f172a;
      word-break: break-word;
      line-height: 1.3;
    }
    .mobile-meta-sub {
      font-size: 11px;
      color: #64748b;
      word-break: break-word;
      line-height: 1.25;
    }

    .empty-state {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px;
      border-radius: 10px;
      background: #f8fafc;
      color: #475569;
      border: 1px dashed #cbd5e1;
      margin-bottom: 12px;
    }

    @media (max-width: 960px) {
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
      .filter-toolbar { grid-template-columns: 1fr 1fr; }
      .search-field { grid-column: 1 / -1; }
      .hide-mine-toggle { grid-column: 1 / -1; margin-top: 0; }
    }

    @media (max-width: 640px) {
      .activity-page { gap: 12px; }
      .page-header { flex-direction: column; align-items: flex-start; }
      .page-header h1 { font-size: 24px; }
      .summary-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .summary-card { padding: 12px; }
      .summary-card .value { font-size: 26px; }
      .panel { padding: 12px; }
      .filter-toolbar { grid-template-columns: 1fr; }
      .filter-toolbar button { width: 100%; }
      .desktop-table { display: none; }
      .mobile-list { display: block; }
      .mobile-meta-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 380px) {
      .summary-cards { grid-template-columns: 1fr; }
    }
  `]
})
export class ActivityMonitorComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ActivityMonitorService);
  private readonly snackBar = inject(MatSnackBar);

  overview: ActivityOverview | null = null;
  rows: ActivityEvent[] = [];
  total = 0;
  page = 1;
  pageSize = 50;
  private filterSub: Subscription | null = null;

  columns = ['when', 'actor', 'action', 'target', 'route', 'location', 'status'];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    category: [''],
    statusCode: [''],
    hideMine: [true]
  });

  ngOnInit(): void {
    this.filterSub = this.filterForm.valueChanges
      .pipe(debounceTime(200))
      .subscribe(() => {
        this.page = 1;
        this.loadActivities();
      });

    this.refresh();
  }

  ngOnDestroy(): void {
    this.filterSub?.unsubscribe();
  }

  refresh(): void {
    this.service.getOverview().subscribe({
      next: (overview) => this.overview = overview,
      error: () => {
        this.overview = null;
        this.snackBar.open('Unable to load activity overview.', 'Close', { duration: 5000 });
      }
    });

    this.loadActivities();
  }

  clearFilters(): void {
    this.filterForm.reset({ search: '', category: '', statusCode: '', hideMine: false }, { emitEvent: false });
    this.page = 1;
    this.loadActivities();
  }

  onPage(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadActivities();
  }

  maskIp(value: string | null): string {
    if (!value) {
      return '-';
    }

    const parts = value.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }

    if (value.includes(':')) {
      const chunks = value.split(':');
      return `${chunks.slice(0, 3).join(':')}:xxxx:xxxx`;
    }

    return value;
  }

  private loadActivities(): void {
    const statusValue = this.filterForm.controls.statusCode.value;

    this.service.getActivities({
      page: this.page,
      pageSize: this.pageSize,
      category: this.filterForm.controls.category.value || null,
      search: this.filterForm.controls.search.value || null,
      excludeCurrentUser: this.filterForm.controls.hideMine.value,
      statusCode: statusValue ? Number(statusValue) : null
    }).subscribe({
      next: (response) => {
        this.rows = response.items;
        this.total = response.total;
      },
      error: () => {
        this.rows = [];
        this.total = 0;
        this.snackBar.open('Unable to load activity logs.', 'Close', { duration: 5000 });
      }
    });
  }
}
