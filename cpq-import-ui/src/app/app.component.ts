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
  `,
  styles: [`
    mat-toolbar { position: sticky; top: 0; z-index: 100; }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 18px; }
    .spacer { flex: 1; }
    .page-content { max-width: 1200px; margin: 24px auto; padding: 0 16px; }
    .active-link { background: rgba(255,255,255,0.15); border-radius: 4px; }
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
