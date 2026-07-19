import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { LocalAuthService } from '../../core/auth/local-auth.service';
import { AccessRole } from '../../core/models/auth.models';

type CapabilityGroup = 'Data workflow' | 'Approval & publication' | 'Internal tools' | 'Governance & administration';

interface CapabilityDefinition {
  key: string;
  label: string;
  description: string;
  group: CapabilityGroup;
  icon: string;
  risk?: 'high';
}

interface PrototypeRole {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  capabilities: string[];
  system: boolean;
  assignedUsers: number;
}

const CAPABILITIES: CapabilityDefinition[] = [
  { key: 'imports.view', label: 'View submissions', description: 'Open uploads, comparisons and publication history.', group: 'Data workflow', icon: 'visibility' },
  { key: 'imports.upload', label: 'Upload data', description: 'Create a new dataset submission.', group: 'Data workflow', icon: 'upload_file' },
  { key: 'imports.correct_own', label: 'Correct own uploads', description: 'Edit blocking rows before requesting approval.', group: 'Data workflow', icon: 'edit_note' },
  { key: 'imports.withdraw_own', label: 'Withdraw own uploads', description: 'Withdraw an unpublished submission while preserving history.', group: 'Data workflow', icon: 'undo' },
  { key: 'imports.submit', label: 'Request approval', description: 'Move a validated draft into the approval queue.', group: 'Data workflow', icon: 'send' },
  { key: 'imports.approve', label: 'Approve submissions', description: 'Sign off the reviewed comparison for publication.', group: 'Approval & publication', icon: 'verified' },
  { key: 'imports.reject', label: 'Reject submissions', description: 'Return a submission to its contributor with a reason.', group: 'Approval & publication', icon: 'do_not_disturb_on' },
  { key: 'imports.return_to_review', label: 'Withdraw approval', description: 'Move an approved submission back to review before publication.', group: 'Approval & publication', icon: 'assignment_return' },
  { key: 'imports.publish', label: 'Publish to CPQ', description: 'Apply the approved impact to CPQ.', group: 'Approval & publication', icon: 'rocket_launch', risk: 'high' },
  { key: 'tools.evolis', label: 'Use Evolis decryptor', description: 'Access the protected Evolis internal utility.', group: 'Internal tools', icon: 'lock_open' },
  { key: 'tools.evolis.audit', label: 'Audit Evolis decryptions', description: 'View all users\' history and administrative metrics.', group: 'Internal tools', icon: 'manage_history' },
  { key: 'audit.view', label: 'View audit history', description: 'Inspect user activity, approvals and publications.', group: 'Governance & administration', icon: 'history' },
  { key: 'users.manage', label: 'Manage users', description: 'Approve accounts and maintain user access.', group: 'Governance & administration', icon: 'manage_accounts', risk: 'high' },
  { key: 'roles.manage', label: 'Manage roles', description: 'Create roles and choose their capabilities.', group: 'Governance & administration', icon: 'shield', risk: 'high' },
  { key: 'users.assign_roles', label: 'Assign roles', description: 'Grant one or more roles to users.', group: 'Governance & administration', icon: 'group_add', risk: 'high' },
  { key: 'system.maintenance', label: 'System maintenance', description: 'Run reset and other dangerous maintenance operations.', group: 'Governance & administration', icon: 'build_circle', risk: 'high' }
];

const ROLE_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#c2410c', '#475569', '#be123c'];

