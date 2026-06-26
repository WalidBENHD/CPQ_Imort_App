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
    <section class="auth-shell">
      <mat-card class="auth-card">
        <h2>Sign In</h2>
        <p class="muted">Test mode local login</p>

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
            {{ submitting ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>

        <p class="hint">
          No account yet?
          <a routerLink="/register">Create one</a>
        </p>
      </mat-card>
    </section>
  `,
  styles: [`
    .auth-shell { display: flex; justify-content: center; padding: 40px 16px; }
    .auth-card { width: 100%; max-width: 420px; padding: 24px; }
    form { display: grid; gap: 12px; margin-top: 8px; }
    .muted { color: #64748b; margin-top: -6px; }
    .error { color: #b91c1c; margin: 0; }
    .hint { margin-top: 12px; color: #475569; }
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
