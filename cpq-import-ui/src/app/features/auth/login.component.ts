import { AfterViewInit, Component, ElementRef, OnDestroy, inject } from '@angular/core';
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
      <header class="public-header">
        <a class="public-brand" href="#top" (click)="scrollToSection($event, 'top')" aria-label="CPQ Platform home">
          <span class="public-brand__mark"><mat-icon>cloud_upload</mat-icon></span>
          <span><strong>CPQ Platform</strong><small>Governed data operations</small></span>
        </a>

        <nav aria-label="Landing page navigation">
          <a href="#business-case" (click)="scrollToSection($event, 'business-case')">Why it matters</a>
          <a href="#operating-model" (click)="scrollToSection($event, 'operating-model')">How it works</a>
          <a href="#governance" (click)="scrollToSection($event, 'governance')">Governance</a>
          <a href="#creator-vision" (click)="scrollToSection($event, 'creator-vision')">The vision</a>
        </nav>

        <a class="header-access" href="#account-access" (click)="scrollToSection($event, 'account-access')">
          Sign in
          <mat-icon>arrow_forward</mat-icon>
        </a>
      </header>

      <main id="top">
        <section class="hero-section">
          <div class="hero-story">
            <div class="hero-kicker"><i></i> Governed CPQ data operations</div>
            <h1>Move CPQ updates from <span>spreadsheet risk</span> to controlled publication.</h1>
            <p class="hero-copy">
              One operating workspace to prepare, validate, approve and publish connected CPQ datasets with confidence.
            </p>

            <div class="hero-actions">
              <a class="primary-action" href="#account-access" (click)="scrollToSection($event, 'account-access')">
                Continue to workspace
                <mat-icon>arrow_forward</mat-icon>
              </a>
              <a class="secondary-action" routerLink="/register">Request access</a>
            </div>

            <div class="pilot-card">
              <span class="pilot-card__icon"><mat-icon>flag</mat-icon></span>
              <span>
                <small>Current pilot scope</small>
                <strong>Saint-Marcellin · PDU</strong>
                <em>Annual Article Master and Basis Price publication</em>
              </span>
              <span class="pilot-card__status"><i></i> Active pilot</span>
            </div>
          </div>

          <aside id="account-access" class="access-panel" aria-label="Account access">
            <div class="access-panel__topline">
              <span><mat-icon>verified_user</mat-icon></span>
              Controlled access
            </div>
            <h2>Continue to your workspace</h2>
            <p>Prepare, review or publish CPQ datasets according to your assigned responsibilities.</p>

            <form [formGroup]="form" (ngSubmit)="submit()">
              <mat-form-field appearance="outline">
                <mat-label>Username</mat-label>
                <input matInput formControlName="userName" autocomplete="username" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Password</mat-label>
                <input matInput type="password" formControlName="password" autocomplete="current-password" />
              </mat-form-field>

              <p *ngIf="error" class="form-message form-message--error">{{ error }}</p>

              <button mat-flat-button type="submit" [disabled]="form.invalid || submitting">
                {{ submitting ? 'Signing in...' : 'Sign in' }}
                <mat-icon>login</mat-icon>
              </button>
            </form>

            <div class="access-panel__footer">
              <span><small>New to the platform?</small><strong>Request governed access</strong></span>
              <a routerLink="/register" aria-label="Create an account"><mat-icon>person_add</mat-icon></a>
            </div>
          </aside>
        </section>

        <section class="release-model reveal-section" aria-labelledby="release-model-title">
          <div class="release-model__heading">
            <span>One connected operating model</span>
            <h2 id="release-model-title">From private preparation to published evidence</h2>
          </div>

          <div class="release-track">
            <article *ngFor="let step of operatingSteps; let i = index">
              <span class="release-track__index">0{{ i + 1 }}</span>
              <span class="release-track__icon"><mat-icon>{{ step.icon }}</mat-icon></span>
              <div><strong>{{ step.title }}</strong><small>{{ step.description }}</small></div>
              <mat-icon class="release-track__arrow" *ngIf="i < operatingSteps.length - 1">east</mat-icon>
            </article>
          </div>
        </section>

        <section id="business-case" class="business-case reveal-section">
          <div class="section-intro">
            <span>Business case</span>
            <h2>Replace operational uncertainty with a governed way of working.</h2>
            <p>The platform is not another place to store files. It closes the control gaps between preparation, approval and CPQ publication.</p>
          </div>

          <div class="comparison-board">
            <div class="comparison-board__headings">
              <div class="comparison-board__header comparison-board__header--today">
                <mat-icon>warning_amber</mat-icon>
                <span><small>Today's challenge</small><strong>Fragmented spreadsheet coordination</strong></span>
              </div>
              <div class="comparison-board__header comparison-board__header--future">
                <mat-icon>task_alt</mat-icon>
                <span><small>With CPQ Platform</small><strong>One controlled publication path</strong></span>
              </div>
            </div>

            <div class="comparison-row" *ngFor="let item of problemSolutions">
              <div class="comparison-cell comparison-cell--problem">{{ item.problem }}</div>
              <div class="comparison-cell comparison-cell--solution"><mat-icon>arrow_forward</mat-icon>{{ item.solution }}</div>
            </div>
          </div>
        </section>

        <section class="outcome-section reveal-section">
          <div class="section-intro section-intro--compact">
            <span>Operational value</span>
            <h2>Control that helps people move faster.</h2>
          </div>
          <div class="outcome-grid">
            <article *ngFor="let outcome of businessOutcomes">
              <span class="outcome-icon"><mat-icon>{{ outcome.icon }}</mat-icon></span>
              <h3>{{ outcome.title }}</h3>
              <p>{{ outcome.description }}</p>
            </article>
          </div>
        </section>

        <section id="operating-model" class="audience-section reveal-section">
          <div class="audience-card audience-card--users">
            <span class="audience-card__label"><mat-icon>edit_note</mat-icon> For operational users</span>
            <h2>Freedom to prepare. Confidence when submitting.</h2>
            <p>Work privately, compare alternatives and correct data directly. The shared workflow starts only when the contributor decides the work is ready.</p>
            <ul>
              <li><mat-icon>check</mat-icon> Private drafts and working copies</li>
              <li><mat-icon>check</mat-icon> In-platform row correction and recovery</li>
              <li><mat-icon>check</mat-icon> Dependency checks before review</li>
            </ul>
          </div>

          <div class="audience-card audience-card--leaders">
            <span class="audience-card__label"><mat-icon>policy</mat-icon> For managers and approvers</span>
            <h2>Understand the decision before accepting the risk.</h2>
            <p>See additions, modifications, removals and connected-dataset impact before approval, then retain the exact decision as governed evidence.</p>
            <ul>
              <li><mat-icon>check</mat-icon> Explicit approval and publication gates</li>
              <li><mat-icon>check</mat-icon> Coordinated releases for connected data</li>
              <li><mat-icon>check</mat-icon> Permanent decision history</li>
            </ul>
          </div>
        </section>

        <section id="governance" class="governance-section reveal-section">
          <div class="governance-copy">
            <span>Governance by design</span>
            <h2>Control without slowing people down.</h2>
            <p>Responsibilities are separated through configurable capabilities. Contributors prepare, approvers decide, publishers release, and administrators retain oversight.</p>
          </div>

          <div class="governance-proof">
            <article><mat-icon>lock_person</mat-icon><span><strong>Private by default</strong><small>Work remains personal until deliberately submitted.</small></span></article>
            <article><mat-icon>account_tree</mat-icon><span><strong>Connected by design</strong><small>Master data and dependent datasets move together when required.</small></span></article>
            <article><mat-icon>history_edu</mat-icon><span><strong>Traceable by evidence</strong><small>Every formal decision and publication remains explainable.</small></span></article>
          </div>
        </section>

        <section id="creator-vision" class="builder-section reveal-section" aria-labelledby="builder-title">
          <div class="builder-section__glow"></div>

          <figure class="builder-portrait">
            <img src="assets/walid-benhamed.png" alt="Portrait of Walid Benhamed" loading="lazy">
            <figcaption>
              <span class="builder-monogram">WB</span>
              <span><strong>Walid Benhamed</strong><small>CPQ Specialist &middot; Legrand</small></span>
            </figcaption>
          </figure>

          <div class="builder-story">
            <span class="builder-kicker">The conviction behind the platform</span>
            <h2 id="builder-title">Clean data is where every transformation begins.</h2>
            <p class="builder-lead">
              I did not build this platform because governance needed another dashboard. I built it because every faster
              quote, safer automation and better customer decision begins long before the screen, with data people can trust.
            </p>
            <blockquote>
              <span>&ldquo;</span>
              <p>When data is governed with clarity, improvement stops being a promise and becomes a repeatable capability.</p>
            </blockquote>
            <p>
              My experience as a CPQ specialist at Legrand made one truth impossible to ignore: the quality of a commercial
              process is inseparable from the quality of the data beneath it. An article without a price, a change without
              context, or a publication without ownership is never just a data issue. It becomes a business issue.
            </p>
            <p>
              This pilot is my answer to that reality: governance that enables people instead of slowing them down, evidence
              instead of assumptions, and one trusted path from preparation to publication.
            </p>

            <div class="builder-footer">
              <div><small>Personal product vision</small><strong>Built from real CPQ experience.</strong></div>
              <a href="https://www.linkedin.com/in/walid-benhamed-26214914b/" target="_blank" rel="noopener noreferrer">
                Connect on LinkedIn <mat-icon>north_east</mat-icon>
              </a>
            </div>
          </div>
        </section>

        <section class="closing-section reveal-section">
          <span class="closing-section__mark"><mat-icon>cloud_done</mat-icon></span>
          <div><small>Saint-Marcellin · PDU pilot</small><h2>A safer annual update is the first step toward a repeatable CPQ operating model.</h2></div>
          <a href="#account-access" (click)="scrollToSection($event, 'account-access')">Enter platform <mat-icon>arrow_upward</mat-icon></a>
        </section>
      </main>

      <footer class="public-footer">
        <span>CPQ Platform</span>
        <span>Governed data operations for reliable CPQ publication.</span>
        <span>Designed & built by Walid Benhamed</span>
      </footer>

      <nav class="mobile-access-bar" aria-label="Account access shortcuts">
        <a href="#account-access" (click)="scrollToSection($event, 'account-access')"><mat-icon>login</mat-icon> Sign in</a>
        <a routerLink="/register">Request access</a>
      </nav>
    </section>
  `,
  styles: [`
    :host { display: block; color: #14213b; font-family: "Aptos", "Trebuchet MS", sans-serif; }
    * { box-sizing: border-box; }
    .landing-shell {
      position: relative;
      isolation: isolate;
      min-height: 100vh;
      overflow: hidden;
      background:
        radial-gradient(circle at 8% 5%, rgba(30, 117, 111, .11), transparent 25%),
        radial-gradient(circle at 92% 10%, rgba(47, 85, 200, .12), transparent 28%),
        #f7f6f1;
    }
    .landing-shell::before,
    .landing-shell::after {
      content: '';
      position: absolute;
      z-index: -1;
      border-radius: 50%;
      pointer-events: none;
    }
    .landing-shell::before {
      top: 130px;
      right: -150px;
      width: 430px;
      height: 430px;
      border: 1px solid rgba(40, 84, 197, .12);
      box-shadow: inset 0 0 90px rgba(40, 84, 197, .04);
      animation: ambient-drift 16s ease-in-out infinite alternate;
    }
    .landing-shell::after {
      top: 760px;
      left: -230px;
      width: 520px;
      height: 520px;
      border: 1px solid rgba(15, 159, 150, .12);
      box-shadow: inset 0 0 100px rgba(15, 159, 150, .045);
      animation: ambient-drift 20s 2s ease-in-out infinite alternate-reverse;
    }
    .public-header {
      position: relative;
      z-index: 5;
      min-height: 74px;
      width: min(1420px, calc(100% - 48px));
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      border-bottom: 1px solid rgba(20, 33, 59, .12);
      animation: header-arrive 520ms cubic-bezier(.22, 1, .36, 1) both;
    }
    .public-brand { display: inline-flex; align-items: center; gap: 11px; color: #12213b; text-decoration: none; width: max-content; }
    .public-brand__mark { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 12px; background: #173b8f; color: #fff; box-shadow: 0 8px 20px rgba(23, 59, 143, .2); transition: transform 220ms ease, box-shadow 220ms ease; }
    .public-brand:hover .public-brand__mark { transform: translateY(-2px) rotate(-3deg); box-shadow: 0 12px 25px rgba(23, 59, 143, .28); }
    .public-brand__mark mat-icon { width: 20px; height: 20px; font-size: 20px; }
    .public-brand > span:last-child { display: flex; flex-direction: column; }
    .public-brand strong { font-family: "Bahnschrift", "Trebuchet MS", sans-serif; font-size: 15px; }
    .public-brand small { margin-top: 1px; color: #68758a; font-size: 10px; }
    .public-header nav { display: flex; gap: 30px; }
    .public-header nav a { position: relative; color: #526078; font-size: 12px; font-weight: 700; text-decoration: none; }
    .public-header nav a::after { content: ''; position: absolute; left: 0; right: 100%; bottom: -8px; height: 2px; background: #0f8e84; transition: right 160ms ease; }
    .public-header nav a:hover::after { right: 0; }
    .header-access { justify-self: end; display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 14px; border: 1px solid #c9d1df; border-radius: 999px; color: #173b8f; font-size: 12px; font-weight: 800; text-decoration: none; background: rgba(255,255,255,.52); transition: transform 180ms ease, border-color 180ms ease, background-color 180ms ease; }
    .header-access:hover { transform: translateY(-1px); border-color: #91a3c5; background: rgba(255,255,255,.82); }
    .header-access mat-icon { width: 16px; height: 16px; font-size: 16px; transition: transform 180ms ease; }
    .header-access:hover mat-icon { transform: translateX(3px); }
    main { width: min(1420px, calc(100% - 48px)); margin: 0 auto; }
    .hero-section { min-height: 690px; display: grid; grid-template-columns: minmax(0, 1.18fr) minmax(340px, 430px); gap: clamp(48px, 8vw, 120px); align-items: center; padding: 72px 0 76px; }
    .hero-story { max-width: 820px; }
    .hero-kicker { animation: hero-arrive 620ms 80ms cubic-bezier(.22, 1, .36, 1) both; }
    .hero-story h1 { animation: hero-arrive 720ms 160ms cubic-bezier(.22, 1, .36, 1) both; }
    .hero-copy { animation: hero-arrive 720ms 260ms cubic-bezier(.22, 1, .36, 1) both; }
    .hero-actions { animation: hero-arrive 720ms 350ms cubic-bezier(.22, 1, .36, 1) both; }
    .pilot-card { animation: hero-arrive 720ms 440ms cubic-bezier(.22, 1, .36, 1) both; }
    .hero-kicker, .section-intro > span, .release-model__heading > span, .governance-copy > span { display: inline-flex; align-items: center; gap: 9px; color: #0b7a72; font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .hero-kicker i { width: 22px; height: 2px; background: #0f9f96; }
    h1, h2, h3 { font-family: "Bahnschrift", "Trebuchet MS", sans-serif; }
    h1 { max-width: 790px; margin: 22px 0 22px; color: #0b1731; font-size: clamp(48px, 5.4vw, 78px); line-height: .99; letter-spacing: -.045em; font-weight: 650; }
    h1 span { color: #2854c5; }
    .hero-copy { max-width: 700px; margin: 0; color: #526078; font-size: clamp(18px, 1.7vw, 23px); line-height: 1.5; }
    .hero-actions { display: flex; align-items: center; gap: 14px; margin-top: 32px; }
    .primary-action, .secondary-action { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 0 20px; border-radius: 12px; font-size: 13px; font-weight: 850; text-decoration: none; transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background-color 180ms ease; }
    .primary-action { background: #173b8f; color: #fff; box-shadow: 0 14px 30px rgba(23, 59, 143, .22); }
    .primary-action:hover { transform: translateY(-3px); box-shadow: 0 20px 38px rgba(23, 59, 143, .3); }
    .primary-action mat-icon { width: 18px; height: 18px; font-size: 18px; transition: transform 180ms ease; }
    .primary-action:hover mat-icon { transform: translateX(4px); }
    .secondary-action { border: 1px solid #cad2df; color: #173b8f; background: rgba(255,255,255,.54); }
    .secondary-action:hover { transform: translateY(-2px); border-color: #91a3c5; background: rgba(255,255,255,.86); }
    .pilot-card { max-width: 690px; display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 13px; align-items: center; margin-top: 38px; padding: 14px 16px; border: 1px solid rgba(15, 142, 132, .22); border-radius: 16px; background: rgba(255,255,255,.64); box-shadow: 0 10px 34px rgba(20,33,59,.06); }
    .pilot-card__icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; color: #08776f; background: #ddf4f0; }
    .pilot-card > span:nth-child(2) { display: flex; flex-direction: column; gap: 2px; }
    .pilot-card small { color: #778398; font-size: 9px; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    .pilot-card strong { color: #14213b; font-size: 14px; }
    .pilot-card em { color: #647087; font-size: 11px; font-style: normal; }
    .pilot-card__status { display: inline-flex; align-items: center; gap: 7px; color: #08776f; font-size: 10px; font-weight: 800; }
    .pilot-card__status i { width: 7px; height: 7px; border-radius: 50%; background: #18b7a8; box-shadow: 0 0 0 5px rgba(24,183,168,.12); animation: status-breathe 2.8s ease-in-out infinite; }
    .access-panel { position: relative; overflow: hidden; padding: 32px; border: 1px solid rgba(20,33,59,.14); border-radius: 24px; background: #fff; box-shadow: 0 30px 80px rgba(25,39,72,.17); animation: panel-arrive 760ms 240ms cubic-bezier(.22, 1, .36, 1) both; transition: transform 260ms ease, box-shadow 260ms ease; }
    .access-panel:hover { transform: translateY(-4px); box-shadow: 0 38px 90px rgba(25,39,72,.2); }
    .access-panel::before { content: ''; position: absolute; inset: 0 0 auto; height: 5px; background: linear-gradient(90deg, #0f9f96, #3158c8); }
    .access-panel__topline { display: inline-flex; align-items: center; gap: 9px; color: #0b7a72; font-size: 10px; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
    .access-panel__topline > span { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; background: #e3f6f3; }
    .access-panel__topline mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .access-panel h2 { margin: 22px 0 10px; color: #0b1731; font-size: 31px; line-height: 1.05; }
    .access-panel > p { margin: 0; color: #657188; font-size: 14px; line-height: 1.55; }
    form { display: grid; gap: 10px; margin-top: 24px; }
    mat-form-field { width: 100%; }
    form button { min-height: 48px; border-radius: 11px; background: #173b8f !important; color: #fff !important; font-weight: 850; }
    form button mat-icon { margin-left: 8px; }
    .form-message { margin: -2px 0 4px; font-size: 12px; }
    .form-message--error { color: #b42318; }
    .access-panel__footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 20px; padding-top: 18px; border-top: 1px solid #e5e8ef; }
    .access-panel__footer > span { display: flex; flex-direction: column; gap: 2px; }
    .access-panel__footer small { color: #7c8799; font-size: 10px; }
    .access-panel__footer strong { color: #263550; font-size: 12px; }
    .access-panel__footer a { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid #ccd4e0; border-radius: 11px; color: #2854c5; text-decoration: none; }
    .release-model { margin-bottom: 118px; padding: 30px; border-radius: 26px; color: #fff; background: linear-gradient(120deg, #0c1935, #142650 72%, #123f59); box-shadow: 0 30px 70px rgba(11,23,49,.2); }
    .release-model__heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; padding: 0 4px 24px; }
    .release-model__heading > span { color: #68ded2; }
    .release-model__heading h2 { max-width: 590px; margin: 0; font-size: 25px; text-align: right; }
    .release-track { position: relative; overflow: hidden; display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid rgba(255,255,255,.11); border-radius: 18px; background: rgba(255,255,255,.045); }
    .release-track::after { content: ''; position: absolute; inset: auto auto 0 0; width: 0; height: 2px; background: linear-gradient(90deg, #30c8bc, #6be6da, transparent); box-shadow: 0 0 16px rgba(107,230,218,.55); transition: width 1.25s 320ms cubic-bezier(.22,1,.36,1); }
    .release-model.is-visible .release-track::after { width: 100%; }
    .release-track article { position: relative; min-height: 140px; display: grid; grid-template-columns: 42px 1fr; align-content: center; gap: 11px; padding: 24px; border-right: 1px solid rgba(255,255,255,.1); opacity: 0; transform: translateY(16px); transition: opacity 500ms ease, transform 500ms cubic-bezier(.22,1,.36,1), background-color 180ms ease; }
    .release-track article:hover { background: rgba(255,255,255,.04); }
    .release-model.is-visible .release-track article { opacity: 1; transform: none; }
    .release-model.is-visible .release-track article:nth-child(2) { transition-delay: 90ms; }
    .release-model.is-visible .release-track article:nth-child(3) { transition-delay: 180ms; }
    .release-model.is-visible .release-track article:nth-child(4) { transition-delay: 270ms; }
    .release-track article:last-child { border-right: 0; }
    .release-track__index { position: absolute; top: 13px; right: 15px; color: rgba(255,255,255,.28); font-size: 10px; font-weight: 900; }
    .release-track__icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; color: #75e5d9; background: rgba(20,184,166,.13); }
    .release-track article div { display: flex; flex-direction: column; gap: 5px; }
    .release-track strong { font-size: 13px; }
    .release-track small { color: #aab6cc; font-size: 10px; line-height: 1.4; }
    .release-track__arrow { position: absolute; right: -12px; top: calc(50% - 12px); z-index: 2; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; color: #75e5d9; background: #142650; font-size: 17px; }
    .business-case { padding: 0 0 118px; }
    .section-intro { max-width: 820px; margin-bottom: 38px; }
    .section-intro h2 { margin: 14px 0 14px; color: #0b1731; font-size: clamp(34px, 4vw, 54px); line-height: 1.07; letter-spacing: -.025em; }
    .section-intro p { max-width: 720px; margin: 0; color: #647087; font-size: 16px; line-height: 1.6; }
    .comparison-board { overflow: hidden; border: 1px solid #d8dde6; border-radius: 22px; background: #fff; box-shadow: 0 18px 55px rgba(20,33,59,.08); }
    .comparison-board__headings, .comparison-row { display: grid; grid-template-columns: 1fr 1fr; }
    .comparison-row { opacity: 0; transform: translateY(12px); transition: opacity 440ms ease, transform 440ms cubic-bezier(.22,1,.36,1); }
    .business-case.is-visible .comparison-row { opacity: 1; transform: none; }
    .business-case.is-visible .comparison-row:nth-child(3) { transition-delay: 70ms; }
    .business-case.is-visible .comparison-row:nth-child(4) { transition-delay: 140ms; }
    .business-case.is-visible .comparison-row:nth-child(5) { transition-delay: 210ms; }
    .business-case.is-visible .comparison-row:nth-child(6) { transition-delay: 280ms; }
    .comparison-board__header { display: flex; align-items: center; gap: 13px; padding: 24px 28px; }
    .comparison-board__header--today { color: #94421e; background: #fff3ea; }
    .comparison-board__header--future { color: #08776f; background: #eaf8f5; }
    .comparison-board__header mat-icon { width: 30px; height: 30px; font-size: 30px; }
    .comparison-board__header span { display: flex; flex-direction: column; gap: 3px; }
    .comparison-board__header small { font-size: 9px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .comparison-board__header strong { color: #14213b; font-size: 15px; }
    .comparison-cell { min-height: 70px; display: flex; align-items: center; padding: 16px 28px; border-top: 1px solid #e5e8ee; color: #546176; font-size: 13px; line-height: 1.45; }
    .comparison-cell--problem { background: #fffdfa; }
    .comparison-cell--solution { gap: 12px; color: #22334e; background: #fbfffe; border-left: 1px solid #e5e8ee; font-weight: 700; }
    .comparison-cell--solution mat-icon { color: #0f9f96; flex: 0 0 auto; }
    .outcome-section { padding-bottom: 118px; }
    .section-intro--compact { max-width: 680px; }
    .outcome-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .outcome-grid article { min-height: 230px; padding: 24px; border: 1px solid #dce1e9; border-radius: 18px; background: rgba(255,255,255,.7); opacity: 0; transform: translateY(22px); transition: opacity 480ms ease, transform 480ms cubic-bezier(.22,1,.36,1), box-shadow 180ms ease; }
    .outcome-section.is-visible .outcome-grid article { opacity: 1; transform: none; }
    .outcome-section.is-visible .outcome-grid article:nth-child(2) { transition-delay: 80ms; }
    .outcome-section.is-visible .outcome-grid article:nth-child(3) { transition-delay: 160ms; }
    .outcome-section.is-visible .outcome-grid article:nth-child(4) { transition-delay: 240ms; }
    .outcome-section.is-visible .outcome-grid article:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(20,33,59,.1); }
    .outcome-icon { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 13px; color: #2854c5; background: #e9efff; }
    .outcome-grid h3 { margin: 30px 0 10px; color: #14213b; font-size: 19px; }
    .outcome-grid p { margin: 0; color: #657188; font-size: 13px; line-height: 1.58; }
    .audience-section { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; padding-bottom: 118px; }
    .audience-card { min-height: 390px; padding: 36px; border-radius: 24px; transition: transform 240ms ease, box-shadow 240ms ease; }
    .audience-card:hover { transform: translateY(-5px); }
    .audience-card--users { color: #102547; background: linear-gradient(145deg, #e8f7f4, #f4fbfa); border: 1px solid #cce8e4; }
    .audience-card--leaders { color: #fff; background: linear-gradient(145deg, #173b8f, #24346d); box-shadow: 0 25px 60px rgba(23,59,143,.2); }
    .audience-card__label { display: inline-flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
    .audience-card__label mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .audience-card h2 { max-width: 540px; margin: 34px 0 14px; font-size: 31px; line-height: 1.1; }
    .audience-card p { margin: 0; font-size: 14px; line-height: 1.6; opacity: .8; }
    .audience-card ul { display: grid; gap: 12px; margin: 28px 0 0; padding: 0; list-style: none; }
    .audience-card li { display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 700; }
    .audience-card li mat-icon { width: 18px; height: 18px; font-size: 18px; color: #11a497; }
    .audience-card--leaders li mat-icon { color: #6de2d6; }
    .governance-section { display: grid; grid-template-columns: .85fr 1.15fr; gap: 90px; align-items: center; padding: 76px; margin-bottom: 88px; border-radius: 28px; background: #ece9df; }
    .governance-copy h2 { margin: 16px 0; color: #0b1731; font-size: 43px; line-height: 1.06; }
    .governance-copy p { margin: 0; color: #5f6b7e; font-size: 15px; line-height: 1.65; }
    .governance-proof { display: grid; gap: 12px; }
    .governance-proof article { display: grid; grid-template-columns: 44px 1fr; gap: 14px; align-items: center; padding: 17px; border: 1px solid rgba(20,33,59,.1); border-radius: 15px; background: rgba(255,255,255,.65); opacity: 0; transform: translateX(18px); transition: opacity 440ms ease, transform 440ms cubic-bezier(.22,1,.36,1), background-color 180ms ease; }
    .governance-section.is-visible .governance-proof article { opacity: 1; transform: none; }
    .governance-section.is-visible .governance-proof article:nth-child(2) { transition-delay: 100ms; }
    .governance-section.is-visible .governance-proof article:nth-child(3) { transition-delay: 200ms; }
    .governance-proof article:hover { background: rgba(255,255,255,.88); }
    .governance-proof article > mat-icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px; color: #173b8f; background: #e2e8f7; font-size: 22px; }
    .governance-proof article span { display: flex; flex-direction: column; gap: 3px; }
    .governance-proof strong { color: #17253e; font-size: 13px; }
    .governance-proof small { color: #6c7788; font-size: 11px; line-height: 1.4; }
    .builder-section { position: relative; isolation: isolate; overflow: hidden; display: grid; grid-template-columns: minmax(340px, .72fr) minmax(0, 1.28fr); gap: clamp(44px, 7vw, 110px); align-items: stretch; min-height: 680px; margin-bottom: 88px; padding: 24px; border: 1px solid rgba(94, 234, 212, .2); border-radius: 30px; color: #f8fafc; background: linear-gradient(125deg, #07111f 0%, #101d32 52%, #081316 100%); box-shadow: 0 30px 80px rgba(2, 6, 23, .24); }
    .builder-section::before { content: ''; position: absolute; inset: 0; z-index: -1; opacity: .18; background-image: linear-gradient(rgba(148,163,184,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.15) 1px, transparent 1px); background-size: 48px 48px; mask-image: linear-gradient(90deg, transparent, #000 45%, transparent); }
    .builder-section__glow { position: absolute; z-index: -1; right: 5%; bottom: -300px; width: 560px; height: 560px; border-radius: 50%; background: radial-gradient(circle, rgba(37,99,235,.28), transparent 68%); }
    .builder-portrait { position: relative; overflow: hidden; min-height: 620px; margin: 0; border: 1px solid rgba(255,255,255,.14); border-radius: 22px; background: #111; }
    .builder-portrait::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 52%, rgba(2,6,23,.72)); }
    .builder-portrait img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: center 28%; filter: saturate(.92) contrast(1.03); transition: transform 900ms cubic-bezier(.22,1,.36,1); }
    .builder-section.is-visible .builder-portrait img { transform: scale(1.025); }
    .builder-portrait figcaption { position: absolute; z-index: 1; right: 20px; bottom: 20px; left: 20px; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 12px; padding: 14px; border: 1px solid rgba(255,255,255,.18); border-radius: 15px; background: rgba(8,17,31,.75); backdrop-filter: blur(16px); }
    .builder-portrait figcaption > span:last-child { display: grid; gap: 2px; }
    .builder-portrait figcaption strong { font-size: 13px; }
    .builder-portrait figcaption small { color: #94a3b8; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .builder-monogram { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; color: #042f2e; background: #5eead4; font-size: 12px; font-weight: 950; }
    .builder-story { align-self: center; max-width: 790px; padding: 54px 54px 54px 0; }
    .builder-kicker { color: #5eead4; font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .builder-story h2 { max-width: 780px; margin: 20px 0 24px; color: #fff; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(43px, 4.4vw, 67px); font-weight: 500; letter-spacing: -.045em; line-height: 1; }
    .builder-story > p { max-width: 740px; margin: 0; color: #aebbd0; font-size: 14px; line-height: 1.75; }
    .builder-story > p + p { margin-top: 14px; }
    .builder-story .builder-lead { color: #d7e0ec; font-size: 17px; }
    .builder-story blockquote { display: grid; grid-template-columns: auto 1fr; gap: 13px; max-width: 700px; margin: 28px 0; padding: 18px 20px; border-left: 3px solid #2dd4bf; border-radius: 0 14px 14px 0; background: rgba(15,118,110,.13); }
    .builder-story blockquote > span { color: #5eead4; font-family: Georgia, serif; font-size: 42px; line-height: .8; }
    .builder-story blockquote p { margin: 0; color: #f1f5f9; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-style: italic; line-height: 1.55; }
    .builder-footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 32px; padding-top: 22px; border-top: 1px solid rgba(148,163,184,.2); }
    .builder-footer > div { display: grid; gap: 3px; }
    .builder-footer small { color: #5eead4; font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .builder-footer strong { color: #f8fafc; font-size: 12px; }
    .builder-footer a { min-height: 42px; display: inline-flex; align-items: center; gap: 8px; padding: 0 15px; border: 1px solid rgba(226,232,240,.28); border-radius: 11px; color: #e2e8f0; font-size: 11px; font-weight: 850; text-decoration: none; transition: border-color 180ms ease, background-color 180ms ease, transform 180ms ease; }
    .builder-footer a:hover { transform: translateY(-2px); border-color: #5eead4; background: rgba(45,212,191,.08); }
    .builder-footer mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .closing-section { display: grid; grid-template-columns: 58px minmax(0, 1fr) auto; gap: 20px; align-items: center; margin-bottom: 80px; padding: 32px; border-top: 1px solid #cdd3dd; border-bottom: 1px solid #cdd3dd; }
    .closing-section__mark { width: 58px; height: 58px; display: grid; place-items: center; border-radius: 17px; color: #fff; background: #0f8e84; }
    .closing-section small { color: #0b7a72; font-size: 9px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .closing-section h2 { max-width: 820px; margin: 5px 0 0; color: #14213b; font-size: 23px; line-height: 1.25; }
    .closing-section a { min-height: 42px; display: inline-flex; align-items: center; gap: 8px; padding: 0 16px; border-radius: 11px; color: #fff; background: #173b8f; font-size: 11px; font-weight: 850; text-decoration: none; }
    .public-footer { min-height: 72px; width: min(1420px, calc(100% - 48px)); margin: 0 auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px; border-top: 1px solid rgba(20,33,59,.12); color: #7a8596; font-size: 10px; }
    .public-footer span:first-child { color: #173b8f; font-weight: 900; }
    .public-footer span:last-child { justify-self: end; }
    .mobile-access-bar { display: none; }
    .reveal-section { opacity: 0; transform: translateY(42px); transition: opacity 700ms ease, transform 700ms cubic-bezier(.22,1,.36,1); }
    .reveal-section.is-visible { opacity: 1; transform: none; }
    @keyframes header-arrive { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: none; } }
    @keyframes hero-arrive { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
    @keyframes panel-arrive { from { opacity: 0; transform: translateY(30px) scale(.975); } to { opacity: 1; transform: none; } }
    @keyframes status-breathe { 0%, 100% { box-shadow: 0 0 0 5px rgba(24,183,168,.12); } 50% { box-shadow: 0 0 0 9px rgba(24,183,168,.05), 0 0 18px rgba(24,183,168,.3); } }
    @keyframes ambient-drift { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(-32px,28px,0) scale(1.06); } }
    @media (max-width: 1050px) {
      .public-header { grid-template-columns: 1fr auto; }
      .public-header nav { display: none; }
      .hero-section { grid-template-columns: 1fr; min-height: 0; gap: 48px; padding-top: 54px; }
      .access-panel { max-width: 560px; }
      .release-track { grid-template-columns: 1fr 1fr; }
      .release-track article:nth-child(2) { border-right: 0; }
      .release-track article:nth-child(-n+2) { border-bottom: 1px solid rgba(255,255,255,.1); }
      .release-track__arrow { display: none; }
      .outcome-grid { grid-template-columns: 1fr 1fr; }
      .governance-section { grid-template-columns: 1fr; gap: 42px; padding: 48px; }
      .builder-section { grid-template-columns: minmax(300px, .8fr) minmax(0, 1.2fr); gap: 42px; }
      .builder-story { padding-right: 28px; }
    }
    @media (max-width: 720px) {
      .public-header, main, .public-footer { width: min(100% - 28px, 1420px); }
      .public-header { min-height: 64px; }
      .public-brand small, .header-access { display: none; }
      .hero-section { padding: 44px 0 56px; }
      h1 { font-size: clamp(43px, 13vw, 60px); }
      .hero-copy { font-size: 17px; }
      .hero-actions { align-items: stretch; flex-direction: column; }
      .pilot-card { grid-template-columns: 40px 1fr; }
      .pilot-card__status { grid-column: 2; }
      .access-panel { padding: 25px 20px; border-radius: 20px; }
      .release-model { margin-bottom: 82px; padding: 18px; }
      .release-model__heading { align-items: flex-start; flex-direction: column; }
      .release-model__heading h2 { text-align: left; }
      .release-track { grid-template-columns: 1fr; }
      .release-track article { border-right: 0; border-bottom: 1px solid rgba(255,255,255,.1); }
      .release-track article:last-child { border-bottom: 0; }
      .business-case, .outcome-section, .audience-section { padding-bottom: 82px; }
      .comparison-board__headings { grid-template-columns: 1fr; }
      .comparison-row { grid-template-columns: 1fr; border-top: 1px solid #e5e8ee; }
      .comparison-row + .comparison-row { margin-top: 8px; }
      .comparison-cell { border-top: 0; }
      .comparison-cell--solution { border-left: 0; }
      .comparison-cell--problem { background: #fff8f2; }
      .outcome-grid, .audience-section { grid-template-columns: 1fr; }
      .outcome-grid article { min-height: 190px; }
      .audience-card { min-height: 0; padding: 28px 23px; }
      .governance-section { padding: 30px 22px; margin-bottom: 64px; }
      .governance-copy h2 { font-size: 35px; }
      .builder-section { grid-template-columns: 1fr; min-height: 0; padding: 14px; border-radius: 22px; }
      .builder-portrait { min-height: 520px; }
      .builder-story { padding: 20px 9px 26px; }
      .builder-story h2 { font-size: 42px; }
      .builder-story .builder-lead { font-size: 15px; }
      .builder-footer { align-items: stretch; flex-direction: column; }
      .builder-footer a { justify-content: center; }
      .closing-section { grid-template-columns: 48px 1fr; padding: 24px 6px; margin-bottom: 66px; }
      .closing-section__mark { width: 48px; height: 48px; }
      .closing-section a { grid-column: 1 / -1; width: 100%; justify-content: center; }
      .public-footer { grid-template-columns: 1fr; gap: 6px; padding: 22px 0 84px; }
      .public-footer span:nth-child(2) { display: none; }
      .public-footer span:last-child { justify-self: start; }
      .mobile-access-bar { position: fixed; z-index: 20; inset: auto 10px 10px; display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 8px; border: 1px solid #cfd6e1; border-radius: 14px; background: rgba(255,255,255,.94); box-shadow: 0 18px 45px rgba(20,33,59,.22); backdrop-filter: blur(14px); }
      .mobile-access-bar a { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 14px; border-radius: 9px; color: #173b8f; font-size: 11px; font-weight: 850; text-decoration: none; }
      .mobile-access-bar a:first-child { color: #fff; background: #173b8f; }
      .mobile-access-bar mat-icon { width: 17px; height: 17px; font-size: 17px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .landing-shell::before, .landing-shell::after, .public-header, .hero-kicker, .hero-story h1, .hero-copy, .hero-actions, .pilot-card, .pilot-card__status i, .access-panel { animation: none; }
      .reveal-section, .release-track article, .comparison-row, .outcome-grid article, .governance-proof article, .builder-portrait img { opacity: 1; transform: none; transition: none; }
      .release-track::after { width: 100%; transition: none; }
      * { scroll-behavior: auto !important; }
    }
  `]
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(LocalAuthService);
  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private revealObserver?: IntersectionObserver;

  readonly form = this.fb.nonNullable.group({
    userName: ['', Validators.required],
    password: ['', Validators.required]
  });

  submitting = false;
  error = '';

  readonly operatingSteps = [
    { icon: 'lock_person', title: 'Prepare privately', description: 'Work freely before entering formal review.' },
    { icon: 'fact_check', title: 'Validate portfolio', description: 'Check quality and connected datasets together.' },
    { icon: 'approval', title: 'Approve with context', description: 'Understand additions, changes and removals.' },
    { icon: 'verified', title: 'Publish with proof', description: 'Release approved data and retain evidence.' }
  ];

  readonly problemSolutions = [
    { problem: 'Corrections create repeated spreadsheet versions and unclear ownership.', solution: 'A private workspace keeps preparation and corrections in one controlled place.' },
    { problem: 'Article and price updates can move independently and become inconsistent.', solution: 'Connected datasets are validated and released as one portfolio when required.' },
    { problem: 'Teams see unfinished work before contributors are ready for review.', solution: 'Drafts remain private until their owner deliberately submits them.' },
    { problem: 'Approvals lose the exact context that supported the decision.', solution: 'The approved situation is preserved as permanent, governed evidence.' },
    { problem: 'Publication responsibility is difficult to separate and explain.', solution: 'Configurable capabilities define who prepares, approves, publishes and administers.' }
  ];

  readonly businessOutcomes = [
    { icon: 'shield', title: 'Safer publication', description: 'Prevent incomplete or inconsistent dataset combinations from reaching CPQ.' },
    { icon: 'edit_note', title: 'Less rework', description: 'Correct, add, remove and restore rows without repeatedly exchanging files.' },
    { icon: 'account_tree', title: 'Clear accountability', description: 'Separate preparation, approval and publication responsibilities.' },
    { icon: 'history_edu', title: 'Defensible decisions', description: 'Retain what changed, what was accepted and what was ultimately published.' }
  ];

  ngAfterViewInit(): void {
    const revealElements = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.reveal-section'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealElements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    this.revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        this.revealObserver?.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

    revealElements.forEach((element) => this.revealObserver?.observe(element));
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
  }

  scrollToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  submit(): void {
    if (this.form.invalid || this.submitting) return;

    this.submitting = true;
    this.error = '';

    const { userName, password } = this.form.getRawValue();
    this.auth.login(userName.trim(), password).subscribe({
      next: (response) => {
        this.submitting = false;
        const capabilities = response.user.capabilities ?? [];
        const destination = capabilities.includes('tools.evolis') && !capabilities.includes('imports.view')
          ? '/internal-tools/evolis-decryptor'
          : '/dashboard';
        this.router.navigateByUrl(destination);
      },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.error ?? 'Login failed. Please try again.';
      }
    });
  }
}
