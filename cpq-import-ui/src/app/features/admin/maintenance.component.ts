import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { LocalAuthService } from '../../core/auth/local-auth.service';

interface ResetResult {
  message: string;
  preservedTable: string;
  clearedImportTables: string[];
  clearedCpqTables: string[];
}

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <section class="maintenance-page">
      <header class="page-header">
        <div>
          <div class="eyebrow">Platform administration</div>
          <h1>Maintenance</h1>
          <p>Controlled tools for clearing test data without removing identities or access configuration.</p>
        </div>
        <span class="capability-pill"><mat-icon>verified_user</mat-icon> system.maintenance</span>
      </header>

      <div class="warning-banner">
        <mat-icon>warning_amber</mat-icon>
        <div><strong>These actions affect shared platform data.</strong><span>Review the complete impact before confirming. Maintenance operations cannot be undone.</span></div>
      </div>

      <mat-card class="reset-card">
        <div class="card-heading">
          <span class="danger-icon"><mat-icon>delete_sweep</mat-icon></span>
          <div><span class="section-kicker">Danger zone</span><h2>Reset test data</h2><p>Return the import workflow and CPQ test database to a clean state.</p></div>
        </div>

        <div class="impact-grid">
          <article class="impact-card impact-card--remove"><mat-icon>history</mat-icon><div><strong>Import workspace</strong><span>Uploads, staging rows, audit activity and notifications are deleted.</span></div></article>
          <article class="impact-card impact-card--remove"><mat-icon>database</mat-icon><div><strong>CPQ database</strong><span>Articles, prices, descriptions and currency rates are deleted.</span></div></article>
          <article class="impact-card impact-card--preserve"><mat-icon>shield</mat-icon><div><strong>Access is preserved</strong><span>User accounts, roles, capabilities and assignments remain untouched.</span></div></article>
        </div>

        <div class="card-footer">
          <div><strong>Use only when a complete test-cycle reset is required.</strong><span>This is not a per-upload deletion tool.</span></div>
          <button mat-raised-button type="button" class="danger-button" (click)="openConfirmation()"><mat-icon>delete_forever</mat-icon> Reset data</button>
        </div>
      </mat-card>

      <div class="result-banner" *ngIf="successMessage"><mat-icon>check_circle</mat-icon><div><strong>Reset completed</strong><span>{{ successMessage }}</span></div></div>
      <div class="error-banner" *ngIf="errorMessage"><mat-icon>error</mat-icon><div><strong>Reset was not completed</strong><span>{{ errorMessage }}</span></div></div>

      <div class="modal-backdrop" *ngIf="confirming" (click)="closeConfirmation()"></div>
      <section class="confirm-dialog" *ngIf="confirming" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <div class="dialog-icon"><mat-icon>report</mat-icon></div>
        <div class="dialog-copy">
          <span class="section-kicker">Destructive operation</span>
          <h2 id="reset-title">Reset import and CPQ data?</h2>
          <p>All workflow history and all CPQ test articles, prices, descriptions and currency rates will be permanently deleted.</p>
        </div>
        <div class="preserved-note"><mat-icon>lock</mat-icon><span><strong>Preserved:</strong> user accounts, role definitions, capability settings and user-role assignments.</span></div>
        <label class="confirm-field"><span>Type <strong>RESET</strong> to confirm</span><input [(ngModel)]="confirmationText" autocomplete="off" placeholder="RESET" (keyup.enter)="runReset()" /></label>
        <div class="dialog-actions">
          <button mat-button type="button" (click)="closeConfirmation()" [disabled]="resetting">Cancel</button>
          <button mat-raised-button type="button" class="danger-button" [disabled]="confirmationText !== 'RESET' || resetting" (click)="runReset()"><mat-icon>{{ resetting ? 'hourglass_top' : 'delete_forever' }}</mat-icon>{{ resetting ? 'Resetting...' : 'Permanently reset data' }}</button>
        </div>
      </section>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .maintenance-page { max-width:1120px; margin:0 auto; display:grid; gap:18px; }
    .page-header,.card-heading,.card-footer,.dialog-actions { display:flex; align-items:center; }
    .page-header { justify-content:space-between; gap:20px; }
    .eyebrow,.section-kicker { color:#dc2626; font-size:10px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
    h1 { margin:4px 0 5px; color:var(--app-text); font-size:30px; } .page-header p,.card-heading p { margin:0; color:var(--app-text-muted); }
    .capability-pill { display:inline-flex; align-items:center; gap:6px; padding:7px 11px; border:1px solid var(--app-border); border-radius:999px; color:var(--app-text-muted); background:var(--app-surface); font:700 11px/1 monospace; }
    .capability-pill mat-icon { width:16px; height:16px; color:#16a34a; font-size:16px; }
    .warning-banner,.result-banner,.error-banner,.preserved-note { display:flex; align-items:flex-start; gap:11px; padding:14px 16px; border-radius:14px; }
    .warning-banner { color:#92400e; border:1px solid #fcd34d; background:#fffbeb; } .warning-banner div,.result-banner div,.error-banner div { display:grid; gap:2px; } .warning-banner span,.result-banner span,.error-banner span { font-size:13px; line-height:1.45; }
    .reset-card { overflow:hidden; padding:22px; border:1px solid #fecaca; border-top:4px solid #dc2626; border-radius:18px; background:var(--app-surface); box-shadow:0 14px 34px rgba(127,29,29,.08); }
    .card-heading { gap:14px; } .card-heading h2 { margin:3px 0; color:var(--app-text); font-size:23px; } .danger-icon { width:48px; height:48px; display:grid; place-items:center; flex:0 0 auto; border-radius:14px; color:#dc2626; background:#fef2f2; }
    .impact-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:11px; margin:21px 0; }
    .impact-card { display:flex; align-items:flex-start; gap:10px; padding:14px; border:1px solid var(--app-border); border-radius:14px; background:var(--app-surface-soft); } .impact-card > mat-icon { flex:0 0 auto; } .impact-card div { display:grid; gap:4px; } .impact-card strong { color:var(--app-text); font-size:13px; } .impact-card span { color:var(--app-text-muted); font-size:12px; line-height:1.45; } .impact-card--remove > mat-icon { color:#dc2626; } .impact-card--preserve > mat-icon { color:#16a34a; }
    .card-footer { justify-content:space-between; gap:18px; padding-top:18px; border-top:1px solid var(--app-border); } .card-footer > div { display:grid; gap:3px; color:var(--app-text); font-size:13px; } .card-footer span { color:var(--app-text-muted); font-size:12px; }
    .danger-button { color:#fff !important; background:linear-gradient(135deg,#dc2626,#b91c1c) !important; border-radius:999px !important; }
    .result-banner { color:#166534; border:1px solid #86efac; background:#f0fdf4; } .error-banner { color:#991b1b; border:1px solid #fca5a5; background:#fef2f2; }
    .modal-backdrop { position:fixed; inset:0; z-index:400; background:rgba(2,6,23,.68); backdrop-filter:blur(4px); }
    .confirm-dialog { position:fixed; z-index:410; top:50%; left:50%; width:min(570px,calc(100vw - 28px)); box-sizing:border-box; display:grid; grid-template-columns:auto 1fr; gap:16px; padding:24px; border:1px solid #fca5a5; border-radius:20px; background:var(--app-surface); box-shadow:0 28px 80px rgba(2,6,23,.4); transform:translate(-50%,-50%); }
    .dialog-icon { width:48px; height:48px; display:grid; place-items:center; border-radius:14px; color:#fff; background:#dc2626; box-shadow:0 8px 20px rgba(220,38,38,.25); } .dialog-copy h2 { margin:4px 0 7px; color:var(--app-text); font-size:23px; } .dialog-copy p { margin:0; color:var(--app-text-muted); line-height:1.5; }
    .preserved-note,.confirm-field,.dialog-actions { grid-column:1 / -1; } .preserved-note { color:#166534; border:1px solid #86efac; background:#f0fdf4; font-size:13px; } .preserved-note mat-icon { flex:0 0 auto; }
    .confirm-field { display:grid; gap:7px; color:var(--app-text); font-size:12px; } .confirm-field input { box-sizing:border-box; width:100%; padding:12px 13px; border:1px solid var(--app-border); border-radius:11px; outline:0; color:var(--app-text); background:var(--app-surface-soft); font:800 14px/1 monospace; } .confirm-field input:focus { border-color:#ef4444; box-shadow:0 0 0 3px rgba(239,68,68,.12); }
    .dialog-actions { justify-content:flex-end; gap:8px; padding-top:4px; }
    :host-context(html.theme-dark) .warning-banner { color:#fde68a; border-color:rgba(245,158,11,.4); background:rgba(120,53,15,.2); } :host-context(html.theme-dark) .danger-icon { color:#f87171; background:rgba(127,29,29,.25); } :host-context(html.theme-dark) .result-banner,:host-context(html.theme-dark) .preserved-note { color:#bbf7d0; border-color:rgba(34,197,94,.35); background:rgba(20,83,45,.22); } :host-context(html.theme-dark) .error-banner { color:#fecaca; border-color:rgba(248,113,113,.35); background:rgba(127,29,29,.22); }
    @media (max-width:760px) { .page-header { align-items:flex-start; flex-direction:column; } .impact-grid { grid-template-columns:1fr; } .card-footer { align-items:stretch; flex-direction:column; } .card-footer button { width:100%; } }
    @media (max-width:500px) { .reset-card { padding:16px; } .card-heading { align-items:flex-start; } .confirm-dialog { grid-template-columns:1fr; padding:19px; } .dialog-icon { width:42px; height:42px; } .dialog-actions { flex-direction:column-reverse; } .dialog-actions button { width:100%; } }
  `]
})
export class MaintenanceComponent {
  private readonly auth = inject(LocalAuthService);
  confirming = false;
  resetting = false;
  confirmationText = '';
  successMessage = '';
  errorMessage = '';

  openConfirmation(): void {
    this.confirmationText = '';
    this.errorMessage = '';
    this.confirming = true;
  }

  closeConfirmation(): void {
    if (this.resetting) return;
    this.confirming = false;
    this.confirmationText = '';
  }

  runReset(): void {
    if (this.confirmationText !== 'RESET' || this.resetting) return;
    this.resetting = true;
    this.auth.resetDevData().subscribe({
      next: result => {
        const response = result as ResetResult;
        this.successMessage = response.message || 'Import and CPQ test data were cleared. Access configuration was preserved.';
        this.errorMessage = '';
        this.resetting = false;
        this.confirming = false;
        this.confirmationText = '';
      },
      error: error => {
        this.errorMessage = error?.error?.error ?? 'Unable to reset test data.';
        this.resetting = false;
      }
    });
  }
}