@Component({
  selector: 'app-access-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatCheckboxModule, MatIconModule, MatInputModule],
  template: `
    <section class="studio-page">
      <header class="page-header">
        <div>
          <div class="eyebrow">Authorization design</div>
          <h1>Access Studio</h1>
          <p>Build roles from individual capabilities, then preview the access users would receive.</p>
        </div>
        <button mat-stroked-button type="button" class="reset-button" (click)="loadRoles()">
          <mat-icon>refresh</mat-icon> Reload roles
        </button>
      </header>

      <div class="prototype-notice">
        <mat-icon>science</mat-icon>
        <div>
          <strong>Live authorization configuration</strong>
          <span>Role changes are saved immediately and enforced by the API on the next request.</span>
        </div>
        <span class="local-pill">Server managed</span>
      </div>

      <div class="summary-grid">
        <mat-card><mat-icon>shield</mat-icon><div><strong>{{ roles.length }}</strong><span>Roles designed</span></div></mat-card>
        <mat-card><mat-icon>key</mat-icon><div><strong>{{ capabilities.length }}</strong><span>Capabilities available</span></div></mat-card>
        <mat-card><mat-icon>group</mat-icon><div><strong>{{ assignedUserCount }}</strong><span>Role assignments</span></div></mat-card>
        <mat-card class="risk-card"><mat-icon>priority_high</mat-icon><div><strong>{{ highRiskCapabilityCount }}</strong><span>Sensitive capabilities</span></div></mat-card>
      </div>

      <div class="studio-grid">
        <aside class="role-rail">
          <div class="section-head">
            <div><span class="section-kicker">Role library</span><h2>Access profiles</h2></div>
            <button mat-icon-button type="button" aria-label="Create role" (click)="showCreateRole = !showCreateRole"><mat-icon>add</mat-icon></button>
          </div>

          <div class="create-role" *ngIf="showCreateRole">
            <input [(ngModel)]="newRoleName" placeholder="Role name" aria-label="Role name" />
            <textarea [(ngModel)]="newRoleDescription" placeholder="What is this role responsible for?" aria-label="Role description"></textarea>
            <div class="create-actions">
              <button mat-button type="button" (click)="cancelCreateRole()">Cancel</button>
              <button mat-raised-button type="button" class="primary-button" [disabled]="!newRoleName.trim()" (click)="createRole()">Create</button>
            </div>
          </div>

          <div class="role-list">
            <button
              type="button"
              class="role-card"
              *ngFor="let role of roles"
              [class.role-card--selected]="role.id === selectedRoleId"
              [style.--role-color]="role.color"
              (click)="selectRole(role.id)">
              <span class="role-icon"><mat-icon>{{ role.icon }}</mat-icon></span>
              <span class="role-card-copy"><strong>{{ role.name }}</strong><small>{{ role.capabilities.length }} capabilities</small></span>
              <mat-icon class="chevron">chevron_right</mat-icon>
            </button>
          </div>
        </aside>

        <main class="role-editor" *ngIf="selectedRole as role">
          <div class="editor-hero" [style.--role-color]="role.color">
            <div class="editor-title">
              <span class="editor-icon"><mat-icon>{{ role.icon }}</mat-icon></span>
              <div><span class="section-kicker">Capability profile</span><h2>{{ role.name }}</h2><p>{{ role.description }}</p></div>
            </div>
            <div class="editor-actions">
              <span class="system-pill" *ngIf="role.system"><mat-icon>lock</mat-icon> Seeded role</span>
              <button mat-stroked-button type="button" (click)="duplicateRole(role)"><mat-icon>content_copy</mat-icon> Duplicate</button>
              <button mat-icon-button type="button" aria-label="Delete role" *ngIf="!role.system" (click)="deleteRole(role)"><mat-icon>delete_outline</mat-icon></button>
            </div>
          </div>

          <div class="workflow-preview">
            <div class="workflow-title"><mat-icon>account_tree</mat-icon><div><strong>Workflow reach</strong><span>What this role can do across the governed lifecycle</span></div></div>
            <div class="workflow-steps">
              <div [class.step-on]="hasAny(role, contributionKeys)"><span>1</span><div><strong>Contribute</strong><small>Prepare and submit</small></div></div>
              <mat-icon>arrow_forward</mat-icon>
              <div [class.step-on]="hasAny(role, approvalKeys)"><span>2</span><div><strong>Approve</strong><small>Review and sign off</small></div></div>
              <mat-icon>arrow_forward</mat-icon>
              <div [class.step-on]="hasCapability(role, 'imports.publish')"><span>3</span><div><strong>Publish</strong><small>Apply to CPQ</small></div></div>
            </div>
          </div>

          <section class="capability-group" *ngFor="let group of capabilityGroups">
            <div class="group-head"><div><span class="section-kicker">{{ group }}</span><h3>{{ groupTitle(group) }}</h3></div><span>{{ selectedCount(group) }}/{{ capabilitiesFor(group).length }} enabled</span></div>
            <div class="capability-grid">
              <label class="capability-card" *ngFor="let capability of capabilitiesFor(group)" [class.capability-card--enabled]="hasCapability(role, capability.key)" [class.capability-card--risk]="capability.risk === 'high'">
                <mat-checkbox [disabled]="role.system && role.name === 'System Administrator'" [checked]="hasCapability(role, capability.key)" (change)="toggleCapability(role, capability.key, $event.checked)"></mat-checkbox>
                <span class="capability-icon"><mat-icon>{{ capability.icon }}</mat-icon></span>
                <span class="capability-copy"><strong>{{ capability.label }}</strong><small>{{ capability.description }}</small><code>{{ capability.key }}</code></span>
                <span class="risk-pill" *ngIf="capability.risk === 'high'">Sensitive</span>
              </label>
            </div>
          </section>
        </main>
      </div>

    </section>
  `,
  styles: [`
    :host { display:block; }
    .studio-page { width:100%; margin:0; display:grid; gap:18px; }
    .page-header,.section-head,.editor-hero,.editor-title,.editor-actions,.user-head,.effective-access { display:flex; align-items:center; }
    .page-header { justify-content:space-between; gap:20px; }
    .eyebrow,.section-kicker { color:#2563eb; font-size:10px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
    h1 { margin:4px 0 5px; color:var(--app-text); font-size:30px; } .page-header p,.assignments-head p { margin:0; color:var(--app-text-muted); }
    .reset-button { border-radius:999px; }
    .prototype-notice { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:12px; padding:14px 16px; border:1px solid #bfdbfe; border-left:5px solid #2563eb; border-radius:14px; color:#1e3a8a; background:linear-gradient(90deg,#eff6ff,#f8fbff); }
    .prototype-notice > mat-icon { color:#2563eb; } .prototype-notice div { display:grid; gap:2px; } .prototype-notice span { font-size:13px; }
    .local-pill,.system-pill { display:inline-flex; align-items:center; gap:4px; padding:5px 9px; border:1px solid #bfdbfe; border-radius:999px; color:#1d4ed8; background:#fff; font-size:11px; font-weight:800; white-space:nowrap; }
    .system-pill mat-icon { width:13px; height:13px; font-size:13px; }
    .summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    .summary-grid mat-card { display:flex; align-items:center; gap:12px; padding:14px 16px; border:1px solid var(--app-border); border-radius:15px; box-shadow:none; background:var(--app-surface); }
    .summary-grid mat-icon { width:36px; height:36px; display:grid; place-items:center; border-radius:11px; color:#1d4ed8; background:#eff6ff; }
    .summary-grid mat-card > div { display:grid; } .summary-grid strong { color:var(--app-text); font-size:22px; line-height:1; } .summary-grid span { margin-top:4px; color:var(--app-text-muted); font-size:12px; }
    .summary-grid .risk-card mat-icon { color:#b91c1c; background:#fef2f2; }
    .studio-grid { display:grid; grid-template-columns:300px minmax(0,1fr); gap:16px; align-items:start; }
    .role-rail,.role-editor,.assignments-panel { border:1px solid var(--app-border); border-radius:18px; background:var(--app-surface); box-shadow:0 12px 30px rgba(15,23,42,.05); }
    .role-rail { position:sticky; top:82px; padding:16px; }
    .section-head { justify-content:space-between; gap:12px; } .section-head h2 { margin:3px 0 0; color:var(--app-text); font-size:20px; }
    .create-role { display:grid; gap:8px; margin:13px 0; padding:12px; border:1px solid #c7d2fe; border-radius:13px; background:#f8faff; }
    .create-role input,.create-role textarea { box-sizing:border-box; width:100%; border:1px solid #cbd5e1; border-radius:9px; padding:9px 10px; color:#0f172a; background:#fff; font:inherit; outline:none; }
    .create-role textarea { min-height:64px; resize:vertical; } .create-actions { display:flex; justify-content:flex-end; gap:5px; }
    .primary-button { color:#fff !important; background:#2563eb !important; }
    .role-list { display:grid; gap:7px; margin-top:14px; }
    .role-card { --role-color:#2563eb; display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:10px; width:100%; padding:10px; border:1px solid transparent; border-radius:13px; color:var(--app-text); background:transparent; text-align:left; cursor:pointer; }
    .role-card:hover { background:var(--app-surface-soft); } .role-card--selected { border-color:color-mix(in srgb,var(--role-color) 38%,transparent); background:color-mix(in srgb,var(--role-color) 8%,var(--app-surface)); }
    .role-icon,.editor-icon { display:grid; place-items:center; color:#fff; background:var(--role-color); }
    .role-icon { width:36px; height:36px; border-radius:11px; } .role-icon mat-icon { width:19px; height:19px; font-size:19px; }
    .role-card-copy { display:grid; gap:2px; min-width:0; } .role-card-copy strong { font-size:13px; } .role-card-copy small { color:var(--app-text-muted); font-size:11px; } .chevron { color:var(--app-text-muted); }
    .role-editor { overflow:hidden; }
    .editor-hero { --role-color:#2563eb; justify-content:space-between; gap:16px; padding:20px; border-bottom:1px solid var(--app-border); background:linear-gradient(110deg,color-mix(in srgb,var(--role-color) 10%,var(--app-surface)),var(--app-surface)); }
    .editor-title { gap:13px; min-width:0; } .editor-icon { width:48px; height:48px; border-radius:14px; box-shadow:0 8px 18px color-mix(in srgb,var(--role-color) 25%,transparent); }
    .editor-title h2 { margin:2px 0; color:var(--app-text); font-size:23px; } .editor-title p { margin:0; color:var(--app-text-muted); }
    .editor-actions { gap:7px; } .editor-actions button { border-radius:999px; }
    .workflow-preview { margin:18px 20px 4px; padding:14px; border:1px solid #dbeafe; border-radius:14px; background:linear-gradient(90deg,#f8fbff,#fff); }
    .workflow-title { display:flex; align-items:center; gap:9px; color:#1e3a8a; } .workflow-title > div { display:grid; } .workflow-title span { color:#64748b; font-size:12px; }
    .workflow-steps { display:grid; grid-template-columns:1fr auto 1fr auto 1fr; align-items:center; gap:8px; margin-top:13px; }
    .workflow-steps > div { display:flex; align-items:center; gap:8px; padding:9px; border:1px dashed #cbd5e1; border-radius:11px; opacity:.5; }
    .workflow-steps > div.step-on { border-style:solid; border-color:#93c5fd; opacity:1; background:#eff6ff; }
    .workflow-steps > div > span { width:25px; height:25px; display:grid; place-items:center; border-radius:50%; color:#475569; background:#e2e8f0; font-size:11px; font-weight:900; }
    .workflow-steps .step-on > span { color:#fff; background:#2563eb; } .workflow-steps div div { display:grid; } .workflow-steps small { color:#64748b; } .workflow-steps > mat-icon { color:#94a3b8; }
    .capability-group { padding:18px 20px 4px; } .capability-group:last-child { padding-bottom:20px; }
    .group-head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:10px; } .group-head h3 { margin:2px 0 0; color:var(--app-text); font-size:17px; } .group-head > span { color:var(--app-text-muted); font-size:11px; font-weight:700; }
    .capability-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
    .capability-card { position:relative; display:grid; grid-template-columns:auto auto 1fr; align-items:start; gap:9px; min-height:92px; padding:11px; border:1px solid var(--app-border); border-radius:13px; background:var(--app-surface-soft); cursor:pointer; }
    .capability-card--enabled { border-color:#93c5fd; background:linear-gradient(135deg,#eff6ff,#fff); } .capability-card--risk.capability-card--enabled { border-color:#fca5a5; background:linear-gradient(135deg,#fef2f2,#fff); }
    .capability-icon { width:31px; height:31px; display:grid; place-items:center; border-radius:9px; color:#475569; background:#e2e8f0; } .capability-icon mat-icon { width:17px; height:17px; font-size:17px; }
    .capability-card--enabled .capability-icon { color:#1d4ed8; background:#dbeafe; } .capability-card--risk.capability-card--enabled .capability-icon { color:#b91c1c; background:#fee2e2; }
    .capability-copy { display:grid; gap:3px; padding-right:2px; } .capability-copy strong { color:var(--app-text); font-size:13px; } .capability-copy small { color:var(--app-text-muted); line-height:1.35; } .capability-copy code { color:#64748b; font-size:10px; }
    .risk-pill { position:absolute; right:8px; top:7px; color:#b91c1c; font-size:9px; font-weight:900; text-transform:uppercase; }
    .assignments-panel { padding:20px; } .assignments-head { align-items:flex-start; margin-bottom:15px; }
    .user-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:11px; } .user-card { display:grid; gap:12px; padding:14px; border:1px solid var(--app-border); border-radius:14px; background:var(--app-surface-soft); }
    .user-head { gap:9px; } .user-head > div { display:grid; min-width:0; } .user-head small { color:var(--app-text-muted); } .avatar { width:36px; height:36px; display:grid; place-items:center; flex:0 0 auto; border-radius:11px; color:#1e40af; background:#dbeafe; font-weight:900; }
    .admin-marker { margin-left:auto; color:#7c3aed; font-size:9px; font-weight:900; text-transform:uppercase; }
    .user-card mat-form-field { width:100%; } .role-chips { display:flex; flex-wrap:wrap; gap:5px; }
    .role-chips span { --chip-color:#2563eb; padding:4px 7px; border:1px solid color-mix(in srgb,var(--chip-color) 30%,transparent); border-radius:999px; color:var(--chip-color); background:color-mix(in srgb,var(--chip-color) 8%,var(--app-surface)); font-size:10px; font-weight:800; }
    .no-role { display:flex; align-items:center; gap:5px; color:#b45309; font-size:11px; } .no-role mat-icon { width:16px; height:16px; font-size:16px; }
    .effective-access { justify-content:space-between; padding-top:9px; border-top:1px solid var(--app-border); color:var(--app-text-muted); font-size:11px; } .effective-access strong { color:var(--app-text); }
    .loading-users { display:flex; align-items:center; gap:8px; color:var(--app-text-muted); padding:15px; }
    :host-context(html.theme-dark) .prototype-notice { color:#bfdbfe; border-color:rgba(96,165,250,.35); border-left-color:#60a5fa; background:linear-gradient(90deg,rgba(30,64,175,.22),rgba(15,23,42,.9)); }
    :host-context(html.theme-dark) .local-pill,:host-context(html.theme-dark) .system-pill { color:#bfdbfe; border-color:rgba(96,165,250,.35); background:#111c32; }
    :host-context(html.theme-dark) .create-role { border-color:rgba(129,140,248,.3); background:#111c32; } :host-context(html.theme-dark) .create-role input,:host-context(html.theme-dark) .create-role textarea { color:#f8fafc; border-color:#475569; background:#0f172a; }
    :host-context(html.theme-dark) .workflow-preview { border-color:rgba(96,165,250,.25); background:linear-gradient(90deg,#111c32,#0f172a); } :host-context(html.theme-dark) .workflow-title { color:#bfdbfe; }
    :host-context(html.theme-dark) .workflow-steps > div.step-on { border-color:rgba(96,165,250,.45); background:rgba(30,64,175,.22); }
    :host-context(html.theme-dark) .capability-card--enabled { border-color:rgba(96,165,250,.45); background:linear-gradient(135deg,rgba(30,64,175,.22),#111827); } :host-context(html.theme-dark) .capability-card--risk.capability-card--enabled { border-color:rgba(248,113,113,.42); background:linear-gradient(135deg,rgba(127,29,29,.25),#111827); }
    @media (max-width:1100px) { .summary-grid { grid-template-columns:repeat(2,1fr); } .studio-grid { grid-template-columns:250px minmax(0,1fr); } .capability-grid { grid-template-columns:1fr; } .user-grid { grid-template-columns:repeat(2,1fr); } }
    @media (max-width:760px) { .page-header { align-items:flex-start; flex-direction:column; } .reset-button { width:100%; } .prototype-notice { grid-template-columns:auto 1fr; } .prototype-notice .local-pill { grid-column:2; justify-self:start; } .studio-grid { grid-template-columns:1fr; } .role-rail { position:static; } .role-list { grid-template-columns:repeat(2,minmax(0,1fr)); } .editor-hero { align-items:flex-start; flex-direction:column; } .editor-actions { width:100%; flex-wrap:wrap; } .workflow-steps { grid-template-columns:1fr; } .workflow-steps > mat-icon { transform:rotate(90deg); justify-self:center; } .user-grid { grid-template-columns:1fr; } }
    @media (max-width:480px) { .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; } .summary-grid mat-card { display:grid; justify-items:center; gap:7px; padding:11px 8px; text-align:center; } .role-list { grid-template-columns:1fr; } .editor-title { align-items:flex-start; } .capability-group,.editor-hero,.assignments-panel { padding-left:14px; padding-right:14px; } .workflow-preview { margin-left:14px; margin-right:14px; } }
  `]
})
export class AccessStudioComponent implements OnInit {
  private readonly localAuth = inject(LocalAuthService);

