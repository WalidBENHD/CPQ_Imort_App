import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subscription, interval } from 'rxjs';
import { AuthUser } from '../../core/models/auth.models';
import { LocalAuthService } from '../../core/auth/local-auth.service';

@Component({
  selector: 'app-user-approval',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDialogModule
  ],
  template: `
    <section class="admin-page">
      <header class="page-header">
        <h1>User Access Administration</h1>
        <p>Approve accounts and manage permissions for local test mode.</p>
      </header>

      <div class="summary-cards">
        <mat-card class="summary-card pending">
          <div class="summary-main">
            <mat-icon>hourglass_top</mat-icon>
            <div class="value">{{ pending.length }}</div>
          </div>
          <div class="label">Pending Approvals</div>
        </mat-card>

        <mat-card class="summary-card approved">
          <div class="summary-main">
            <mat-icon>verified</mat-icon>
            <div class="value">{{ approvedCount }}</div>
          </div>
          <div class="label">Approved Users</div>
        </mat-card>

        <mat-card class="summary-card admins">
          <div class="summary-main">
            <mat-icon>admin_panel_settings</mat-icon>
            <div class="value">{{ adminCount }}</div>
          </div>
          <div class="label">Admins</div>
        </mat-card>

        <mat-card class="summary-card total">
          <div class="summary-main">
            <mat-icon>group</mat-icon>
            <div class="value">{{ users.length }}</div>
          </div>
          <div class="label">Total Users</div>
        </mat-card>
      </div>

      <mat-card class="panel">
        <div class="panel-header">
          <div>
            <h2>Create User</h2>
            <p class="muted">Admins can create local test accounts directly.</p>
          </div>
          <button mat-stroked-button type="button" (click)="toggleCreateForm()">
            <mat-icon>{{ showCreateForm ? 'expand_less' : 'person_add' }}</mat-icon>
            {{ showCreateForm ? 'Hide Form' : 'New User' }}
          </button>
        </div>

        <form class="create-form" *ngIf="showCreateForm" [formGroup]="createForm" (ngSubmit)="createUser()">
          <mat-form-field appearance="outline">
            <mat-label>Display name</mat-label>
            <input matInput formControlName="displayName" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Username</mat-label>
            <input matInput formControlName="userName" autocomplete="off" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Role</mat-label>
            <mat-select formControlName="role">
              <mat-option value="cpq-user">cpq-user</mat-option>
              <mat-option value="cpq-approver">cpq-approver</mat-option>
              <mat-option value="cpq-internal-tools">cpq-internal-tools</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="toggles">
            <mat-checkbox formControlName="isApproved">Approved</mat-checkbox>
            <mat-checkbox formControlName="isAdmin">Admin</mat-checkbox>
          </div>

          <div class="form-actions">
            <button mat-raised-button color="primary" type="submit" [disabled]="createForm.invalid || creating">
              {{ creating ? 'Creating...' : 'Create User' }}
            </button>
          </div>

          <p class="status success" *ngIf="successMessage">{{ successMessage }}</p>
          <p class="status error" *ngIf="errorMessage">{{ errorMessage }}</p>
        </form>
      </mat-card>

      <mat-card class="panel maintenance-panel">
        <div class="panel-header">
          <div>
            <h2>Maintenance</h2>
            <p class="muted">Clear test data while keeping the user accounts used for sign-in and approvals.</p>
          </div>
          <span class="danger-pill">Danger zone</span>
        </div>

        <div class="maintenance-grid">
          <div class="maintenance-copy">
            <div class="maintenance-title">Reset test data</div>
            <p>
              This removes import history, staging rows, notifications, audit activity and CPQ data.
              The local user accounts remain untouched.
            </p>
          </div>

          <button mat-stroked-button color="warn" type="button" class="reset-button" (click)="openResetDialog()">
            <mat-icon>delete_forever</mat-icon>
            Reset Data
          </button>
        </div>
      </mat-card>

      <mat-card class="panel">
        <div class="panel-header">
          <div>
            <h2>Pending Approvals</h2>
            <p class="muted">Review new account requests and assign an initial role.</p>
          </div>
          <span class="count-pill">{{ pending.length }} pending</span>
        </div>

        <div *ngIf="pending.length === 0" class="empty">
          <mat-icon>task_alt</mat-icon>
          <span>No pending users.</span>
        </div>

        <article class="user-row" *ngFor="let user of pending">
          <div class="identity">
            <div class="name">{{ user.displayName }}</div>
            <div class="meta">{{ user.userName }} · created {{ user.createdAt | date:'medium' }}</div>
          </div>
          <div class="actions">
            <button mat-stroked-button color="primary" (click)="approve(user, 'cpq-user', false)">
              <mat-icon>person_add</mat-icon>
              Approve User
            </button>
            <button mat-stroked-button color="accent" (click)="approve(user, 'cpq-approver', false)">
              <mat-icon>verified_user</mat-icon>
              Approve Approver
            </button>
            <button mat-stroked-button (click)="approve(user, 'cpq-approver', true)">
              <mat-icon>admin_panel_settings</mat-icon>
              Approve Admin
            </button>
            <button mat-stroked-button color="warn" (click)="reject(user)">
              <mat-icon>block</mat-icon>
              Reject
            </button>
          </div>
        </article>
      </mat-card>

      <mat-card class="panel">
        <div class="panel-header">
          <div>
            <h2>Users & Roles</h2>
            <p class="muted">Search, filter, and update role assignments for approved users.</p>
          </div>
          <span class="count-pill">{{ filteredUsers.length }} of {{ users.length }} users</span>
        </div>

        <div class="filters-card">
        <form class="filters-toolbar" [formGroup]="filterForm">
          <mat-form-field appearance="outline" class="filter-search search-field">
            <mat-label>Search users</mat-label>
            <input
              matInput
              formControlName="query"
              [placeholder]="userSearchFocused ? 'Name or username' : ''"
              (focus)="userSearchFocused = true"
              (blur)="userSearchFocused = false"
              autocomplete="off" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="select-field">
            <mat-label>Role</mat-label>
            <mat-select formControlName="role">
              <mat-option value="all">All roles</mat-option>
              <mat-option value="cpq-user">cpq-user</mat-option>
              <mat-option value="cpq-approver">cpq-approver</mat-option>
              <mat-option value="cpq-internal-tools">cpq-internal-tools</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="select-field">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="all">All statuses</mat-option>
              <mat-option value="approved">Approved only</mat-option>
              <mat-option value="pending">Pending only</mat-option>
              <mat-option value="admin">Admins only</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="filter-actions">
            <button mat-button type="button" (click)="clearFilters()">
              <mat-icon>filter_alt_off</mat-icon>
              Clear
            </button>
            <button mat-stroked-button class="secondary-action" type="button" (click)="refreshUsers()">
              <mat-icon>refresh</mat-icon>
              Refresh
            </button>
          </div>
        </form>
        </div>

        <div *ngIf="filteredUsers.length === 0" class="empty">
          <mat-icon>person_search</mat-icon>
          <span>No users match your current filters.</span>
        </div>

        <article class="user-row" *ngFor="let user of filteredUsers">
          <div class="identity">
            <div class="name">{{ user.displayName }}</div>
            <div class="meta">{{ user.userName }}</div>
            <div class="presence-row" *ngIf="user.isApproved">
              <span class="presence-pill" [class]="'presence-pill presence-' + getPresenceStatus(user)">
                <span class="presence-dot"></span>
                {{ getPresenceLabel(user) }}
              </span>
              <span class="presence-time">{{ formatLastSeen(user) }}</span>
            </div>
            <div class="badges">
              <span class="badge role">{{ user.role }}</span>
              <span class="badge admin" *ngIf="user.isAdmin">admin</span>
              <span class="badge pending" *ngIf="!user.isApproved">pending approval</span>
            </div>
          </div>

          <div class="actions" *ngIf="user.isApproved">
            <button mat-button class="role-action" color="primary" (click)="updateRole(user, 'cpq-user', user.isAdmin)">Set User</button>
            <button mat-button class="role-action" color="primary" (click)="updateRole(user, 'cpq-approver', user.isAdmin)">Set Approver</button>
            <button mat-button class="role-action" color="primary" (click)="updateRole(user, 'cpq-internal-tools', user.isAdmin)">Set Internal Tools</button>
            <button mat-button class="role-action" (click)="updateRole(user, user.role, !user.isAdmin)">
              {{ user.isAdmin ? 'Revoke Admin' : 'Grant Admin' }}
            </button>
            <button mat-button class="role-action delete-action" color="warn" (click)="deleteUser(user)">Delete</button>
          </div>
        </article>
      </mat-card>
    </section>
  `,
  styles: [`
    .admin-page { width: 100%; margin: 0; display: grid; gap: 16px; }
    .page-header h1 { margin: 0; font-size: 28px; line-height: 1.1; }
    .page-header p { margin: 6px 0 0; color: #64748b; }

    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .summary-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px 14px;
      border-top: 3px solid transparent;
      box-shadow: none;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 255, 0.95));
      border: 1px solid rgba(126, 162, 255, 0.16);
      border-radius: 14px;
    }
    .summary-main { display: flex; align-items: center; gap: 10px; }
    .summary-card mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .summary-card .value { font-size: 24px; line-height: 1; font-weight: 600; }
    .summary-card .label { font-size: 12px; color: var(--app-text-muted); }
    .summary-card.pending { border-top-color: #f59e0b; }
    .summary-card.pending mat-icon { color: #d97706; }
    .summary-card.approved { border-top-color: #16a34a; }
    .summary-card.approved mat-icon { color: #15803d; }
    .summary-card.admins { border-top-color: #2563eb; }
    .summary-card.admins mat-icon { color: #1d4ed8; }
    .summary-card.total { border-top-color: #64748b; }
    .summary-card.total mat-icon { color: #475569; }

    .panel {
      padding: 18px 20px;
      border: 1px solid rgba(126, 162, 255, 0.16);
      border-radius: 16px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 255, 0.95));
    }
    .panel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
    .panel-header h2 { margin: 0; font-size: 23px; color: var(--app-text); }
    .muted { color: var(--app-text-muted); margin: 4px 0 0; }

    .count-pill {
      background: rgba(37, 99, 235, 0.08);
      color: #1d4ed8;
      border: 1px solid rgba(37, 99, 235, 0.16);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    .empty {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      color: var(--app-text-muted);
      background: rgba(248, 250, 255, 0.8);
      border: 1px dashed rgba(126, 162, 255, 0.24);
      border-radius: 12px;
    }

    .user-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      padding: 12px;
      border: 1px solid rgba(126, 162, 255, 0.16);
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 251, 255, 0.95));
      margin-bottom: 10px;
    }
    .user-row:last-child { margin-bottom: 0; }

    .identity { min-width: 0; }
    .name { font-size: 18px; font-weight: 700; color: var(--app-text); }
    .meta { color: var(--app-text-muted); font-size: 13px; margin-top: 2px; }

    .presence-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 8px;
    }

    .presence-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
    }

    .presence-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: currentColor;
      box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 16%, transparent);
    }

    .presence-online {
      background: #ecfdf5;
      color: #15803d;
      border-color: #bbf7d0;
    }

    .presence-recent {
      background: #eff6ff;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }

    .presence-offline {
      background: #f8fafc;
      color: #64748b;
      border-color: #cbd5e1;
    }

    .presence-time {
      color: #64748b;
      font-size: 12px;
      font-weight: 500;
    }

    .badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .badge {
      border-radius: 999px;
      font-size: 12px;
      padding: 2px 10px;
      border: 1px solid transparent;
      font-weight: 600;
      text-transform: lowercase;
    }
    .badge.role { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .badge.admin { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
    .badge.pending { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }

    .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .actions button[mat-stroked-button],
    .actions button[mat-button] {
      border-radius: 999px;
    }
    .role-action {
      min-width: 112px;
      min-height: 36px;
      padding: 0 12px;
      border: 1px solid #dbe4f0;
      background: #ffffff;
      color: #334155;
      font-weight: 600;
    }
    .delete-action {
      border-color: #fecaca;
      color: #dc2626;
    }

    .filters-card {
      margin-bottom: 10px;
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
      margin: 0;
    }

    .filter-search,
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
      justify-self: end;
      padding-bottom: 2px;
    }

    .filter-actions button {
      border-radius: 999px;
      min-height: 40px;
      font-weight: 700;
    }

    .filter-actions button[mat-button] {
      color: var(--app-accent);
      background: rgba(126, 162, 255, 0.1);
      border: 1px solid rgba(126, 162, 255, 0.18);
      padding-inline: 14px;
    }

    .filter-actions .secondary-action {
      border-color: var(--app-border);
      color: var(--app-text);
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
    :host ::ng-deep .filters-card .mat-mdc-input-element,
    :host ::ng-deep .filters-card .mdc-text-field__input {
      color: var(--app-text) !important;
      caret-color: var(--app-accent);
    }

    :host ::ng-deep .filters-card .mat-mdc-input-element::placeholder,
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

    .create-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(220px, 1fr));
      gap: 12px;
      padding: 16px;
      border: 1px solid rgba(126, 162, 255, 0.16);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(249, 251, 255, 0.92));
    }
    .maintenance-panel {
      border-top: 4px solid #f59e0b;
    }
    .maintenance-grid {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 0 2px;
    }
    .maintenance-copy {
      flex: 1 1 auto;
      min-width: 0;
      max-width: 700px;
    }
    .maintenance-title {
      font-size: 16px;
      font-weight: 800;
      color: var(--app-text);
      margin-bottom: 4px;
    }
    .maintenance-copy p {
      margin: 0;
      color: var(--app-text-muted);
      line-height: 1.55;
      max-width: 760px;
    }
    .danger-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid rgba(245, 158, 11, 0.28);
      background: rgba(245, 158, 11, 0.12);
      color: #b45309;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .reset-button {
      min-width: 178px;
      white-space: nowrap;
      align-self: center;
    }
    .toggles {
      grid-column: 1 / -1;
      display: flex;
      gap: 16px;
      padding: 4px 2px;
    }
    .form-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-start;
      margin-top: 4px;
    }
    .status {
      grid-column: 1 / -1;
      margin: 0;
      font-size: 13px;
    }
    .status.success { color: #166534; }
    .status.error { color: #b91c1c; }

    :host-context(html.theme-dark) .summary-card,
    :host-context(html.theme-dark) .panel,
    :host-context(html.theme-dark) .user-row {
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(8, 15, 30, 0.98));
      border-color: var(--app-border);
      color: var(--app-text);
    }

    :host-context(html.theme-dark) .create-form {
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.52), rgba(8, 15, 30, 0.68));
      border-color: rgba(126, 162, 255, 0.18);
    }

    :host-context(html.theme-dark) .maintenance-panel {
      border-top-color: #f59e0b;
    }

    :host-context(html.theme-dark) .danger-pill {
      background: rgba(245, 158, 11, 0.14);
      color: #fdba74;
      border-color: rgba(245, 158, 11, 0.24);
    }

    :host-context(html.theme-dark) .summary-card .label,
    :host-context(html.theme-dark) .muted,
    :host-context(html.theme-dark) .meta,
    :host-context(html.theme-dark) .maintenance-copy p,
    :host-context(html.theme-dark) .empty {
      color: #94a3b8;
    }

    :host-context(html.theme-dark) .count-pill {
      background: rgba(59, 130, 246, 0.16);
      color: #dbeafe;
      border-color: rgba(96, 165, 250, 0.24);
    }

    :host-context(html.theme-dark) .empty {
      background: rgba(15, 23, 42, 0.6);
      border-color: rgba(126, 162, 255, 0.18);
    }

    :host-context(html.theme-dark) .summary-card.pending { border-top-color: #f59e0b; }
    :host-context(html.theme-dark) .summary-card.approved { border-top-color: #16a34a; }
    :host-context(html.theme-dark) .summary-card.admins { border-top-color: #2563eb; }
    :host-context(html.theme-dark) .summary-card.total { border-top-color: #64748b; }

    :host-context(html.theme-dark) .summary-card.pending mat-icon { color: #f59e0b; }
    :host-context(html.theme-dark) .summary-card.approved mat-icon { color: #22c55e; }
    :host-context(html.theme-dark) .summary-card.admins mat-icon { color: #60a5fa; }
    :host-context(html.theme-dark) .summary-card.total mat-icon { color: #94a3b8; }

    :host-context(html.theme-dark) .status.success { color: #86efac; }
    :host-context(html.theme-dark) .status.error { color: #fca5a5; }

    @media (max-width: 900px) {
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
      .panel-header { flex-direction: column; align-items: flex-start; }
      .count-pill { align-self: flex-start; }
      .user-row { flex-direction: column; align-items: flex-start; }
      .actions { width: 100%; justify-content: flex-start; }
      .create-form { grid-template-columns: 1fr; }
      .filters-toolbar { grid-template-columns: 1fr 1fr; }
      .filter-search { grid-column: 1 / -1; }
      .filter-actions { grid-column: 1 / -1; justify-self: stretch; justify-content: flex-end; }
    }

    @media (max-width: 600px) {
      .admin-page { gap: 12px; }
      .page-header h1 { font-size: 23px; }
      .summary-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .summary-card { padding: 10px; }
      .summary-main { gap: 8px; }
      .summary-card .value { font-size: 21px; }
      .summary-card .label { font-size: 11px; }
      .panel { padding: 14px; }
      .panel-header h2 { font-size: 20px; }
      .name { font-size: 16px; }
      .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .actions button { width: 100%; justify-content: center; margin: 0; }
      .actions button[mat-button] {
        min-height: 40px;
        border-radius: 10px;
      }
      .role-action {
        min-width: 0;
        padding: 0 10px;
      }
      .form-actions button { width: 100%; }
      .toggles { flex-direction: column; gap: 8px; }
      .filters-toolbar { grid-template-columns: 1fr; gap: 10px; }
      .filter-actions {
        grid-column: 1 / -1;
        flex-direction: column;
        align-items: stretch;
        justify-self: stretch;
        width: 100%;
      }
      .filter-actions button,
      .filter-actions .secondary-action {
        width: 100%;
      }
    }

    @media (max-width: 420px) {
      .summary-cards { grid-template-columns: 1fr; }
      .actions { grid-template-columns: 1fr; }
      .actions button { justify-content: flex-start; }
      .maintenance-grid { flex-direction: column; align-items: stretch; }
      .reset-button { width: 100%; }
    }
  `]
})
export class UserApprovalComponent implements OnInit, OnDestroy {
  private static readonly ONLINE_WINDOW_MS = 45 * 1000;
  private static readonly RECENT_WINDOW_MS = 10 * 60 * 1000;

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(LocalAuthService);
  private readonly dialog = inject(MatDialog);
  private refreshSub: Subscription | null = null;

