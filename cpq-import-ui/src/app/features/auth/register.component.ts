import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
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
    MatButtonModule
  ],
  template: `
    <section class="auth-shell">
      <mat-card class="auth-card">
        <h2>Create Test Account</h2>
        <p class="muted">Your account will remain pending until an admin approves it.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Display name</mat-label>
            <input matInput formControlName="displayName" />
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
            {{ submitting ? 'Creating...' : 'Create account' }}
          </button>
        </form>

        <p class="hint">
          Already registered?
          <a routerLink="/login">Sign in</a>
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
    .success { color: #065f46; margin: 0; }
    .hint { margin-top: 12px; color: #475569; }
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
