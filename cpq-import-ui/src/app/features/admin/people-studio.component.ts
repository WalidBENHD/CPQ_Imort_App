import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';
import { LocalAuthService } from '../../core/auth/local-auth.service';
import { AccessRole as AccessRoleModel, AuthUser } from '../../core/models/auth.models';

type AccountStatus = 'Pending' | 'Active' | 'Suspended' | 'Rejected';
type DirectoryFilter = 'All' | AccountStatus | 'NoAccess';

interface AccessRole {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  capabilities: string[];
  system: boolean;
}


@Component({
  selector: 'app-people-studio',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <section class="people-page">
      <header class="page-header">
        <div>
          <div class="eyebrow">Identity and account lifecycle</div>
          <h1>People</h1>
          <p>Approve accounts, monitor access health and direct people to the right capability profiles.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/admin/access-studio"><mat-icon>shield</mat-icon> Open Access Studio</a>
          <button mat-raised-button class="primary-button" type="button" (click)="showCreateUser = true"><mat-icon>person_add</mat-icon> Add person</button>
        </div>
      </header>

      <div class="prototype-notice">
        <mat-icon>verified_user</mat-icon>
        <div><strong>Live account administration</strong><span>Account status and role assignments are saved to the server and enforced immediately.</span></div>
        <span class="prototype-pill">Server managed</span>
      </div>

      <div class="summary-grid">
        <button type="button" class="summary-card pending" (click)="setFilter('Pending')"><mat-icon>person_clock</mat-icon><div><strong>{{ countFor('Pending') }}</strong><span>Pending requests</span></div></button>
        <button type="button" class="summary-card active" (click)="setFilter('Active')"><mat-icon>how_to_reg</mat-icon><div><strong>{{ countFor('Active') }}</strong><span>Active people</span></div></button>
        <button type="button" class="summary-card suspended" (click)="setFilter('Suspended')"><mat-icon>person_off</mat-icon><div><strong>{{ countFor('Suspended') }}</strong><span>Suspended</span></div></button>
        <button type="button" class="summary-card no-access" (click)="setFilter('NoAccess')"><mat-icon>shield_question</mat-icon><div><strong>{{ noAccessCount }}</strong><span>Without access</span></div></button>
      </div>

      <mat-card class="pending-panel" *ngIf="pendingUsers.length">
        <div class="panel-head">
          <div><span class="section-kicker">Account requests</span><h2>Waiting for a decision</h2><p>Account approval allows sign-in. Role assignment determines what the person can do.</p></div>
          <span class="count-pill">{{ pendingUsers.length }} pending</span>
        </div>
        <div class="request-list">
          <article class="request-card" *ngFor="let user of pendingUsers">
            <div class="identity-block">
              <span class="avatar avatar--pending">{{ initials(user.displayName) }}</span>
              <div><strong>{{ user.displayName }}</strong><span>{{ user.userName }}</span><small>Requested {{ user.createdAt | date:'dd/MM/yyyy HH:mm' }}</small></div>
            </div>
            <div class="request-callout"><mat-icon>info</mat-icon><span>No operational access has been granted.</span></div>
            <div class="request-actions">
              <button mat-button type="button" (click)="rejectAccount(user)">Reject</button>
              <button mat-stroked-button type="button" (click)="approveAccountOnly(user)">Approve account only</button>
              <button mat-raised-button class="primary-button" type="button" (click)="openAccessEditor(user, true)"><mat-icon>person_add_alt_1</mat-icon> Approve and assign access</button>
            </div>
          </article>
        </div>
      </mat-card>

      <mat-card class="directory-panel">
        <div class="panel-head directory-head">
          <div><span class="section-kicker">User directory</span><h2>Accounts and effective access</h2><p>Role details stay in Access Studio; this view focuses on people and account health.</p></div>
          <span class="count-pill">{{ filteredUsers.length }} of {{ visibleUsers.length }}</span>
        </div>

        <div class="filter-bar">
          <label class="search-box"><mat-icon>search</mat-icon><input [(ngModel)]="search" placeholder="Search name or username" aria-label="Search people" /></label>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Account status</mat-label>
            <mat-select [(ngModel)]="statusFilter">
              <mat-option value="All">All people</mat-option>
              <mat-option value="Active">Active</mat-option>
              <mat-option value="Pending">Pending</mat-option>
              <mat-option value="Suspended">Suspended</mat-option>
              <mat-option value="NoAccess">Without access</mat-option>
              <mat-option value="Rejected">Rejected</mat-option>
            </mat-select>
          </mat-form-field>
          <button mat-button type="button" (click)="clearFilters()"><mat-icon>filter_alt_off</mat-icon> Clear</button>
        </div>

        <div class="empty-state" *ngIf="!loading && !filteredUsers.length"><mat-icon>person_search</mat-icon><strong>No people match this view</strong><span>Try another status or clear the search.</span></div>
        <div class="loading-state" *ngIf="loading"><mat-icon>hourglass_top</mat-icon> Loading people...</div>

        <div class="people-list" *ngIf="!loading">
          <article class="person-row" *ngFor="let user of filteredUsers">
            <div class="person-main">
              <span class="avatar">{{ initials(user.displayName) }}</span>
              <div class="person-identity"><strong>{{ user.displayName }}</strong><span>{{ user.userName }}</span><small>{{ lastActivity(user) }}</small></div>
            </div>
            <div class="account-cell"><span class="status-pill" [class]="'status-pill status-' + accountStatus(user).toLowerCase()"><span></span>{{ accountStatus(user) }}</span></div>
            <div class="roles-cell">
              <div class="role-chips" *ngIf="assignedRoles(user.id).length; else noAssignedRole">
                <span *ngFor="let role of assignedRoles(user.id)" [style.--role-color]="role.color">{{ role.name }}</span>
              </div>
              <ng-template #noAssignedRole><span class="access-warning"><mat-icon>warning_amber</mat-icon> No access role</span></ng-template>
            </div>
            <div class="capability-cell"><strong>{{ effectiveCapabilities(user.id).length }}</strong><span>capabilities</span></div>
            <div class="person-actions">
              <button mat-stroked-button type="button" (click)="openAccessEditor(user, false)"><mat-icon>manage_accounts</mat-icon> Manage access</button>
              <button mat-button type="button" *ngIf="accountStatus(user) === 'Active'" (click)="setAccountStatus(user, 'Suspended')">Suspend</button>
              <button mat-button type="button" *ngIf="accountStatus(user) === 'Suspended'" (click)="setAccountStatus(user, 'Active')">Reactivate</button>
            </div>
          </article>
        </div>
      </mat-card>

      <div class="modal-backdrop" *ngIf="selectedUser" (click)="closeAccessEditor()"></div>
      <aside class="access-drawer" *ngIf="selectedUser as user" aria-label="Manage user access">
        <div class="drawer-head"><div><span class="section-kicker">{{ approvingSelectedUser ? 'Approve and assign' : 'Manage access' }}</span><h2>{{ user.displayName }}</h2><p>{{ user.userName }}</p></div><button mat-icon-button type="button" aria-label="Close" (click)="closeAccessEditor()"><mat-icon>close</mat-icon></button></div>
        <div class="account-principle"><mat-icon>lightbulb</mat-icon><div><strong>Account and access are separate</strong><span>This person can sign in only when active. Their roles determine available actions.</span></div></div>
        <section class="drawer-section"><label>Account status</label><div class="status-choice"><button type="button" [class.selected]="draftStatus === 'Active'" (click)="draftStatus = 'Active'"><mat-icon>check_circle</mat-icon> Active</button><button type="button" [class.selected]="draftStatus === 'Suspended'" (click)="draftStatus = 'Suspended'"><mat-icon>pause_circle</mat-icon> Suspended</button></div></section>
        <section class="drawer-section"><label>Assigned roles</label><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Select one or more roles</mat-label><mat-select multiple [(ngModel)]="draftRoleIds"><mat-option *ngFor="let role of roles" [value]="role.id">{{ role.name }}</mat-option></mat-select></mat-form-field></section>
        <section class="drawer-section"><label>Access preview</label><div class="selected-role-list" *ngIf="draftRoles.length; else emptyDraft"><article *ngFor="let role of draftRoles"><span [style.--role-color]="role.color"><mat-icon>{{ role.icon }}</mat-icon></span><div><strong>{{ role.name }}</strong><small>{{ role.description }}</small></div><b>{{ role.capabilities.length }}</b></article></div><ng-template #emptyDraft><div class="drawer-empty"><mat-icon>shield_question</mat-icon>No operational access selected.</div></ng-template></section>
        <div class="effective-summary"><span>Effective access after saving</span><strong>{{ draftEffectiveCapabilities.length }} capabilities</strong></div>
        <div class="drawer-actions"><button mat-button type="button" (click)="closeAccessEditor()">Cancel</button><button mat-raised-button class="primary-button" type="button" (click)="saveAccess()">{{ approvingSelectedUser ? 'Approve and save access' : 'Save changes' }}</button></div>
      </aside>

      <div class="modal-backdrop" *ngIf="showCreateUser" (click)="closeCreateUser()"></div>
      <section class="create-dialog" *ngIf="showCreateUser">
        <div class="drawer-head"><div><span class="section-kicker">Manual account</span><h2>Add a person</h2><p>Create an active account and assign its initial access.</p></div><button mat-icon-button type="button" aria-label="Close" (click)="closeCreateUser()"><mat-icon>close</mat-icon></button></div>
        <label class="field-label">Display name<input [(ngModel)]="newDisplayName" placeholder="Claire Bernard" /></label>
        <label class="field-label">Username<input [(ngModel)]="newUserName" placeholder="claire.bernard" /></label>
        <label class="field-label">Temporary password<input type="password" [(ngModel)]="newPassword" placeholder="At least 8 characters" /></label>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Initial roles</mat-label><mat-select multiple [(ngModel)]="newUserRoleIds"><mat-option *ngFor="let role of roles" [value]="role.id">{{ role.name }}</mat-option></mat-select></mat-form-field>
        <div class="drawer-actions"><button mat-button type="button" (click)="closeCreateUser()">Cancel</button><button mat-raised-button class="primary-button" type="button" [disabled]="!newDisplayName.trim() || !newUserName.trim() || newPassword.length < 8" (click)="createUser()">Create account</button></div>
      </section>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .people-page { max-width:1400px; margin:0 auto; display:grid; gap:18px; }
    .page-header,.header-actions,.panel-head,.person-main,.person-actions,.drawer-head,.effective-summary { display:flex; align-items:center; }
    .page-header { justify-content:space-between; gap:20px; } .header-actions { gap:8px; flex-wrap:wrap; }
    .eyebrow,.section-kicker { color:#2563eb; font-size:10px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
    h1 { margin:4px 0 5px; color:var(--app-text); font-size:30px; } .page-header p,.panel-head p { margin:0; color:var(--app-text-muted); }
    .header-actions a,.header-actions button { border-radius:999px; } .primary-button { color:#fff !important; background:linear-gradient(135deg,#2563eb,#4f46e5) !important; }
    .prototype-notice { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:12px; padding:14px 16px; border:1px solid #bfdbfe; border-left:5px solid #2563eb; border-radius:14px; color:#1e3a8a; background:linear-gradient(90deg,#eff6ff,#f8fbff); }
    .prototype-notice div { display:grid; gap:2px; } .prototype-notice span { font-size:13px; } .prototype-pill,.count-pill { padding:5px 9px; border:1px solid #bfdbfe; border-radius:999px; color:#1d4ed8; background:#fff; font-size:11px; font-weight:800; white-space:nowrap; }
    .summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:11px; }
    .summary-card { display:flex; align-items:center; gap:12px; padding:14px; border:1px solid var(--app-border); border-top:3px solid var(--accent); border-radius:15px; color:var(--app-text); background:var(--app-surface); text-align:left; cursor:pointer; box-shadow:0 8px 20px rgba(15,23,42,.04); }
    .summary-card mat-icon { width:38px; height:38px; display:grid; place-items:center; border-radius:11px; color:var(--accent); background:color-mix(in srgb,var(--accent) 10%,var(--app-surface)); }
    .summary-card div { display:grid; } .summary-card strong { font-size:23px; line-height:1; } .summary-card span { margin-top:4px; color:var(--app-text-muted); font-size:12px; }
    .summary-card.pending { --accent:#d97706; } .summary-card.active { --accent:#15803d; } .summary-card.suspended { --accent:#64748b; } .summary-card.no-access { --accent:#dc2626; }
    .pending-panel,.directory-panel { padding:20px; border:1px solid var(--app-border); border-radius:18px; background:var(--app-surface); box-shadow:0 12px 28px rgba(15,23,42,.05); }
    .panel-head { justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:15px; } .panel-head h2 { margin:3px 0; color:var(--app-text); font-size:21px; }
    .request-list { display:grid; gap:9px; } .request-card { display:grid; grid-template-columns:minmax(220px,1fr) minmax(200px,.8fr) auto; align-items:center; gap:14px; padding:13px; border:1px solid #fde68a; border-radius:14px; background:linear-gradient(90deg,#fffbeb,var(--app-surface)); }
    .identity-block { display:flex; align-items:center; gap:10px; } .identity-block > div { display:grid; } .identity-block span,.identity-block small { color:#64748b; }
    .avatar { width:40px; height:40px; display:grid; place-items:center; flex:0 0 auto; border-radius:12px; color:#1e40af; background:#dbeafe; font-weight:900; } .avatar--pending { color:#92400e; background:#fef3c7; }
    .request-callout { display:flex; align-items:center; gap:7px; color:#92400e; font-size:12px; } .request-callout mat-icon { width:18px; height:18px; font-size:18px; }
    .request-actions { display:flex; justify-content:flex-end; gap:6px; flex-wrap:wrap; } .request-actions button { border-radius:999px; }
    .filter-bar { display:grid; grid-template-columns:minmax(240px,1fr) 220px auto; align-items:center; gap:10px; margin-bottom:12px; padding:10px; border:1px solid var(--app-border); border-radius:14px; background:var(--app-surface-soft); }
    .search-box { display:flex; align-items:center; gap:8px; height:46px; padding:0 12px; border:1px solid var(--app-border); border-radius:11px; background:var(--app-surface); } .search-box mat-icon { color:var(--app-text-muted); } .search-box input { width:100%; border:0; outline:0; color:var(--app-text); background:transparent; font:inherit; }
    .people-list { display:grid; gap:7px; } .person-row { display:grid; grid-template-columns:minmax(210px,1.1fr) 130px minmax(200px,1fr) 90px auto; align-items:center; gap:12px; padding:12px; border:1px solid var(--app-border); border-radius:13px; background:var(--app-surface-soft); }
    .person-main { gap:10px; min-width:0; } .person-identity { display:grid; min-width:0; } .person-identity strong { color:var(--app-text); } .person-identity span,.person-identity small { color:var(--app-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .status-pill { display:inline-flex; align-items:center; gap:6px; width:max-content; padding:5px 8px; border-radius:999px; font-size:11px; font-weight:800; } .status-pill > span { width:7px; height:7px; border-radius:50%; background:currentColor; }
    .status-active { color:#166534; background:#dcfce7; } .status-pending { color:#92400e; background:#fef3c7; } .status-suspended { color:#475569; background:#e2e8f0; } .status-rejected { color:#991b1b; background:#fee2e2; }
    .role-chips { display:flex; flex-wrap:wrap; gap:5px; } .role-chips span { --role-color:#2563eb; padding:4px 7px; border:1px solid color-mix(in srgb,var(--role-color) 30%,transparent); border-radius:999px; color:var(--role-color); background:color-mix(in srgb,var(--role-color) 8%,var(--app-surface)); font-size:10px; font-weight:800; }
    .access-warning { display:flex; align-items:center; gap:5px; color:#b45309; font-size:11px; } .access-warning mat-icon { width:16px; height:16px; font-size:16px; }
    .capability-cell { display:grid; text-align:center; } .capability-cell strong { color:var(--app-text); font-size:17px; } .capability-cell span { color:var(--app-text-muted); font-size:10px; } .person-actions { justify-content:flex-end; gap:5px; } .person-actions button { border-radius:999px; }
    .empty-state,.loading-state { display:grid; justify-items:center; gap:5px; padding:35px; color:var(--app-text-muted); } .empty-state mat-icon { width:38px; height:38px; font-size:38px; } .empty-state strong { color:var(--app-text); }
    .modal-backdrop { position:fixed; inset:0; z-index:300; background:rgba(2,6,23,.58); backdrop-filter:blur(3px); }
    .access-drawer { position:fixed; z-index:310; top:0; right:0; width:min(520px,94vw); height:100vh; box-sizing:border-box; display:flex; flex-direction:column; gap:18px; overflow-y:auto; padding:24px; border-left:1px solid var(--app-border); background:var(--app-surface); box-shadow:-20px 0 50px rgba(2,6,23,.2); }
    .drawer-head { justify-content:space-between; align-items:flex-start; gap:15px; } .drawer-head h2 { margin:3px 0; color:var(--app-text); font-size:24px; } .drawer-head p { margin:0; color:var(--app-text-muted); }
    .account-principle { display:flex; gap:10px; padding:13px; border:1px solid #bfdbfe; border-radius:12px; color:#1e3a8a; background:#eff6ff; } .account-principle > div { display:grid; gap:2px; } .account-principle span { font-size:12px; line-height:1.4; }
    .drawer-section { display:grid; gap:9px; } .drawer-section > label,.field-label { color:var(--app-text); font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; } .drawer-section mat-form-field { width:100%; }
    .status-choice { display:grid; grid-template-columns:1fr 1fr; gap:8px; } .status-choice button { display:flex; align-items:center; justify-content:center; gap:7px; padding:10px; border:1px solid var(--app-border); border-radius:10px; color:var(--app-text-muted); background:var(--app-surface-soft); cursor:pointer; } .status-choice button.selected { color:#1d4ed8; border-color:#93c5fd; background:#eff6ff; font-weight:800; }
    .selected-role-list { display:grid; gap:7px; } .selected-role-list article { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:9px; padding:10px; border:1px solid var(--app-border); border-radius:11px; background:var(--app-surface-soft); } .selected-role-list article > span { --role-color:#2563eb; width:34px; height:34px; display:grid; place-items:center; border-radius:10px; color:#fff; background:var(--role-color); } .selected-role-list article mat-icon { width:18px; height:18px; font-size:18px; } .selected-role-list article > div { display:grid; } .selected-role-list small { color:var(--app-text-muted); } .selected-role-list b { color:var(--app-text); }
    .drawer-empty { display:flex; align-items:center; gap:7px; padding:16px; border:1px dashed var(--app-border); border-radius:11px; color:#b45309; }
    .effective-summary { justify-content:space-between; padding:13px; border-radius:11px; color:#1e3a8a; background:#eff6ff; } .drawer-actions { display:flex; justify-content:flex-end; gap:7px; margin-top:auto; padding-top:15px; border-top:1px solid var(--app-border); }
    .create-dialog { position:fixed; z-index:310; top:50%; left:50%; width:min(540px,92vw); box-sizing:border-box; display:grid; gap:16px; padding:22px; border:1px solid var(--app-border); border-radius:18px; background:var(--app-surface); box-shadow:0 25px 70px rgba(2,6,23,.3); transform:translate(-50%,-50%); } .field-label { display:grid; gap:6px; } .field-label input { box-sizing:border-box; width:100%; padding:11px; border:1px solid var(--app-border); border-radius:10px; color:var(--app-text); background:var(--app-surface-soft); font:inherit; outline:none; }
    :host-context(html.theme-dark) .prototype-notice { color:#bfdbfe; border-color:rgba(96,165,250,.35); border-left-color:#60a5fa; background:linear-gradient(90deg,rgba(30,64,175,.22),rgba(15,23,42,.9)); } :host-context(html.theme-dark) .prototype-pill,:host-context(html.theme-dark) .count-pill { color:#bfdbfe; border-color:rgba(96,165,250,.3); background:#111c32; }
    :host-context(html.theme-dark) .request-card { border-color:rgba(245,158,11,.3); background:linear-gradient(90deg,rgba(120,53,15,.18),var(--app-surface)); } :host-context(html.theme-dark) .request-callout { color:#fcd34d; }
    :host-context(html.theme-dark) .status-active { color:#86efac; background:rgba(22,101,52,.3); } :host-context(html.theme-dark) .status-pending { color:#fcd34d; background:rgba(146,64,14,.3); } :host-context(html.theme-dark) .status-suspended { color:#cbd5e1; background:#334155; } :host-context(html.theme-dark) .status-rejected { color:#fca5a5; background:rgba(127,29,29,.3); }
    :host-context(html.theme-dark) .account-principle,:host-context(html.theme-dark) .effective-summary { color:#bfdbfe; border-color:rgba(96,165,250,.3); background:rgba(30,64,175,.2); } :host-context(html.theme-dark) .status-choice button.selected { color:#bfdbfe; border-color:rgba(96,165,250,.5); background:rgba(30,64,175,.2); }
    @media (max-width:1100px) { .request-card { grid-template-columns:1fr auto; } .request-callout { grid-column:1; } .request-actions { grid-column:2; grid-row:1 / span 2; max-width:240px; } .person-row { grid-template-columns:minmax(210px,1fr) 120px minmax(180px,1fr) auto; } .capability-cell { display:none; } }
    @media (max-width:820px) { .page-header { align-items:flex-start; flex-direction:column; } .header-actions { width:100%; } .header-actions a,.header-actions button { flex:1; } .summary-grid { grid-template-columns:repeat(2,1fr); } .request-card { grid-template-columns:1fr; } .request-callout,.request-actions { grid-column:auto; grid-row:auto; max-width:none; } .request-actions { justify-content:stretch; } .request-actions button { flex:1; } .filter-bar { grid-template-columns:1fr; } .person-row { grid-template-columns:1fr auto; } .roles-cell { grid-column:1; } .account-cell { grid-column:2; grid-row:1; } .person-actions { grid-column:1 / -1; } }
    @media (max-width:520px) { .prototype-notice { grid-template-columns:auto 1fr; } .prototype-pill { grid-column:2; justify-self:start; } .summary-grid { gap:8px; } .summary-card { display:grid; justify-items:center; padding:11px 7px; text-align:center; } .header-actions { display:grid; } .pending-panel,.directory-panel { padding:14px; } .request-actions { display:grid; } .person-row { grid-template-columns:1fr; } .account-cell,.roles-cell,.person-actions { grid-column:1; grid-row:auto; } .person-actions { display:grid; } .access-drawer { padding:18px; } .drawer-actions { flex-direction:column-reverse; } .drawer-actions button { width:100%; } }
  `]
})
export class PeopleStudioComponent implements OnInit {
  private readonly localAuth = inject(LocalAuthService);

  roles: AccessRole[] = [];
  users: AuthUser[] = [];
  loading = true;
  search = '';
  statusFilter: DirectoryFilter = 'All';
  selectedUser: AuthUser | null = null;
  approvingSelectedUser = false;
  draftStatus: AccountStatus = 'Active';
  draftRoleIds: string[] = [];
  showCreateUser = false;
  newDisplayName = '';
  newUserName = '';
  newPassword = '';
  newUserRoleIds: string[] = [];

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    forkJoin({
      users: this.localAuth.getUsers(),
      roles: this.localAuth.getAccessRoles()
    }).subscribe(({ users, roles }) => {
      this.users = this.dedupeUsers(users);
      this.roles = roles.map(role => this.mapRole(role));
      this.loading = false;
    });
  }

  get visibleUsers(): AuthUser[] {
    return this.users.filter(user => this.accountStatus(user) !== 'Rejected');
  }

  get pendingUsers(): AuthUser[] {
    return this.users.filter(user => this.accountStatus(user) === 'Pending');
  }

  get filteredUsers(): AuthUser[] {
    const query = this.search.trim().toLowerCase();
    return this.visibleUsers.filter(user => {
      const matchesSearch = !query || `${user.displayName} ${user.userName}`.toLowerCase().includes(query);
      const matchesStatus = this.statusFilter === 'All'
        || (this.statusFilter === 'NoAccess' ? this.assignedRoles(user.id).length === 0 : this.accountStatus(user) === this.statusFilter);
      return matchesSearch && matchesStatus;
    });
  }

  get noAccessCount(): number {
    return this.visibleUsers.filter(user => this.accountStatus(user) === 'Active' && this.assignedRoles(user.id).length === 0).length;
  }

  get draftRoles(): AccessRole[] {
    return this.roles.filter(role => this.draftRoleIds.includes(role.id));
  }

  get draftEffectiveCapabilities(): string[] {
    return Array.from(new Set(this.draftRoles.flatMap(role => role.capabilities)));
  }

  countFor(status: AccountStatus): number {
    return this.users.filter(user => this.accountStatus(user) === status).length;
  }

  accountStatus(user: AuthUser): AccountStatus {
    if (!user.isApproved) return 'Pending';
    return user.isSuspended ? 'Suspended' : 'Active';
  }

  setFilter(filter: DirectoryFilter): void {
    this.statusFilter = filter;
  }

  clearFilters(): void {
    this.search = '';
    this.statusFilter = 'All';
  }

  initials(displayName: string): string {
    return displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U';
  }

  lastActivity(user: AuthUser): string {
    if (user.lastSeenAt) return `Last active ${new Date(user.lastSeenAt).toLocaleString()}`;
    if (user.lastLoginAt) return `Last login ${new Date(user.lastLoginAt).toLocaleString()}`;
    return 'No recorded activity';
  }

  assignedRoles(userId: string): AccessRole[] {
    const roleIds = this.users.find(user => user.id === userId)?.roleIds ?? [];
    return this.roles.filter(role => roleIds.includes(role.id));
  }

  effectiveCapabilities(userId: string): string[] {
    return Array.from(new Set(this.assignedRoles(userId).flatMap(role => role.capabilities)));
  }

  approveAccountOnly(user: AuthUser): void {
    this.localAuth.updateUserAccess(user.id, true, false, []).subscribe(updated => this.replaceUser(updated));
  }

  rejectAccount(user: AuthUser): void {
    this.localAuth.rejectUser(user.id).subscribe(() => this.users = this.users.filter(item => item.id !== user.id));
  }

  setAccountStatus(user: AuthUser, status: AccountStatus): void {
    this.localAuth.updateUserAccess(user.id, true, status === 'Suspended', user.roleIds).subscribe(updated => this.replaceUser(updated));
  }

  openAccessEditor(user: AuthUser, approving: boolean): void {
    this.selectedUser = user;
    this.approvingSelectedUser = approving;
    this.draftStatus = approving ? 'Active' : this.accountStatus(user);
    this.draftRoleIds = [...user.roleIds];
  }

  closeAccessEditor(): void {
    this.selectedUser = null;
    this.approvingSelectedUser = false;
    this.draftRoleIds = [];
  }

  saveAccess(): void {
    if (!this.selectedUser) return;
    this.localAuth.updateUserAccess(this.selectedUser.id, true, this.draftStatus === 'Suspended', this.draftRoleIds).subscribe(updated => {
      this.replaceUser(updated);
      this.closeAccessEditor();
    });
  }

  closeCreateUser(): void {
    this.showCreateUser = false;
    this.newDisplayName = '';
    this.newUserName = '';
    this.newPassword = '';
    this.newUserRoleIds = [];
  }

  createUser(): void {
    const displayName = this.newDisplayName.trim();
    const userName = this.newUserName.trim();
    if (!displayName || !userName || this.newPassword.length < 8) return;
    this.localAuth.createUser({ userName, displayName, password: this.newPassword, isApproved: true, roleIds: this.newUserRoleIds }).subscribe(user => {
      this.users = this.dedupeUsers([...this.users, user]);
      this.closeCreateUser();
    });
  }

  private replaceUser(updated: AuthUser): void {
    this.users = this.users.map(user => user.id === updated.id ? updated : user);
  }

  private mapRole(role: AccessRoleModel): AccessRole {
    return { id: role.id, name: role.name, description: role.description, icon: role.icon, color: role.color, capabilities: role.capabilities, system: role.isSystem };
  }

  private dedupeUsers(users: AuthUser[]): AuthUser[] {
    return Array.from(new Map(users.map(user => [user.id, user])).values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
}
