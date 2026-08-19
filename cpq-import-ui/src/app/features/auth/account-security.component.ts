import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { finalize } from 'rxjs/operators';
import { AuthFacade } from '../../core/auth/auth.facade';
import { LocalAuthService } from '../../core/auth/local-auth.service';

@Component({
  selector: 'app-account-security',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatIconModule, MatInputModule, MatFormFieldModule],
  template: `
    <section class="security-page">
      <header class="security-hero">
        <a [routerLink]="auth.homeRoute" class="back-link"><mat-icon>arrow_back</mat-icon> Back to workspace</a>
        <div class="security-hero__content">
          <span class="security-hero__mark"><mat-icon>shield_lock</mat-icon></span>
          <div>
            <span class="eyebrow">Personal account security</span>
            <h1>Change your password</h1>
            <p>Protect your workspace access with a password known only to you.</p>
          </div>
          <span class="identity-chip"><i></i>{{ auth.loginName }}</span>
        </div>
      </header>

      <div class="security-layout">
        <form class="password-card" [formGroup]="form" (ngSubmit)="submit()">
          <div class="card-heading">
            <span><mat-icon>password</mat-icon></span>
            <div><small>Credentials</small><h2>Set a new password</h2></div>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Current password</mat-label>
            <input matInput [type]="showCurrent ? 'text' : 'password'" formControlName="currentPassword" autocomplete="current-password" />
            <button mat-icon-button matSuffix type="button" (click)="showCurrent = !showCurrent" [attr.aria-label]="showCurrent ? 'Hide current password' : 'Show current password'">
              <mat-icon>{{ showCurrent ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-error><mat-icon>info</mat-icon> Enter your current password</mat-error>
          </mat-form-field>

          <div class="new-password-grid">
            <mat-form-field appearance="outline">
              <mat-label>New password</mat-label>
              <input matInput [type]="showNew ? 'text' : 'password'" formControlName="newPassword" autocomplete="new-password" />
              <button mat-icon-button matSuffix type="button" (click)="showNew = !showNew" [attr.aria-label]="showNew ? 'Hide new password' : 'Show new password'">
                <mat-icon>{{ showNew ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="form.controls.newPassword.hasError('required')"><mat-icon>info</mat-icon> Enter a new password</mat-error>
              <mat-error *ngIf="form.controls.newPassword.hasError('minlength')"><mat-icon>info</mat-icon> Use at least 8 characters</mat-error>
              <mat-error *ngIf="form.controls.newPassword.hasError('maxlength')"><mat-icon>info</mat-icon> Use no more than 128 characters</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Confirm new password</mat-label>
              <input matInput [type]="showNew ? 'text' : 'password'" formControlName="confirmation" autocomplete="new-password" />
              <mat-error><mat-icon>info</mat-icon> Confirm your new password</mat-error>
            </mat-form-field>
          </div>

          <p class="form-error" *ngIf="passwordMismatch"><mat-icon>error_outline</mat-icon> The new passwords do not match.</p>
          <p class="form-error" *ngIf="error"><mat-icon>error_outline</mat-icon> {{ error }}</p>

          <div class="password-guidance">
            <mat-icon>tips_and_updates</mat-icon>
            <span><strong>Use a password unique to this platform.</strong><small>A longer phrase is easier to remember and harder to guess.</small></span>
          </div>

          <footer class="form-actions">
            <a mat-button [routerLink]="auth.homeRoute">Cancel</a>
            <button mat-flat-button type="submit" [disabled]="form.invalid || passwordMismatch || submitting">
              <mat-icon>{{ submitting ? 'hourglass_top' : 'verified_user' }}</mat-icon>
              {{ submitting ? 'Changing password...' : 'Change password' }}
            </button>
          </footer>
        </form>

        <aside class="security-proof">
          <span class="eyebrow">What happens next</span>
          <h2>Your access stays uninterrupted.</h2>
          <article><span><mat-icon>check</mat-icon></span><div><strong>Immediate protection</strong><p>Your previous password stops working as soon as the change succeeds.</p></div></article>
          <article><span><mat-icon>lock</mat-icon></span><div><strong>Private by design</strong><p>Passwords are securely hashed. Administrators and audit records never see them.</p></div></article>
          <article><span><mat-icon>history</mat-icon></span><div><strong>Account traceability</strong><p>The security event is recorded without storing either password.</p></div></article>
          <div class="locked-out"><mat-icon>support_agent</mat-icon><span><strong>Already locked out?</strong><small>An administrator can issue a secure assisted reset.</small></span></div>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .security-page { min-height:calc(100vh - 86px); color:var(--app-text); }
    .security-hero { overflow:hidden; position:relative; padding:26px 30px 30px; border:1px solid color-mix(in srgb, var(--app-accent) 24%, var(--app-border)); border-radius:22px; background:radial-gradient(circle at 92% 5%, color-mix(in srgb, var(--app-accent) 16%, transparent), transparent 30%), linear-gradient(120deg, color-mix(in srgb, var(--app-surface) 94%, #dff7f3), var(--app-surface)); box-shadow:var(--app-shadow-sm); }
    .back-link { width:max-content; display:inline-flex; align-items:center; gap:7px; color:var(--app-muted); font-size:12px; font-weight:750; text-decoration:none; }
    .back-link:hover { color:var(--app-accent); }
    .back-link mat-icon { width:17px; height:17px; font-size:17px; }
    .security-hero__content { display:grid; grid-template-columns:64px minmax(0,1fr) auto; align-items:center; gap:18px; margin-top:24px; }
    .security-hero__mark { width:64px; height:64px; display:grid; place-items:center; border-radius:19px; color:#fff; background:linear-gradient(145deg,#0f9f96,#2854c5); box-shadow:0 14px 30px rgba(37,84,197,.2); }
    .security-hero__mark mat-icon { width:31px; height:31px; font-size:31px; }
    .eyebrow { color:#0f8e84; font-size:10px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
    h1,h2 { margin:0; font-family:"Bahnschrift","Trebuchet MS",sans-serif; }
    h1 { margin-top:5px; font-size:clamp(28px,3vw,42px); line-height:1.05; letter-spacing:-.035em; }
    .security-hero p { margin:8px 0 0; color:var(--app-muted); font-size:14px; }
    .identity-chip { display:inline-flex; align-items:center; gap:9px; padding:10px 14px; border:1px solid var(--app-border); border-radius:999px; color:var(--app-text); background:color-mix(in srgb,var(--app-surface) 82%,transparent); font-size:12px; font-weight:750; }
    .identity-chip i { width:7px; height:7px; border-radius:50%; background:#14b8a6; box-shadow:0 0 0 4px rgba(20,184,166,.12); }
    .security-layout { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr); gap:18px; margin-top:18px; }
    .password-card,.security-proof { border:1px solid var(--app-border); border-radius:22px; background:var(--app-surface); box-shadow:var(--app-shadow-sm); }
    .password-card { display:grid; gap:18px; padding:26px; }
    .card-heading { display:flex; align-items:center; gap:13px; padding-bottom:4px; }
    .card-heading > span { width:43px; height:43px; display:grid; place-items:center; border-radius:13px; color:#1d4ed8; background:color-mix(in srgb,#3b82f6 12%,var(--app-surface)); }
    .card-heading small { color:var(--app-muted); font-size:9px; font-weight:850; letter-spacing:.08em; text-transform:uppercase; }
    .card-heading h2 { margin-top:2px; font-size:21px; }
    mat-form-field {
      width:100%;
      --mdc-outlined-text-field-container-shape:13px;
      --mdc-outlined-text-field-outline-color:#cbd4df;
      --mdc-outlined-text-field-hover-outline-color:#82aaa6;
      --mdc-outlined-text-field-focus-outline-color:#0f8e84;
      --mdc-outlined-text-field-focus-label-text-color:#0b7a72;
      --mdc-outlined-text-field-caret-color:#0f8e84;
      --mdc-outlined-text-field-input-text-color:var(--app-text);
      --mdc-outlined-text-field-input-text-placeholder-color:#7b8798;
      --mdc-outlined-text-field-error-outline-color:#9da9b8;
      --mdc-outlined-text-field-error-hover-outline-color:#748298;
      --mdc-outlined-text-field-error-focus-outline-color:#0f8e84;
      --mdc-outlined-text-field-error-label-text-color:#5f6d82;
      --mat-form-field-error-text-color:#5f6d82;
    }
    .new-password-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    :host ::ng-deep .password-card .mat-mdc-text-field-wrapper { background:color-mix(in srgb,var(--app-surface) 96%,#f2f8f7); transition:background-color 180ms ease; }
    :host ::ng-deep .password-card mat-form-field:focus-within .mat-mdc-text-field-wrapper { background:color-mix(in srgb,var(--app-surface) 92%,#eaf8f5); box-shadow:none !important; }
    :host ::ng-deep .password-card .mdc-notched-outline__leading,
    :host ::ng-deep .password-card .mdc-notched-outline__notch,
    :host ::ng-deep .password-card .mdc-notched-outline__trailing { transition:border-color 180ms ease,border-width 180ms ease; }
    :host ::ng-deep .password-card input:focus { outline:none !important; outline-offset:0 !important; }
    :host ::ng-deep .password-card mat-error { display:flex; align-items:center; gap:5px; color:#5f6d82; font-size:11px; font-weight:700; letter-spacing:.01em; }
    :host ::ng-deep .password-card mat-error mat-icon { width:14px; height:14px; color:#0f8e84; font-size:14px; }
    :host-context(html.theme-dark) mat-form-field { --mdc-outlined-text-field-outline-color:color-mix(in srgb,var(--app-text) 28%,transparent); --mdc-outlined-text-field-hover-outline-color:#5ea8a1; --mdc-outlined-text-field-error-outline-color:#66758a; --mdc-outlined-text-field-error-label-text-color:#aeb9c9; --mat-form-field-error-text-color:#aeb9c9; }
    :host-context(html.theme-dark) ::ng-deep .password-card mat-error { color:#aeb9c9; }
    .form-error { display:flex; align-items:center; gap:8px; margin:-8px 0 0; color:#dc2626; font-size:12px; font-weight:700; }
    .form-error mat-icon { width:17px; height:17px; font-size:17px; }
    .password-guidance { display:flex; gap:11px; padding:13px 14px; border:1px solid color-mix(in srgb,#0f9f96 25%,var(--app-border)); border-radius:13px; color:#0f766e; background:color-mix(in srgb,#0f9f96 7%,var(--app-surface)); }
    .password-guidance > span { display:grid; gap:2px; }
    .password-guidance strong { font-size:12px; }
    .password-guidance small { color:var(--app-muted); font-size:11px; }
    .form-actions { display:flex; justify-content:flex-end; gap:10px; padding-top:3px; }
    .form-actions button { min-width:190px; background:#2854c5; color:#fff; }
    .security-proof { padding:28px; background:linear-gradient(150deg,#0d1b38,#0b2e38); color:#f8fafc; }
    .security-proof h2 { max-width:320px; margin:10px 0 25px; font-size:27px; line-height:1.12; }
    .security-proof article { display:grid; grid-template-columns:34px 1fr; gap:12px; padding:16px 0; border-top:1px solid rgba(255,255,255,.11); }
    .security-proof article > span { width:30px; height:30px; display:grid; place-items:center; border-radius:9px; color:#5eead4; background:rgba(45,212,191,.1); }
    .security-proof article mat-icon { width:17px; height:17px; font-size:17px; }
    .security-proof article strong { font-size:13px; }
    .security-proof article p { margin:4px 0 0; color:#b8c6d9; font-size:11px; line-height:1.5; }
    .locked-out { display:flex; align-items:center; gap:11px; margin-top:18px; padding:13px; border-radius:13px; background:rgba(255,255,255,.07); }
    .locked-out > mat-icon { color:#67e8f9; }
    .locked-out span { display:grid; gap:2px; }
    .locked-out strong { font-size:11px; }
    .locked-out small { color:#b8c6d9; font-size:10px; }
    @media (max-width:900px) { .security-layout { grid-template-columns:1fr; } .security-proof { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; } .security-proof > .eyebrow,.security-proof > h2,.locked-out { grid-column:1/-1; } .security-proof article { grid-template-columns:30px 1fr; } }
    @media (max-width:640px) { .security-hero { padding:20px; } .security-hero__content { grid-template-columns:48px 1fr; } .security-hero__mark { width:48px; height:48px; border-radius:15px; } .security-hero__mark mat-icon { width:24px; height:24px; font-size:24px; } .identity-chip { grid-column:1/-1; width:max-content; } .password-card,.security-proof { padding:20px; border-radius:18px; } .new-password-grid,.security-proof { grid-template-columns:1fr; } .security-proof > .eyebrow,.security-proof > h2,.locked-out { grid-column:auto; } .form-actions { flex-direction:column-reverse; } .form-actions a,.form-actions button { width:100%; } }
  `]
})
export class AccountSecurityComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly localAuth = inject(LocalAuthService);
  readonly auth = inject(AuthFacade);

  readonly form = this.formBuilder.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    confirmation: ['', Validators.required]
  });

  showCurrent = false;
  showNew = false;
  submitting = false;
  error = '';

  get passwordMismatch(): boolean {
    const confirmation = this.form.controls.confirmation;
    return confirmation.touched && confirmation.value !== this.form.controls.newPassword.value;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.form.controls.newPassword.value !== this.form.controls.confirmation.value || this.submitting) return;

    this.error = '';
    this.submitting = true;
    this.localAuth.changePassword(this.form.controls.currentPassword.value, this.form.controls.newPassword.value)
      .pipe(finalize(() => this.submitting = false))
      .subscribe({
        next: () => {
          this.form.reset();
          this.showCurrent = false;
          this.showNew = false;
        },
        error: error => {
          this.error = error?.error?.error ?? 'The password could not be changed. Please try again.';
        }
      });
  }
}