  readonly capabilities = CAPABILITIES;
  readonly capabilityGroups: CapabilityGroup[] = ['Data workflow', 'Approval & publication', 'Internal tools', 'Governance & administration'];
  readonly contributionKeys = ['imports.upload', 'imports.correct_own', 'imports.withdraw_own', 'imports.submit'];
  readonly approvalKeys = ['imports.approve', 'imports.reject', 'imports.return_to_review'];

  roles: PrototypeRole[] = [];
  selectedRoleId = '';
  showCreateRole = false;
  newRoleName = '';
  newRoleDescription = '';

  ngOnInit(): void {
    this.loadRoles();
  }

  get selectedRole(): PrototypeRole | null {
    return this.roles.find(role => role.id === this.selectedRoleId) ?? null;
  }

  get assignedUserCount(): number {
    return this.roles.reduce((total, role) => total + role.assignedUsers, 0);
  }

  get highRiskCapabilityCount(): number {
    return this.capabilities.filter(capability => capability.risk === 'high').length;
  }

  selectRole(roleId: string): void {
    this.selectedRoleId = roleId;
  }

  capabilitiesFor(group: CapabilityGroup): CapabilityDefinition[] {
    return this.capabilities.filter(capability => capability.group === group);
  }

  groupTitle(group: CapabilityGroup): string {
    const titles: Record<CapabilityGroup, string> = {
      'Data workflow': 'Contribution controls',
      'Approval & publication': 'Decision gates',
      'Internal tools': 'Protected utilities',
      'Governance & administration': 'Platform governance'
    };
    return titles[group];
  }

