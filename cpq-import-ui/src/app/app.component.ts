import { Component, OnInit, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from './core/auth/auth.config';
import { AuthFacade } from './core/auth/auth.facade';
import { isLocalAuthMode } from './core/auth/auth-mode';
import { NotificationCenterComponent } from './shared/notification-center/notification-center.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, NotificationCenterComponent],
  template: `
    <mat-toolbar color="primary">
      <span class="brand">
        <mat-icon>cloud_upload</mat-icon>
        CPQ Data Import
      </span>
      <span class="spacer"></span>
      <a mat-button *ngIf="auth.isAuthenticated" routerLink="/dashboard" routerLinkActive="active-link">
        <mat-icon>dashboard</mat-icon> Dashboard
      </a>
      <a mat-button *ngIf="auth.isAuthenticated" routerLink="/import/new" routerLinkActive="active-link">
        <mat-icon>add</mat-icon> New Import
      </a>
      <a mat-button *ngIf="auth.isAuthenticated && auth.isAdmin" routerLink="/admin/users" routerLinkActive="active-link">
        <mat-icon>admin_panel_settings</mat-icon> Admin Panel
      </a>
      <app-notification-center *ngIf="auth.isAuthenticated"></app-notification-center>
      <button mat-icon-button *ngIf="auth.isAuthenticated" [matMenuTriggerFor]="userMenu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <a mat-button *ngIf="!auth.isAuthenticated" routerLink="/login" routerLinkActive="active-link">
        <mat-icon>login</mat-icon> Sign in
      </a>
      <mat-menu #userMenu>
        <button mat-menu-item disabled>
          <mat-icon>person</mat-icon>
          <span>{{ auth.userName }}</span>
        </button>
        <button mat-menu-item disabled *ngIf="auth.isAdmin">
          <mat-icon>verified_user</mat-icon>
          <span>Administrator</span>
        </button>
        <button mat-menu-item (click)="auth.logout()">
          <mat-icon>logout</mat-icon>
          <span>Sign out</span>
        </button>
      </mat-menu>
    </mat-toolbar>

    <main class="page-content">
      <router-outlet />
    </main>

    <footer class="app-signature" aria-label="Application signature">
      <span class="signature-main">
        <span class="signature-label">Crafted by</span>
        <span class="signature-name">BENHAMED Walid</span>
      </span>
      <span class="signature-hint">
        <span class="signature-role">Product configuration & Data Profile |<br />CPQ specialist &#64; Legrand</span>
        <a
          class="signature-profile-link"
          href="https://www.linkedin.com/in/walid-benhamed-26214914b/"
          target="_blank"
          rel="noopener noreferrer"
          title="Take a look into my profile"
          aria-label="Take a look into my profile on LinkedIn"
        >
          <svg class="linkedin-logo" viewBox="0 0 24 24" role="img" aria-hidden="true">
            <path
              d="M19 3A2 2 0 0 1 21 5V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H19ZM8.6 10.4H6.2V17H8.6V10.4ZM8.8 7.95C8.8 7.17 8.19 6.6 7.4 6.6C6.6 6.6 6 7.17 6 7.95C6 8.72 6.6 9.3 7.4 9.3C8.19 9.3 8.8 8.72 8.8 7.95ZM18 13.35C18 11.35 16.9 10.2 15.2 10.2C14.23 10.2 13.64 10.73 13.35 11.1V10.4H11V17H13.4V13.75C13.4 12.9 13.56 12.08 14.62 12.08C15.66 12.08 15.67 13.05 15.67 13.8V17H18V13.35Z"
            />
          </svg>
          <span>Take a look into my profile</span>
        </a>
      </span>
    </footer>
  `,
  styles: [`
    mat-toolbar { position: sticky; top: 0; z-index: 100; }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 18px; }
    .spacer { flex: 1; }
    .page-content { max-width: 1200px; margin: 24px auto; padding: 0 16px; }
    .active-link { background: rgba(255,255,255,0.15); border-radius: 4px; }
    .app-signature {
      position: fixed;
      right: 20px;
      bottom: 0;
      z-index: 90;
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 0;
      padding: 14px 16px;
      width: max-content;
      max-width: calc(100vw - 20px);
      border-radius: 12px 12px 0 0;
      border: 1px solid rgba(148, 163, 184, 0.45);
      border-bottom: 0;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(241, 245, 249, 0.95));
      backdrop-filter: blur(6px);
      color: #334155;
      font-size: 15px;
      letter-spacing: 0;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
      transform-origin: bottom right;
      overflow: visible;
      animation: signature-pop-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
      transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, border-color 0.25s ease;
    }
    .app-signature:hover {
      transform: translateY(-18px);
      border-color: rgba(100, 116, 139, 0.55);
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16);
    }
    .signature-main {
      display: inline-flex;
      align-items: baseline;
      gap: 10px;
      white-space: nowrap;
      width: max-content;
    }
    .signature-label {
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-size: 11px;
      line-height: 1;
    }
    .signature-name {
      color: #334155;
      font-weight: 700;
      letter-spacing: 0.2px;
      font-size: 19px;
      white-space: nowrap;
      line-height: 1;
    }
    .signature-hint {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 8px;
      width: 100%;
      min-width: 0;
      color: #334155;
      font-size: 13px;
      font-weight: 500;
      text-align: left;
      opacity: 0;
      pointer-events: none;
      max-height: 0;
      margin-top: 0;
      padding-top: 0;
      overflow: hidden;
      white-space: normal;
      border-top: 1px solid transparent;
      transition: opacity 0.2s ease, max-height 0.28s ease, margin-top 0.28s ease, padding-top 0.28s ease, border-color 0.28s ease;
    }
    .signature-role {
      color: #475569;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
      max-width: 34ch;
      overflow-wrap: anywhere;
    }
    .signature-profile-link {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      flex-wrap: wrap;
      gap: 6px;
      color: #0a66c2;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: color 0.2s ease, border-color 0.2s ease;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .signature-profile-link:hover,
    .signature-profile-link:focus-visible {
      color: #084c94;
      border-bottom-color: rgba(8, 76, 148, 0.45);
      outline: none;
    }
    .linkedin-logo {
      width: 16px;
      height: 16px;
      fill: #0a66c2;
      flex: 0 0 auto;
    }
    .app-signature:hover .signature-hint,
    .app-signature:focus-within .signature-hint {
      opacity: 1;
      pointer-events: auto;
      max-height: 120px;
      margin-top: 7px;
      padding-top: 8px;
      border-top-color: rgba(148, 163, 184, 0.35);
    }
    @keyframes signature-pop-in {
      0% {
        opacity: 0;
        transform: translateY(12px) scale(0.94);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    @media (max-width: 768px) {
      .app-signature {
        right: 10px;
        padding: 12px 13px;
        max-width: calc(100vw - 20px);
      }
      .signature-name {
        font-size: 17px;
      }
      .signature-hint {
        max-width: calc(100vw - 20px);
        text-wrap: balance;
      }
    }
  `]
})
export class AppComponent implements OnInit {
  readonly auth = inject(AuthFacade);
  private readonly oauthService = inject(OAuthService);

  ngOnInit(): void {
    if (isLocalAuthMode()) {
      this.auth.initializeLocalSession();
      return;
    }

    this.oauthService.configure(authConfig);
    this.oauthService.loadDiscoveryDocumentAndTryLogin();
    this.oauthService.setupAutomaticSilentRefresh();
  }
}
