import { Component, OnInit, inject } from '@angular/core';
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

        <form class="filter-toolbar" [formGroup]="filterForm">
          <mat-form-field appearance="outline" class="filter-search">
            <mat-label>Search users</mat-label>
            <input matInput formControlName="query" placeholder="Name or username" autocomplete="off" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Role</mat-label>
            <mat-select formControlName="role">
              <mat-option value="all">All roles</mat-option>
              <mat-option value="cpq-user">cpq-user</mat-option>
              <mat-option value="cpq-approver">cpq-approver</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="all">All statuses</mat-option>
              <mat-option value="approved">Approved only</mat-option>
              <mat-option value="pending">Pending only</mat-option>
              <mat-option value="admin">Admins only</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-stroked-button type="button" (click)="clearFilters()">
            <mat-icon>filter_alt_off</mat-icon>
            Clear
          </button>
          <button mat-stroked-button type="button" (click)="refreshUsers()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
        </form>

        <div *ngIf="filteredUsers.length === 0" class="empty">
          <mat-icon>person_search</mat-icon>
          <span>No users match your current filters.</span>
        </div>

        <article class="user-row" *ngFor="let user of filteredUsers">
          <div class="identity">
            <div class="name">{{ user.displayName }}</div>
            <div class="meta">{{ user.userName }}</div>
            <div class="badges">
              <span class="badge role">{{ user.role }}</span>
              <span class="badge admin" *ngIf="user.isAdmin">admin</span>
              <span class="badge pending" *ngIf="!user.isApproved">pending approval</span>
            </div>
          </div>

          <div class="actions" *ngIf="user.isApproved">
            <button mat-button color="primary" (click)="updateRole(user, 'cpq-user', user.isAdmin)">Set User</button>
            <button mat-button color="primary" (click)="updateRole(user, 'cpq-approver', user.isAdmin)">Set Approver</button>
            <button mat-button (click)="updateRole(user, user.role, !user.isAdmin)">
              {{ user.isAdmin ? 'Revoke Admin' : 'Grant Admin' }}
            </button>
            <button mat-button color="warn" (click)="deleteUser(user)">Delete</button>
          </div>
        </article>
      </mat-card>
    </section>
  `,
  styles: [`
    .admin-page { max-width: 1000px; margin: 0 auto; display: grid; gap: 16px; }
    .page-header h1 { margin: 0; font-size: 28px; line-height: 1.1; }
    .page-header p { margin: 6px 0 0; color: #64748b; }

    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .summary-card { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-top: 3px solid transparent; box-shadow: none; }
    .summary-main { display: flex; align-items: center; gap: 10px; }
    .summary-card mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .summary-card .value { font-size: 24px; line-height: 1; font-weight: 600; }
    .summary-card .label { font-size: 12px; color: #475569; }
    .summary-card.pending { border-top-color: #f59e0b; }
    .summary-card.pending mat-icon { color: #d97706; }
    .summary-card.approved { border-top-color: #16a34a; }
    .summary-card.approved mat-icon { color: #15803d; }
    .summary-card.admins { border-top-color: #2563eb; }
    .summary-card.admins mat-icon { color: #1d4ed8; }
    .summary-card.total { border-top-color: #64748b; }
    .summary-card.total mat-icon { color: #475569; }

    .panel { padding: 18px 20px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: none; }
    .panel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
    .panel-header h2 { margin: 0; font-size: 23px; }
    .muted { color: #64748b; margin: 4px 0 0; }

    .count-pill {
      background: #eef2ff;
      color: #4338ca;
      border: 1px solid #c7d2fe;
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
      color: #475569;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
    }

    .user-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #f8fafc;
      margin-bottom: 10px;
    }
    .user-row:last-child { margin-bottom: 0; }

    .identity { min-width: 0; }
    .name { font-size: 18px; font-weight: 700; color: #0f172a; }
    .meta { color: #64748b; font-size: 13px; margin-top: 2px; }

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

    .filter-toolbar {
      display: grid;
      grid-template-columns: 2fr repeat(2, minmax(150px, 1fr)) auto auto;
      gap: 10px;
      align-items: start;
      margin-bottom: 10px;
    }
    .filter-search { min-width: 220px; }
    .filter-toolbar button { height: 40px; border-radius: 999px; }

    .create-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(220px, 1fr));
      gap: 12px;
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

    @media (max-width: 900px) {
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
      .panel-header { flex-direction: column; align-items: flex-start; }
      .count-pill { align-self: flex-start; }
      .user-row { flex-direction: column; align-items: flex-start; }
      .actions { width: 100%; justify-content: flex-start; }
      .create-form { grid-template-columns: 1fr; }
      .filter-toolbar { grid-template-columns: 1fr 1fr; }
      .filter-search { grid-column: 1 / -1; }
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
      .actions { gap: 6px; }
      .actions button { width: calc(50% - 3px); justify-content: center; margin: 0; }
      .actions button[mat-button] { min-height: 34px; }
      .form-actions button { width: 100%; }
      .toggles { flex-direction: column; gap: 8px; }
      .filter-toolbar { grid-template-columns: 1fr; }
      .filter-toolbar button { width: 100%; }
    }

    @media (max-width: 420px) {
      .summary-cards { grid-template-columns: 1fr; }
      .actions button { width: 100%; justify-content: flex-start; }
    }
  `]
})
export class UserApprovalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(LocalAuthService);
  private readonly dialog = inject(MatDialog);

  pending: AuthUser[] = [];
  users: AuthUser[] = [];
  creating = false;
  showCreateForm = false;
  successMessage = '';
  errorMessage = '';

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