  selectedCount(group: CapabilityGroup): number {
    const role = this.selectedRole;
    return role ? this.capabilitiesFor(group).filter(capability => role.capabilities.includes(capability.key)).length : 0;
  }

  hasCapability(role: PrototypeRole, capabilityKey: string): boolean {
    return role.capabilities.includes(capabilityKey);
  }

  hasAny(role: PrototypeRole, capabilityKeys: string[]): boolean {
    return capabilityKeys.some(key => role.capabilities.includes(key));
  }

  toggleCapability(role: PrototypeRole, capabilityKey: string, enabled: boolean): void {
    const previous = [...role.capabilities];
    role.capabilities = enabled
      ? Array.from(new Set([...role.capabilities, capabilityKey]))
      : role.capabilities.filter(key => key !== capabilityKey);
    this.saveRole(role, () => role.capabilities = previous);
  }

  createRole(): void {
    const name = this.newRoleName.trim();
    if (!name) return;
    this.localAuth.createAccessRole({ name, description: this.newRoleDescription.trim() || 'Custom capability profile.', icon: 'person_shield', color: ROLE_COLORS[this.roles.length % ROLE_COLORS.length], capabilities: [] }).subscribe(role => {
      const mapped = this.mapRole(role);
      this.roles = [...this.roles, mapped];
      this.selectedRoleId = mapped.id;
      this.cancelCreateRole();
    });
  }