  pending: AuthUser[] = [];
  users: AuthUser[] = [];
  creating = false;
  showCreateForm = false;
  successMessage = '';
  errorMessage = '';
  userSearchFocused = false;

  get approvedCount(): number {
    return this.users.filter((u) => u.isApproved).length;
  }

  get adminCount(): number {
    return this.users.filter((u) => u.isAdmin).length;
  }

  readonly createForm = this.fb.nonNullable.group({
    displayName: ['', Validators.required],
    userName: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['cpq-user', Validators.required],
    isApproved: [true],
    isAdmin: [false]
  });

  readonly filterForm = this.fb.nonNullable.group({
    query: [''],
    role: ['all'],
    status: ['all']
  });

  get filteredUsers(): AuthUser[] {
    const query = this.filterForm.controls.query.value.trim().toLowerCase();
    const role = this.filterForm.controls.role.value;
    const status = this.filterForm.controls.status.value;

    return this.users.filter((u) => {
      const matchesQuery = !query || u.displayName.toLowerCase().includes(query) || u.userName.toLowerCase().includes(query);
      const matchesRole = role === 'all' || u.role === role;

      const matchesStatus =
        status === 'all' ||
        (status === 'approved' && u.isApproved) ||
        (status === 'pending' && !u.isApproved) ||
        (status === 'admin' && u.isAdmin);

      return matchesQuery && matchesRole && matchesStatus;
    });
  }

