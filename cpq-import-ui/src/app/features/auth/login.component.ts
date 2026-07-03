import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LocalAuthService } from '../../core/auth/local-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <section class="landing-shell">
      <div class="landing-grid">
        <div class="business-column">
          <div class="brand-line">
            <span class="brand-mark" aria-hidden="true">
              <mat-icon>cloud_upload</mat-icon>
            </span>
            <div>
              <p class="eyebrow">Legrand internal platform</p>
              <p class="brand-subtitle">Data governance for CPQ operations</p>
            </div>
          </div>

          <h1>Data Quality &amp; Validation Portal</h1>
          <p class="hero-copy">
            A centralized platform to simplify data submissions, improve data quality and accelerate CPQ updates across all sites.
          </p>

          <div class="trust-row" aria-label="Platform highlights">
            <span class="trust-pill">
              <mat-icon>verified</mat-icon>
              Standardized workflow
            </span>
            <span class="trust-pill">
              <mat-icon>shield</mat-icon>
              Controlled approvals
            </span>
            <span class="trust-pill">
              <mat-icon>sync_alt</mat-icon>
              Faster CPQ updates
            </span>
          </div>

          <section class="mission-panel" aria-labelledby="mission-title">
            <div class="mission-icon" aria-hidden="true">
              <mat-icon>verified</mat-icon>
            </div>
            <div>
              <h2 id="mission-title">Mission</h2>
              <p>
                Enable every site to deliver complete, validated and consistent data through a simple, transparent and collaborative workflow.
              </p>
            </div>
          </section>

          <section class="value-section" aria-labelledby="value-title">
            <div class="section-heading">
              <p>Business Value</p>
              <h2 id="value-title">Built for operational excellence</h2>
            </div>

            <div class="value-grid">
              <article class="value-card" *ngFor="let value of businessValues">
                <span class="value-icon" aria-hidden="true">
                  <mat-icon>{{ value.icon }}</mat-icon>
                </span>
                <h3>{{ value.title }}</h3>
                <p>{{ value.description }}</p>
              </article>
            </div>
          </section>

          <section class="workflow-section" aria-labelledby="workflow-title">
            <div class="section-heading">
              <p>Standard Workflow</p>
              <h2 id="workflow-title">From preparation to integration</h2>
            </div>

            <div class="workflow-track">
              <article class="workflow-step" *ngFor="let step of workflowSteps; let i = index">
                <span class="workflow-icon" aria-hidden="true">
                  <mat-icon>{{ step.icon }}</mat-icon>
                </span>
                <span class="workflow-step-index" aria-hidden="true">Step {{ formatStep(i) }}</span>
                <div>
                  <h3>{{ step.title }}</h3>
                  <p>{{ step.description }}</p>
                </div>
              </article>
            </div>
          </section>
        </div>

        <aside id="account-access" class="auth-column" aria-label="Account access">
          <mat-card class="auth-card">
            <div class="card-header">
              <div>
                <p class="card-kicker">Secure access</p>
                <h2>Sign in</h2>
              </div>
              <span class="card-badge">
                <mat-icon aria-hidden="true">lock</mat-icon>
              </span>
            </div>

            <p class="muted">Use your approved platform account to continue.</p>

            <form [formGroup]="form" (ngSubmit)="submit()">
              <mat-form-field appearance="outline">
                <mat-label>Username</mat-label>
                <input matInput formControlName="userName" autocomplete="username" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Password</mat-label>
                <input matInput type="password" formControlName="password" autocomplete="current-password" />
              </mat-form-field>

              <p *ngIf="error" class="error">{{ error }}</p>

              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || submitting">
                <mat-icon aria-hidden="true">login</mat-icon>
                {{ submitting ? 'Signing in...' : 'Sign in' }}
              </button>
            </form>

            <div class="account-panel">
              <p>No account yet?</p>
              <a mat-stroked-button color="primary" routerLink="/register">
                <mat-icon aria-hidden="true">person_add</mat-icon>
                Create account
              </a>
            </div>
          </mat-card>
        </aside>
      </div>

      <nav class="mobile-access-bar" aria-label="Account access shortcuts">
        <a class="mobile-access-button mobile-access-button--primary" href="#account-access">
          <mat-icon aria-hidden="true">login</mat-icon>
          Sign in
        </a>
        <a class="mobile-access-button" routerLink="/register">
          <mat-icon aria-hidden="true">person_add</mat-icon>
          Create account
        </a>
      </nav>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      margin-top: 0;
      background:
        linear-gradient(180deg, rgba(248, 251, 255, 0.98), rgba(244, 248, 252, 0.94)),
        radial-gradient(circle at top left, rgba(18, 97, 166, 0.08), transparent 34%),
        repeating-linear-gradient(90deg, rgba(37, 99, 235, 0.05) 0 1px, transparent 1px 120px);
      color: #172033;
    }

    .landing-shell {
      min-height: 100vh;
      padding: 60px 32px 72px;
    }

    .landing-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
      gap: 48px;
      width: min(1280px, 100%);
      margin: 0 auto;
      align-items: start;
    }

    .business-column {
      display: grid;
      gap: 30px;
      min-width: 0;
    }

    .brand-line {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 50px;
      height: 50px;
      border-radius: 10px;
      background: linear-gradient(135deg, #195b9a, #1261a6);
      color: #fff;
      box-shadow: 0 10px 24px rgba(18, 97, 166, 0.22);
      flex: 0 0 auto;
    }

    .eyebrow,
    .section-heading p,
    .card-kicker {
      margin: 0;
      color: #1261a6;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .brand-subtitle {
      margin: 4px 0 0;
      color: #53657d;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0;
    }

    h1 {
      max-width: 780px;
      margin: 2px 0 0;
      color: #0e2038;
      font-size: 54px;
      font-weight: 700;
      line-height: 1.08;
      letter-spacing: 0;
    }

    .trust-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .trust-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 10px 14px;
      border: 1px solid #d6e2ef;
      background: rgba(255, 255, 255, 0.82);
      color: #31455f;
      font-size: 14px;
      font-weight: 600;
    }

    .hero-copy {
      max-width: 780px;
      margin: 4px 0 0;
      color: #44556c;
      font-size: 20px;
      line-height: 1.55;
    }

    .mission-panel {
      display: flex;
      gap: 18px;
      max-width: 860px;
      padding: 22px 24px;
      border: 1px solid #d6e2ef;
      border-left: 4px solid #1261a6;
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 250, 253, 0.98));
      box-shadow: 0 14px 38px rgba(15, 31, 53, 0.08);
    }

    .mission-icon,
    .value-icon,
    .workflow-icon,
    .card-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }

    .mission-icon {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      background: #eaf4ff;
      color: #1261a6;
    }

    .mission-panel h2,
    .section-heading h2,
    .auth-card h2 {
      margin: 0;
      color: #0f1f35;
      font-weight: 700;
      letter-spacing: 0;
    }

    .mission-panel h2 {
      font-size: 22px;
    }

    .mission-panel p {
      margin: 8px 0 0;
      color: #4f5f73;
      font-size: 16px;
      line-height: 1.6;
    }

    .value-section,
    .workflow-section {
      display: grid;
      gap: 18px;
    }

    .section-heading h2 {
      margin-top: 6px;
      font-size: 28px;
    }

    .value-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .value-card {
      min-height: 180px;
      padding: 22px;
      border: 1px solid #d9e3ee;
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 250, 253, 0.97));
      box-shadow: 0 12px 28px rgba(15, 31, 53, 0.06);
    }

    .value-icon {
      width: 42px;
      height: 42px;
      border-radius: 8px;
      background: #eff6ff;
      color: #1261a6;
    }

    .value-card h3,
    .workflow-step h3 {
      margin: 16px 0 8px;
      color: #132840;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0;
    }

    .value-card p,
    .workflow-step p {
      margin: 0;
      color: #526276;
      font-size: 15px;
      line-height: 1.55;
    }

    .workflow-track {
      display: grid;
      grid-template-columns: repeat(3, minmax(180px, 1fr));
      gap: 12px;
      padding-bottom: 6px;
    }

    .workflow-step {
      position: relative;
      min-width: 132px;
      min-height: 176px;
      padding: 18px;
      border: 1px solid #d9e3ee;
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 250, 253, 0.97));
    }

    .workflow-icon {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: #edf7f2;
      color: #28724f;
    }

    .workflow-step h3 {
      margin-top: 14px;
      font-size: 16px;
    }

    .workflow-step p {
      font-size: 13px;
    }

    .workflow-step-index {
      position: absolute;
      top: 16px;
      right: 16px;
      min-height: 24px;
      border-radius: 999px;
      border: 1px solid #dbe4f0;
      background: #f8fafc;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 2px 8px;
    }

    .auth-column {
      align-self: start;
      padding-top: 0;
    }

    .auth-card {
      position: relative;
      overflow: hidden;
      width: 100%;
      padding: 28px;
      border: 1px solid #d8e4f0;
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 251, 255, 0.98));
      box-shadow: 0 28px 70px rgba(15, 31, 53, 0.18), 0 4px 12px rgba(18, 97, 166, 0.08);
    }

    .auth-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 4px;
      background: linear-gradient(90deg, #1261a6, #28724f);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
    }

    .auth-card h2 {
      margin-top: 6px;
      font-size: 28px;
    }

    .card-badge {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      background: #edf7f2;
      color: #28724f;
    }

    form {
      display: grid;
      gap: 12px;
      margin-top: 18px;
    }

    button[mat-raised-button],
    a[mat-stroked-button] {
      min-height: 44px;
      border-radius: 6px;
      font-weight: 700;
      letter-spacing: 0;
    }

    button[mat-raised-button] mat-icon,
    a[mat-stroked-button] mat-icon {
      margin-right: 8px;
    }

    .muted {
      margin: 12px 0 0;
      color: #5d6d80;
      line-height: 1.5;
    }

    .error { color: #b91c1c; margin: 0; }

    .account-panel {
      display: grid;
      gap: 12px;
      margin-top: 22px;
      padding-top: 20px;
      border-top: 1px solid #e3eaf2;
    }

    .account-panel p {
      margin: 0;
      color: #5d6d80;
      font-size: 14px;
    }

    .mobile-access-bar {
      display: none;
    }

    @media (min-width: 1101px) {
      .landing-grid {
        grid-template-columns: minmax(0, 760px) 420px;
        gap: 76px;
      }

      .business-column {
        max-width: 760px;
      }

      .auth-column {
        position: fixed;
        top: 60px;
        right: max(32px, calc((100vw - 1280px) / 2 + 32px));
        width: 420px;
      }

      .workflow-track {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 1100px) {
      .landing-grid {
        grid-template-columns: minmax(0, 1fr);
      }

      .auth-column {
        position: static;
        max-width: 520px;
        padding-top: 0;
      }
    }

    @media (max-width: 760px) {
      :host {
        margin-top: 0;
      }

      .landing-shell {
        min-height: auto;
        padding: 28px 16px 112px;
      }

      .landing-grid,
      .business-column {
        gap: 28px;
      }

      .business-column {
        display: contents;
      }

      .brand-line { order: 1; }
      h1 { order: 2; }
      .hero-copy { order: 3; }
      .trust-row { order: 4; }
      .auth-column {
        order: 5;
        width: 100%;
        max-width: none;
        scroll-margin-top: 18px;
      }
      .mission-panel { order: 6; }
      .value-section { order: 7; }
      .workflow-section { order: 8; }

      .brand-line {
        align-items: flex-start;
      }

      h1 {
        font-size: 38px;
      }

      .hero-copy {
        font-size: 17px;
      }

      .mission-panel {
        padding: 18px;
      }

      .value-grid {
        grid-template-columns: 1fr;
      }

      .workflow-track {
        grid-template-columns: 1fr;
      }

      .workflow-step {
        min-height: auto;
      }

      .auth-card {
        position: relative;
        top: auto;
        padding: 22px;
      }

      .mobile-access-bar {
        position: fixed;
        right: 12px;
        bottom: 12px;
        left: 12px;
        z-index: 120;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        padding: 10px;
        border: 1px solid rgba(148, 163, 184, 0.45);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 18px 42px rgba(15, 31, 53, 0.2);
      }

      .mobile-access-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 44px;
        padding: 10px 12px;
        border: 1px solid #cbd8e6;
        border-radius: 6px;
        background: #ffffff;
        color: #1261a6;
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
        letter-spacing: 0;
      }

      .mobile-access-button--primary {
        border-color: #1261a6;
        background: #1261a6;
        color: #ffffff;
      }
    }
  `]
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(LocalAuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    userName: ['', Validators.required],
    password: ['', Validators.required]
  });

  submitting = false;
  error = '';

  readonly businessValues = [
    {
      icon: 'speed',
      title: 'Faster Updates',
      description: 'Detect structural issues immediately instead of waiting for manual reviews.'
    },
    {
      icon: 'rule',
      title: 'Better Data Quality',
      description: 'Automated validation improves consistency before integration.'
    },
    {
      icon: 'visibility',
      title: 'Full Transparency',
      description: 'Track every submission from upload to approval.'
    },
    {
      icon: 'groups',
      title: 'Shared Collaboration',
      description: 'Business users, approvers and administrators collaborate through one standardized workflow.'
    }
  ];

  readonly workflowSteps = [
    {
      icon: 'description',
      title: 'Prepare Data',
      description: 'Use a common structure before submitting site updates.'
    },
    {
      icon: 'upload_file',
      title: 'Upload',
      description: 'Submit the file through one secure portal.'
    },
    {
      icon: 'fact_check',
      title: 'Automatic Validation',
      description: 'Check formatting, required values and consistency rules.'
    },
    {
      icon: 'preview',
      title: 'Review',
      description: 'Inspect valid rows, warnings and blocking errors.'
    },
    {
      icon: 'approval',
      title: 'Approval',
      description: 'Route ready submissions to the responsible approvers.'
    },
    {
      icon: 'hub',
      title: 'Integration',
      description: 'Commit approved data into the CPQ update process.'
    }
  ];

  formatStep(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  submit(): void {
    if (this.form.invalid || this.submitting) return;

    this.submitting = true;
    this.error = '';

    const { userName, password } = this.form.getRawValue();
    this.auth.login(userName.trim(), password).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.error ?? 'Login failed. Please try again.';
      }
    });
  }
}