  duplicateRole(source: PrototypeRole): void {
    this.localAuth.createAccessRole({ name: `${source.name} copy`, description: source.description, icon: source.icon, color: source.color, capabilities: [...source.capabilities] }).subscribe(role => {
      const mapped = this.mapRole(role);
      this.roles = [...this.roles, mapped];
      this.selectedRoleId = mapped.id;
    });
  }

  deleteRole(role: PrototypeRole): void {
    if (role.system) return;
    this.localAuth.deleteAccessRole(role.id).subscribe(() => {
      this.roles = this.roles.filter(item => item.id !== role.id);
      this.selectedRoleId = this.roles[0]?.id ?? '';
    });
  }

  cancelCreateRole(): void {
    this.showCreateRole = false;
    this.newRoleName = '';
    this.newRoleDescription = '';
  }

  loadRoles(): void {
    this.localAuth.getAccessRoles().subscribe(roles => {
      this.roles = roles.map(role => this.mapRole(role));
      if (!this.roles.some(role => role.id === this.selectedRoleId)) this.selectedRoleId = this.roles[0]?.id ?? '';
    });
  }

  private saveRole(role: PrototypeRole, rollback: () => void): void {
    this.localAuth.updateAccessRole(role.id, { name: role.name, description: role.description, icon: role.icon, color: role.color, capabilities: role.capabilities }).subscribe({
      next: saved => Object.assign(role, this.mapRole(saved)),
      error: rollback
    });
  }

  private mapRole(role: AccessRole): PrototypeRole {
    return { id: role.id, name: role.name, description: role.description, icon: role.icon, color: role.color, capabilities: role.capabilities, system: role.isSystem, assignedUsers: role.assignedUsers };
  }
}
