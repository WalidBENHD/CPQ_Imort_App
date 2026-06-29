import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LocalAuthService } from '../../core/auth/local-auth.service';

@Component({
  selector: 'app-register',
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
    <section class="register-shell">
      <div class="register-grid">
        <div class="register-story">
          <a class="back-link" routerLink="/login">
            <mat-icon aria-hidden="true">arrow_back</mat-icon>
            Back to portal
          </a>

          <div class="brand-line">
            <span class="brand-mark" aria-hidden="true">
              <mat-icon>person_add</mat-icon>
            </span>
            <div>
              <p class="eyebrow">Account request</p>
              <p class="brand-subtitle">Data Quality &amp; Validation Portal</p>
            </div>
          </div>

          <h1>Create your platform access</h1>
          <p class="hero-copy">
            Request access to submit validated CPQ data, collaborate with approvers and follow each update through the governance workflow.
          </p>

          <div class="approval-panel" aria-label="Account approval process">
            <article>
              <span><mat-icon aria-hidden="true">assignment_ind</mat-icon></span>
              <h2>Submit request</h2>
              <p>Provide your display name and account credentials.</p>
            </article>
            <article>
              <span><mat-icon aria-hidden="true">admin_panel_settings</mat-icon></span>
              <h2>Admin review</h2>
              <p>An administrator validates your request before activation.</p>
            </article>
            <article>
              <span><mat-icon aria-hidden="true">verified_user</mat-icon></span>
              <h2>Approved access</h2>
              <p>Once approved, you can sign in and use the portal.</p>
            </article>
          </div>
        </div>

        <aside class="register-column" aria-label="Create account">
          <mat-card class="register-card">
            <div class="card-header">
              <div>
                <p class="card-kicker">Secure onboarding</p>
                <h2>Create account</h2>
              </div>
              <span class="card-badge">
                <mat-icon aria-hidden="true">lock_person</mat-icon>
              </span>
            </div>

            <p class="muted">Your account remains pending until an admin approves it.</p>

            <form [formGroup]="form" (ngSubmit)="submit()">
              <mat-form-field appearance="outline">
                <mat-label>Display name</mat-label>
                <input matInput formControlName="displayName" autocomplete="name" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Username</mat-label>
                <input matInput formControlName="userName" autocomplete="username" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Password</mat-label>
                <input matInput type="password" formControlName="password" autocomplete="new-password" />
              </mat-form-field>

              <p *ngIf="message" class="success">{{ message }}</p>
              <p *ngIf="error" class="error">{{ error }}</p>

              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || submitting">
                <mat-icon aria-hidden="true">person_add</mat-icon>
                {{ submitting ? 'Creating...' : 'Create account' }}
              </button>
            </form>

            <div class="account-panel">
              <p>Already registered?</p>
              <a mat-stroked-button color="primary" routerLink="/login">
                <mat-icon aria-hidden="true">login</mat-icon>
                Sign in
              </a>
            </div>
          </mat-card>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background:
        linear-gradient(180deg, rgba(248, 251, 255, 0.98), rgba(244, 248, 252, 0.94)),
        radial-gradient(circle at top left, rgba(18, 97, 166, 0.08), transparent 34%),
        repeating-linear-gradient(90deg, rgba(37, 99, 235, 0.05) 0 1px, transparent 1px 120px);
      color: #172033;
    }

    .register-shell {
      min-height: 100vh;
      padding: 60px 32px 72px;
    }

    .register-grid {
      display: grid;
      grid-template-columns: minmax(0, 680px) minmax(340px, 420px);
      gap: 76px;
      width: min(1180px, 100%);
      margin: 0 auto;
      align-items: start;
    }

    .register-story {
      display: grid;
      gap: 28px;
      min-width: 0;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      width: max-content;
      color: #1261a6;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
    }

    .brand-line {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-mark,
    .card-badge,
    .approval-panel span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }

    .brand-mark {
      width: 50px;
      height: 50px;
      border-radius: 10px;
      background: linear-gradient(135deg, #195b9a, #1261a6);
      color: #fff;
      box-shadow: 0 10px 24px rgba(18, 97, 166, 0.22);
    }

    .eyebrow,
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
    }

    h1 {
      max-width: 680px;
      margin: 0;
      color: #0e2038;
      font-size: 48px;
      font-weight: 700;
      line-height: 1.08;
    }

    .hero-copy {
      max-width: 660px;
      margin: 0;
      color: #44556c;
      font-size: 19px;
      line-height: 1.55;
    }

    .approval-panel {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .approval-panel article {
      min-height: 172px;
      padding: 18px;
      border: 1px solid #d9e3ee;
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(247,250,253,.97));
      box-shadow: 0 12px 28px rgba(15, 31, 53, 0.06);
    }

    .approval-panel span {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: #eff6ff;
      color: #1261a6;
    }

    .approval-panel h2 {
      margin: 16px 0 8px;
      color: #132840;
      font-size: 17px;
      font-weight: 700;
    }

    .approval-panel p {
      margin: 0;
      color: #526276;
      font-size: 14px;
      line-height: 1.5;
    }

    .register-card {
      position: relative;
      overflow: hidden;
      width: 100%;
      padding: 28px;
      border: 1px solid #d8e4f0;
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(255,255,255,.99), rgba(248,251,255,.98));
      box-shadow: 0 28px 70px rgba(15,31,53,.18), 0 4px 12px rgba(18,97,166,.08);
    }

    .register-card::before {
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

    .register-card h2 {
      margin: 6px 0 0;
      color: #0f1f35;
      font-size: 28px;
      font-weight: 700;
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
    .success { color: #065f46; margin: 0; }

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

    @media (max-width: 900px) {
      .register-grid {
        grid-template-columns: 1fr;
        gap: 32px;
      }

      .approval-panel {
        grid-template-columns: 1fr;
      }

      .register-card {
        max-width: 520px;
      }
    }

    @media (max-width: 620px) {
      .register-shell {
        padding: 28px 16px 48px;
      }

      .register-story {
        gap: 24px;
      }

      .brand-line {
        align-items: flex-start;
      }

      h1 {
        font-size: 36px;
      }

      .hero-copy {
        font-size: 17px;
      }

      .register-card {
        padding: 22px;
      }
    }
  `]
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(LocalAuthService);

  readonly form = this.fb.nonNullable.group({
    displayName: ['', Validators.required],
    userName: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  submitting = false;
  message = '';
  error = '';

  submit(): void {
    if (this.form.invalid || this.submitting) return;

    this.submitting = true;
    this.error = '';
    this.message = '';

    const { displayName, userName, password } = this.form.getRawValue();
    this.auth.register(userName.trim(), displayName.trim(), password).subscribe({
      next: (result) => {
        this.submitting = false;
        this.message = result.message;
        this.form.reset();
      },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.error ?? 'Registration failed. Please try again.';
      }
    });
  }
}