  ngOnInit(): void {
    this.reload();
    this.refreshSub = interval(15000).subscribe(() => this.reload());
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  getPresenceStatus(user: AuthUser): 'online' | 'recent' | 'offline' {
    const diffMs = this.getPresenceAgeMs(user);
    if (diffMs === null) {
      return 'offline';
    }

    if (diffMs <= UserApprovalComponent.ONLINE_WINDOW_MS) {
      return 'online';
    }

    if (diffMs <= UserApprovalComponent.RECENT_WINDOW_MS) {
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

    if (this.getPresenceStatus(user) === 'online') {
      return 'Active now';
    }

    const lastSeenDate = new Date(lastSeen);
    const diffMs = Date.now() - lastSeenDate.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 1) {
      return 'Seen just now';
    }

    if (diffMinutes < 60) {
      return `Seen ${diffMinutes} min ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `Seen ${diffHours}h ago`;
    }

    return `Last seen ${lastSeenDate.toLocaleString()}`;
  }

  private getPresenceAgeMs(user: AuthUser): number | null {
    const lastSeen = user.lastSeenAt ?? user.lastLoginAt;
    if (!lastSeen) {
      return null;
    }

    return Math.max(0, Date.now() - new Date(lastSeen).getTime());
  }

  approve(user: AuthUser, role: string, isAdmin: boolean): void {
    this.auth.approveUser(user.id, role, isAdmin).subscribe(() => this.reload());
  }

  reject(user: AuthUser): void {
    const dialogRef = this.dialog.open(RejectUserDialogComponent, {
      width: '420px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        displayName: user.displayName,
        userName: user.userName
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }

      this.successMessage = '';
      this.errorMessage = '';

      this.auth.rejectUser(user.id).subscribe({
        next: () => {
          this.successMessage = 'User request rejected successfully.';
          console.log('User rejected, reloading...', user.id);
          this.reload();
        },
        error: (err) => {
          this.errorMessage = err?.error?.error ?? 'Unable to reject user.';
          console.error('Reject error:', err);
        }
      });
    });
  }

  updateRole(user: AuthUser, role: string, isAdmin: boolean): void {
    if (user.role === role && user.isAdmin === isAdmin) {
      return;
    }

    const dialogRef = this.dialog.open(RoleChangeDialogComponent, {
      width: '480px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        displayName: user.displayName,
        userName: user.userName,
        currentRole: user.role,
        currentIsAdmin: user.isAdmin,
        nextRole: role,
        nextIsAdmin: isAdmin
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }

      this.successMessage = '';
      this.errorMessage = '';

      this.auth.updateRole(user.id, role, isAdmin).subscribe({
        next: () => {
          this.successMessage = 'User role updated successfully.';
          this.reload();
        },
        error: (err) => {
          this.errorMessage = err?.error?.error ?? 'Unable to update user role.';
        }
      });
    });
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    this.successMessage = '';
    this.errorMessage = '';
  }

  clearFilters(): void {
    this.filterForm.reset({ query: '', role: 'all', status: 'all' });
  }

  refreshUsers(): void {
    this.reload();
  }

  createUser(): void {
    if (this.createForm.invalid || this.creating) {
      return;
    }

    this.creating = true;
    this.successMessage = '';
    this.errorMessage = '';

    const payload = this.createForm.getRawValue();
    this.auth.createUser({
      userName: payload.userName.trim(),
      displayName: payload.displayName.trim(),
      password: payload.password,
      role: payload.role,
      isAdmin: payload.isAdmin,
      isApproved: payload.isApproved
    }).subscribe({
      next: () => {
        this.creating = false;
        this.successMessage = 'User created successfully.';
        this.createForm.reset({
          displayName: '',
          userName: '',
          password: '',
          role: 'cpq-user',
          isApproved: true,
          isAdmin: false
        });
        this.showCreateForm = false;
        this.reload();
      },
      error: (err) => {
        this.creating = false;
        this.errorMessage = err?.error?.error ?? 'Unable to create user.';
      }
    });
  }

  deleteUser(user: AuthUser): void {
    const dialogRef = this.dialog.open(DeleteUserDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        displayName: user.displayName,
        userName: user.userName
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }

      this.successMessage = '';
      this.errorMessage = '';

      this.auth.deleteUser(user.id).subscribe({
        next: () => {
          this.successMessage = 'User deleted successfully.';
          this.pending = this.pending.filter((u) => u.id !== user.id);
          this.users = this.users.filter((u) => u.id !== user.id);
          this.reload();
        },
        error: (err) => {
          this.errorMessage = err?.error?.error ?? 'Unable to delete user.';
        }
      });
    });
  }

  openResetDialog(): void {
    const dialogRef = this.dialog.open(ResetDevDataDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        confirmPhrase: 'RESET'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }

      this.successMessage = '';
      this.errorMessage = '';

      this.auth.resetDevData().subscribe({
        next: () => {
          this.successMessage = 'Test data cleared. Test users were preserved.';
          this.reload();
        },
        error: (err) => {
          this.errorMessage = err?.error?.error ?? 'Unable to reset test data.';
        }
      });
    });
  }

  private reload(): void {
    this.auth.getPendingUsers().subscribe({
      next: (data) => {
        this.pending = data;
      },
      error: (err) => {
        this.errorMessage = err?.error?.error ?? 'Unable to refresh pending users.';
      }
    });

    this.auth.getUsers().subscribe({
      next: (data) => {
        this.users = data;
      },
      error: (err) => {
        this.errorMessage = err?.error?.error ?? 'Unable to refresh users list.';
      }
    });
  }
}

interface DeleteUserDialogData {
  displayName: string;
  userName: string;
}

interface RoleChangeDialogData {
  displayName: string;
  userName: string;
  currentRole: string;
  currentIsAdmin: boolean;
  nextRole: string;
  nextIsAdmin: boolean;
}

@Component({
  selector: 'app-delete-user-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="dialog-shell">
      <div class="dialog-head">
        <div class="dialog-icon-wrap">
          <mat-icon>warning_amber</mat-icon>
        </div>
        <div>
          <h2 mat-dialog-title>Delete User Account</h2>
          <p class="dialog-subtitle">This action is permanent and cannot be undone.</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <p class="lead-text">
          You are about to delete <strong>{{ data.displayName }}</strong>
          (<span class="mono">{{ data.userName }}</span>).
        </p>
        <p class="impact-note">This user will immediately lose access to the application.</p>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="action-row">
        <button mat-stroked-button type="button" (click)="close(false)">Cancel</button>
        <button mat-flat-button color="warn" type="button" (click)="close(true)">
          <mat-icon>delete_forever</mat-icon>
          Delete User
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-shell { padding: 18px 20px 16px; overflow: hidden; }
    .dialog-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .dialog-icon-wrap {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: #fef2f2;
      color: #b91c1c;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    h2[mat-dialog-title] { margin: 0; line-height: 1.2; font-size: 24px; font-weight: 700; }
    .dialog-subtitle { margin: 6px 0 0; color: #64748b; font-size: 14px; line-height: 1.35; }
    mat-dialog-content {
      padding: 4px 0 10px;
      color: #1e293b;
      max-height: none !important;
      overflow: hidden !important;
    }
    .dialog-content .lead-text {
      margin: 0;
      font-size: 16px;
      line-height: 1.45;
    }
    .impact-note {
      margin: 12px 0 0;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #fecaca;
      background: #fff1f2;
      color: #9f1239;
      font-size: 13px;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .action-row {
      border-top: 1px solid #e2e8f0;
      margin-top: 16px;
      padding-top: 14px;
      gap: 8px;
    }
    .action-row button[mat-stroked-button],
    .action-row button[mat-flat-button] {
      min-width: 132px;
    }
  `]
})
export class DeleteUserDialogComponent {
  readonly data = inject<DeleteUserDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DeleteUserDialogComponent, boolean>);

