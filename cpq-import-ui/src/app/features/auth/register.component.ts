import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LocalAuthService } from '../../core/auth/local-auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <section class="request-shell">
      <header class="request-header">
        <a class="brand" routerLink="/login">
          <span class="brand__mark"><mat-icon>cloud_upload</mat-icon></span>
          <span><strong>CPQ Platform</strong><small>Governed data operations</small></span>
        </a>
        <a class="back-link" routerLink="/login"><mat-icon>arrow_back</mat-icon> Back to business overview</a>
      </header>

      <main class="request-layout">
        <section class="request-story">
          <div class="story-kicker"><i></i> Governed onboarding</div>
          <h1>Access follows <span>responsibility.</span></h1>
          <p class="story-lead">
            Request access to the CPQ data workflow. An administrator will verify your account and assign capabilities based on your operational role.
          </p>

          <div class="control-note">
            <span><mat-icon>admin_panel_settings</mat-icon></span>
            <div>
              <strong>This is an access request, not automatic authorization.</strong>
              <p>Uploading, approving, publishing and administration are separate responsibilities. Each capability is assigned deliberately.</p>
            </div>
          </div>

          <div class="request-journey" aria-label="Account approval journey">
            <article *ngFor="let step of onboardingSteps; let i = index">
              <span class="request-journey__number">0{{ i + 1 }}</span>
              <span class="request-journey__icon"><mat-icon>{{ step.icon }}</mat-icon></span>
              <div><h2>{{ step.title }}</h2><p>{{ step.description }}</p></div>
            </article>
          </div>

          <div class="responsibility-strip">
            <span>Capabilities may include</span>
            <div><em><mat-icon>edit_note</mat-icon> Prepare</em><em><mat-icon>approval</mat-icon> Approve</em><em><mat-icon>rocket_launch</mat-icon> Publish</em><em><mat-icon>settings</mat-icon> Administer</em></div>
          </div>
        </section>

        <aside class="form-panel" aria-label="Request platform access">
          <div class="form-panel__status"><i></i> Controlled account creation</div>
          <span class="form-panel__icon"><mat-icon>person_add</mat-icon></span>
          <h2>Request platform access</h2>
          <p>Create your credentials. Your account will remain inactive until an administrator completes the review.</p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label>Full display name</mat-label>
              <input matInput formControlName="displayName" autocomplete="name" />
              <mat-hint>The name colleagues will see in approvals</mat-hint>
              <mat-error *ngIf="form.controls.displayName.hasError('required')">
                <mat-icon>info</mat-icon>
                Enter your display name
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Username</mat-label>
              <input matInput formControlName="userName" autocomplete="username" />
              <mat-error *ngIf="form.controls.userName.hasError('required')">
                <mat-icon>info</mat-icon>
                Enter a username
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="new-password" />
              <mat-hint>Use at least 8 characters</mat-hint>
              <mat-error *ngIf="form.controls.password.hasError('required')">
                <mat-icon>info</mat-icon>
                Enter a password
              </mat-error>
              <mat-error *ngIf="form.controls.password.hasError('minlength')">
                <mat-icon>info</mat-icon>
                Use at least 8 characters
              </mat-error>
            </mat-form-field>

            <p *ngIf="message" class="form-message form-message--success"><mat-icon>check_circle</mat-icon>{{ message }}</p>
            <p *ngIf="error" class="form-message form-message--error"><mat-icon>error</mat-icon>{{ error }}</p>

            <button mat-flat-button type="submit" [disabled]="form.invalid || submitting">
              {{ submitting ? 'Submitting request...' : 'Submit access request' }}
              <mat-icon>arrow_forward</mat-icon>
            </button>
          </form>

          <div class="form-panel__footer">
            <span><small>Already approved?</small><strong>Return to your workspace</strong></span>
            <a routerLink="/login">Sign in</a>
          </div>
        </aside>
      </main>

      <footer class="request-footer">
        <span><mat-icon>lock</mat-icon> Responsibilities remain separated by capability</span>
        <span>Saint-Marcellin · PDU pilot</span>
      </footer>
    </section>
  `,
  styles: [`
    :host { display: block; color: #14213b; font-family: "Aptos", "Trebuchet MS", sans-serif; }
    * { box-sizing: border-box; }
    .request-shell {
      min-height: 100vh;
      overflow: hidden;
      background:
        linear-gradient(115deg, rgba(247,246,241,.98), rgba(243,247,250,.96)),
        radial-gradient(circle at 10% 10%, rgba(15,159,150,.13), transparent 30%),
        #f7f6f1;
    }
    .request-header {
      min-height: 74px;
      width: min(1240px, calc(100% - 48px));
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(20,33,59,.12);
    }
    .brand { display: inline-flex; align-items: center; gap: 11px; color: #14213b; text-decoration: none; }
    .brand__mark { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 12px; color: #fff; background: #173b8f; box-shadow: 0 8px 20px rgba(23,59,143,.2); }
    .brand__mark mat-icon { width: 20px; height: 20px; font-size: 20px; }
    .brand > span:last-child { display: flex; flex-direction: column; }
    .brand strong { font-family: "Bahnschrift", "Trebuchet MS", sans-serif; font-size: 15px; }
    .brand small { color: #6e798c; font-size: 10px; }
    .back-link { display: inline-flex; align-items: center; gap: 8px; color: #173b8f; font-size: 11px; font-weight: 850; text-decoration: none; }
    .back-link mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .request-layout { min-height: calc(100vh - 148px); width: min(1240px, calc(100% - 48px)); margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(360px, 460px); gap: clamp(60px, 9vw, 130px); align-items: center; padding: 58px 0 70px; }
    .request-story { max-width: 720px; animation: reveal 520ms ease both; }
    .story-kicker { display: inline-flex; align-items: center; gap: 9px; color: #0b7a72; font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .story-kicker i { width: 22px; height: 2px; background: #0f9f96; }
    h1, h2 { font-family: "Bahnschrift", "Trebuchet MS", sans-serif; }
    h1 { max-width: 660px; margin: 22px 0 20px; color: #0b1731; font-size: clamp(50px, 5.4vw, 76px); line-height: .98; letter-spacing: -.045em; font-weight: 650; }
    h1 span { color: #2854c5; }
    .story-lead { max-width: 650px; margin: 0; color: #58657a; font-size: 18px; line-height: 1.58; }
    .control-note { display: grid; grid-template-columns: 44px 1fr; gap: 14px; margin-top: 30px; padding: 17px; border: 1px solid rgba(15,142,132,.22); border-radius: 16px; background: rgba(255,255,255,.65); }
    .control-note > span { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px; color: #08776f; background: #ddf4f0; }
    .control-note strong { color: #15304a; font-size: 13px; }
    .control-note p { margin: 4px 0 0; color: #68758a; font-size: 11px; line-height: 1.5; }
    .request-journey { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 34px; }
    .request-journey::before { content: ''; position: absolute; left: 8%; right: 8%; top: 28px; height: 1px; background: #c9d2df; }
    .request-journey article { position: relative; z-index: 1; padding-right: 20px; }
    .request-journey__number { position: absolute; top: 4px; right: 20px; color: #a0a9b7; font-size: 9px; font-weight: 900; }
    .request-journey__icon { width: 56px; height: 56px; display: grid; place-items: center; border: 7px solid #f7f6f1; border-radius: 50%; color: #173b8f; background: #e7edfb; }
    .request-journey h2 { margin: 14px 0 5px; color: #17253e; font-size: 14px; }
    .request-journey p { margin: 0; color: #6b7688; font-size: 10px; line-height: 1.45; }
    .responsibility-strip { margin-top: 28px; padding-top: 19px; border-top: 1px solid #d8dde5; }
    .responsibility-strip > span { color: #7a8596; font-size: 9px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .responsibility-strip > div { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .responsibility-strip em { display: inline-flex; align-items: center; gap: 6px; min-height: 29px; padding: 0 10px; border: 1px solid #d3d9e2; border-radius: 999px; color: #4e5d73; background: rgba(255,255,255,.55); font-size: 9px; font-weight: 800; font-style: normal; }
    .responsibility-strip mat-icon { width: 14px; height: 14px; font-size: 14px; color: #0f8e84; }
    .form-panel { position: relative; overflow: hidden; padding: 32px; border: 1px solid rgba(20,33,59,.14); border-radius: 24px; background: #fff; box-shadow: 0 30px 80px rgba(25,39,72,.17); animation: reveal 520ms 100ms ease both; }
    .form-panel::before { content: ''; position: absolute; inset: 0 0 auto; height: 5px; background: linear-gradient(90deg, #0f9f96, #3158c8); }
    .form-panel__status { display: inline-flex; align-items: center; gap: 8px; color: #0b7a72; font-size: 9px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .form-panel__status i { width: 7px; height: 7px; border-radius: 50%; background: #18b7a8; box-shadow: 0 0 0 5px rgba(24,183,168,.12); }
    .form-panel__icon { width: 48px; height: 48px; display: grid; place-items: center; margin-top: 23px; border-radius: 14px; color: #2854c5; background: #e8edfc; }
    .form-panel h2 { margin: 18px 0 9px; color: #0b1731; font-size: 30px; line-height: 1.05; }
    .form-panel > p { margin: 0; color: #657188; font-size: 13px; line-height: 1.55; }
    form { display: grid; gap: 8px; margin-top: 22px; }
    mat-form-field {
      width: 100%;
      --mdc-outlined-text-field-container-shape: 13px;
      --mdc-outlined-text-field-outline-color: #cbd4df;
      --mdc-outlined-text-field-hover-outline-color: #82aaa6;
      --mdc-outlined-text-field-focus-outline-color: #0f8e84;
      --mdc-outlined-text-field-focus-label-text-color: #0b7a72;
      --mdc-outlined-text-field-caret-color: #0f8e84;
      --mdc-outlined-text-field-input-text-color: #17253e;
      --mdc-outlined-text-field-input-text-placeholder-color: #7b8798;
      --mdc-outlined-text-field-error-outline-color: #9da9b8;
      --mdc-outlined-text-field-error-hover-outline-color: #748298;
      --mdc-outlined-text-field-error-focus-outline-color: #0f8e84;
      --mdc-outlined-text-field-error-label-text-color: #5f6d82;
      --mat-form-field-error-text-color: #5f6d82;
    }
    :host ::ng-deep .form-panel .mat-mdc-text-field-wrapper {
      background: #fcfdfd;
      transition: background-color 180ms ease;
    }
    :host ::ng-deep .form-panel mat-form-field:focus-within .mat-mdc-text-field-wrapper {
      background: #f8fcfb;
      box-shadow: none !important;
    }
    :host ::ng-deep .form-panel .mdc-notched-outline__leading,
    :host ::ng-deep .form-panel .mdc-notched-outline__notch,
    :host ::ng-deep .form-panel .mdc-notched-outline__trailing {
      transition: border-color 180ms ease, border-width 180ms ease;
    }
    :host ::ng-deep .form-panel input:focus {
      outline: none !important;
      outline-offset: 0 !important;
    }
    :host ::ng-deep .form-panel input:-webkit-autofill,
    :host ::ng-deep .form-panel input:-webkit-autofill:hover,
    :host ::ng-deep .form-panel input:-webkit-autofill:focus {
      -webkit-text-fill-color: #17253e;
      -webkit-box-shadow: 0 0 0 1000px #f8fcfb inset;
      outline: none !important;
      caret-color: #0f8e84;
      transition: background-color 9999s ease-out;
    }
    :host ::ng-deep .form-panel mat-error {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .01em;
    }
    :host ::ng-deep .form-panel mat-error mat-icon {
      width: 14px;
      height: 14px;
      color: #0f8e84;
      font-size: 14px;
    }
    form button { min-height: 48px; border-radius: 11px; color: #fff !important; background: #173b8f !important; font-weight: 850; }
    form button mat-icon { margin-left: 8px; }
    .form-message { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 4px; padding: 10px; border-radius: 9px; font-size: 11px; line-height: 1.4; }
    .form-message mat-icon { width: 17px; height: 17px; font-size: 17px; flex: 0 0 auto; }
    .form-message--success { color: #07685f; background: #e6f7f3; }
    .form-message--error { color: #a52d27; background: #fff0ef; }
    .form-panel__footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 20px; padding-top: 17px; border-top: 1px solid #e4e8ee; }
    .form-panel__footer > span { display: flex; flex-direction: column; gap: 2px; }
    .form-panel__footer small { color: #7b8697; font-size: 9px; }
    .form-panel__footer strong { color: #2d3a50; font-size: 11px; }
    .form-panel__footer a { min-height: 36px; display: inline-flex; align-items: center; padding: 0 13px; border: 1px solid #cad2df; border-radius: 9px; color: #173b8f; font-size: 10px; font-weight: 850; text-decoration: none; }
    .request-footer { min-height: 74px; width: min(1240px, calc(100% - 48px)); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(20,33,59,.12); color: #758094; font-size: 10px; }
    .request-footer span:first-child { display: inline-flex; align-items: center; gap: 7px; }
    .request-footer mat-icon { width: 15px; height: 15px; font-size: 15px; color: #0f8e84; }
    @keyframes reveal { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 960px) {
      .request-layout { grid-template-columns: 1fr; gap: 48px; }
      .form-panel { max-width: 560px; }
    }
    @media (max-width: 640px) {
      .request-header, .request-layout, .request-footer { width: calc(100% - 28px); }
      .request-header { min-height: 64px; }
      .brand small { display: none; }
      .back-link { font-size: 0; }
      .back-link mat-icon { width: 22px; height: 22px; font-size: 22px; }
      .request-layout { padding: 42px 0 48px; }
      h1 { font-size: clamp(45px, 13vw, 60px); }
      .story-lead { font-size: 16px; }
      .request-journey { grid-template-columns: 1fr; gap: 16px; }
      .request-journey::before { top: 15px; bottom: 15px; left: 27px; right: auto; width: 1px; height: auto; }
      .request-journey article { display: grid; grid-template-columns: 56px 1fr; gap: 13px; padding: 0; }
      .request-journey__number { display: none; }
      .request-journey h2 { margin-top: 7px; }
      .form-panel { padding: 25px 20px; border-radius: 20px; }
      .request-footer { align-items: flex-start; flex-direction: column; justify-content: center; gap: 6px; }
    }
    @media (prefers-reduced-motion: reduce) { .request-story, .form-panel { animation: none; } }
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

  readonly onboardingSteps = [
    { icon: 'person_add', title: 'Request account', description: 'Create your identity and credentials.' },
    { icon: 'manage_search', title: 'Administrative review', description: 'Your operational responsibility is verified.' },
    { icon: 'key', title: 'Capabilities assigned', description: 'Access is granted according to your role.' }
  ];

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
