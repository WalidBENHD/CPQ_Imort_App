import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from './core/auth/auth.config';
import { AuthFacade } from './core/auth/auth.facade';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <mat-toolbar color="primary">
      <span class="brand">
        <mat-icon>cloud_upload</mat-icon>
        CPQ Data Import
      </span>
      <span class="spacer"></span>
      <a mat-button routerLink="/dashboard" routerLinkActive="active-link">
        <mat-icon>dashboard</mat-icon> Dashboard
      </a>
      <a mat-button routerLink="/import/new" routerLinkActive="active-link">
        <mat-icon>add</mat-icon> New Import
      </a>
      <button mat-icon-button [matMenuTriggerFor]="userMenu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #userMenu>
        <button mat-menu-item disabled>
          <mat-icon>person</mat-icon>
          <span>{{ auth.userName }}</span>
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
      <span class="signature-label">Crafted by</span>
      <span class="signature-name">BENHAMED Walid</span>
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
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 10px 10px 0 0;
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-bottom: 0;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.92));
      backdrop-filter: blur(6px);
      color: #334155;
      font-size: 12px;
      letter-spacing: 0.2px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .app-signature:hover {
      transform: translateY(-1px);
      border-color: rgba(99, 102, 241, 0.45);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.22);
    }
    .signature-label {
      color: #64748b;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      font-size: 10px;
    }
    .signature-name {
      color: #1e293b;
      font-weight: 700;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
  `]
})
export class AppComponent implements OnInit {
  readonly auth = inject(AuthFacade);
  private readonly oauthService = inject(OAuthService);

  ngOnInit(): void {
    if (environment.disableAuth) {
      return;
    }

    this.oauthService.configure(authConfig);
    this.oauthService.loadDiscoveryDocumentAndTryLogin();
    this.oauthService.setupAutomaticSilentRefresh();
  }
}