  close(result: boolean): void {
    this.dialogRef.close(result);
  }
}

@Component({
  selector: 'app-role-change-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="dialog-shell role-dialog-shell">
      <div class="dialog-head">
        <div class="dialog-icon-wrap role-dialog-icon-wrap">
          <mat-icon>manage_accounts</mat-icon>
        </div>
        <div>
          <h2 mat-dialog-title>Confirm Role Change</h2>
          <p class="dialog-subtitle">Verify this permission update before applying it.</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <p class="lead-text">
          Update permissions for <strong>{{ data.displayName }}</strong>
          (<span class="mono">{{ data.userName }}</span>)?
        </p>

        <div class="change-grid">
          <div class="change-row">
            <span class="label">Current</span>
            <span class="value">{{ data.currentRole }}{{ data.currentIsAdmin ? ' + admin' : '' }}</span>
          </div>
          <div class="change-row">
            <span class="label">New</span>
            <span class="value">{{ data.nextRole }}{{ data.nextIsAdmin ? ' + admin' : '' }}</span>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="action-row">
        <button mat-stroked-button type="button" (click)="close(false)">Cancel</button>
        <button mat-flat-button color="primary" type="button" (click)="close(true)">
          <mat-icon>check</mat-icon>
          Confirm Change
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-shell { padding: 18px 20px 16px; overflow: hidden; }
    .dialog-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .dialog-icon-wrap {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    h2[mat-dialog-title] { margin: 0; line-height: 1.2; font-size: 24px; font-weight: 700; }
    .dialog-subtitle { margin: 6px 0 0; color: #64748b; font-size: 14px; line-height: 1.35; }
    mat-dialog-content {
      padding: 4px 0 10px;
      color: #1e293b;
      max-height: none !important;
      overflow: hidden !important;
    }
    mat-dialog-actions { padding: 0; margin: 0; }

    .role-dialog-shell { padding: 18px 20px 16px; }
    .role-dialog-icon-wrap {
      background: #e7f0ff;
      color: #1e40af;
    }
    .dialog-content .lead-text {
      margin: 0;
      font-size: 16px;
      line-height: 1.45;
    }
    .change-grid {
      margin-top: 16px;
      border: 1px solid #cfe0ff;
      background: #f7faff;
      border-radius: 10px;
      overflow: hidden;
    }
    .change-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid #e5e7eb;
    }
    .change-row:last-child { border-bottom: 0; }
    .change-row .label {
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
    }
    .change-row .value {
      color: #0f172a;
      font-weight: 600;
      font-size: 15px;
    }
    .action-row {
      border-top: 1px solid #e2e8f0;
      margin-top: 16px;
      padding-top: 14px;
      gap: 8px;
    }
    .action-row button[mat-stroked-button],
    .action-row button[mat-flat-button] {
      min-width: 132px;
    }
  `]
})
export class RoleChangeDialogComponent {
  readonly data = inject<RoleChangeDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RoleChangeDialogComponent, boolean>);

  close(result: boolean): void {
    this.dialogRef.close(result);
  }
}

interface RejectUserDialogData {
  displayName: string;
  userName: string;
}

@Component({
  selector: 'app-reject-user-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="dialog-shell">
      <div class="dialog-head">
        <div class="dialog-icon-wrap reject-icon-wrap">
          <mat-icon>block</mat-icon>
        </div>
        <div>
          <h2 mat-dialog-title>Reject User Request</h2>
          <p class="dialog-subtitle">Remove this pending approval request.</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <p class="lead-text">
          Reject the account request for <strong>{{ data.displayName }}</strong>
          (<span class="mono">{{ data.userName }}</span>)?
        </p>
        <p class="impact-note">
          <mat-icon class="note-icon">info</mat-icon>
          This will remove the request permanently. The user can register again if needed.
        </p>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="action-row">
        <button mat-stroked-button type="button" (click)="close(false)">Cancel</button>
        <button mat-flat-button color="warn" type="button" (click)="close(true)">
          <mat-icon>block</mat-icon>
          Reject Request
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-shell { padding: 18px 20px 16px; overflow: hidden; }
    .dialog-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .dialog-icon-wrap {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .reject-icon-wrap {
      background: #fef2f2;
      color: #b91c1c;
    }
    h2[mat-dialog-title] { margin: 0; line-height: 1.2; font-size: 24px; font-weight: 700; }
    .dialog-subtitle { margin: 6px 0 0; color: #64748b; font-size: 14px; line-height: 1.35; }
    mat-dialog-content {
      padding: 4px 0 10px;
      color: #1e293b;
      max-height: none !important;
      overflow: hidden !important;
    }
    mat-dialog-actions { padding: 0; margin: 0; }
    .dialog-content .lead-text {
      margin: 0;
      font-size: 16px;
      line-height: 1.45;
    }
    .impact-note {
      margin: 12px 0 0;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #fecaca;
      background: #fff1f2;
      color: #9f1239;
      font-size: 13px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .note-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .action-row {
      border-top: 1px solid #e2e8f0;
      margin-top: 16px;
      padding-top: 14px;
      gap: 8px;
    }
    .action-row button[mat-stroked-button],
    .action-row button[mat-flat-button] {
      min-width: 132px;
    }
  `]
})
export class RejectUserDialogComponent {
  readonly data = inject<RejectUserDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RejectUserDialogComponent, boolean>);

  close(result: boolean): void {
    this.dialogRef.close(result);
  }
}

interface ResetDevDataDialogData {
  confirmPhrase: string;
}

@Component({
  selector: 'app-reset-dev-data-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatIconModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="dialog-shell reset-dialog-shell">
      <div class="dialog-head">
        <div class="dialog-icon-wrap reset-icon-wrap">
          <mat-icon>warning</mat-icon>
        </div>
        <div>
          <h2 mat-dialog-title>Reset Development Data</h2>
          <p class="dialog-subtitle">This action clears test data and cannot be undone.</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <p class="lead-text">
          This will delete import jobs, rows, audit activity, notifications and CPQ data.
          Local users will stay in place.
        </p>

        <div class="impact-note">
          <mat-icon class="note-icon">lock</mat-icon>
          Test accounts are preserved so you can keep signing in after the reset.
        </div>

        <mat-form-field appearance="outline" class="confirm-field">
          <mat-label>Type {{ data.confirmPhrase }} to confirm</mat-label>
          <input matInput [formControl]="confirmControl" autocomplete="off" />
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="action-row">
        <button mat-stroked-button type="button" (click)="close(false)">Cancel</button>
        <button
          mat-flat-button
          color="warn"
          type="button"
          [disabled]="confirmControl.value.trim().toLowerCase() !== data.confirmPhrase.toLowerCase()"
          (click)="close(true)"
        >
          <mat-icon>delete_forever</mat-icon>
          Reset Data
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .reset-dialog-shell { padding: 18px 20px 16px; overflow: hidden; }
    .reset-icon-wrap {
      background: #fff1f2;
      color: #b91c1c;
    }
    .confirm-field {
      width: 100%;
      margin-top: 16px;
    }
    .confirm-field input {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }
    .impact-note {
      margin: 12px 0 0;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #fecaca;
      background: #fff1f2;
      color: #9f1239;
      font-size: 13px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .note-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    :host-context(html.theme-dark) .reset-icon-wrap {
      background: rgba(244, 63, 94, 0.16);
      color: #fca5a5;
    }
    :host-context(html.theme-dark) .impact-note {
      border-color: rgba(244, 63, 94, 0.3);
      background: rgba(127, 29, 29, 0.28);
      color: #fecdd3;
    }
  `]
})
export class ResetDevDataDialogComponent {
  readonly data = inject<ResetDevDataDialogData>(MAT_DIALOG_DATA);
  readonly confirmControl = new FormBuilder().nonNullable.control('');
  private readonly dialogRef = inject(MatDialogRef<ResetDevDataDialogComponent, boolean>);

  close(result: boolean): void {
    this.dialogRef.close(result);
  }
}
