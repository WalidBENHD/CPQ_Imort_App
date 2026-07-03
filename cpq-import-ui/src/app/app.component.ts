import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OAuthService } from 'angular-oauth2-oidc';
import { Subscription, filter } from 'rxjs';
import { authConfig } from './core/auth/auth.config';
import { AuthFacade } from './core/auth/auth.facade';
import { isLocalAuthMode } from './core/auth/auth-mode';
import { NotificationCenterComponent } from './shared/notification-center/notification-center.component';
import { ActivityMonitorService } from './core/services/activity-monitor.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, NgFor, RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, NotificationCenterComponent],
  template: `
    <button
      mat-icon-button
      class="theme-toggle-fab"
      type="button"
      (click)="toggleTheme()"
      [matTooltip]="themeTooltip"
      [attr.aria-label]="themeTooltip"
    >
      <mat-icon>{{ themeIcon }}</mat-icon>
    </button>

    <div class="app-shell" *ngIf="showAppChrome; else landingLayout">
      <mat-toolbar class="top-toolbar">
        <button
          mat-icon-button
          *ngIf="auth.isAuthenticated"
          (click)="toggleSidebar()"
          aria-label="Toggle navigation"
        >
          <mat-icon>{{ navToggleIcon }}</mat-icon>
        </button>

        <span class="brand">
          <mat-icon>cloud_upload</mat-icon>
          CPQ Dataset Platform
        </span>

        <span class="spacer"></span>

        <app-notification-center *ngIf="auth.isAuthenticated"></app-notification-center>

        <button mat-icon-button *ngIf="auth.isAuthenticated" [matMenuTriggerFor]="userMenu" aria-label="Open profile menu">
          <mat-icon>account_circle</mat-icon>
        </button>

        <a mat-button class="sign-in-link" *ngIf="!auth.isAuthenticated" routerLink="/login" routerLinkActive="active-link">
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

      <div class="shell-body" [class.shell-body--collapsed]="!isSidebarOpen" [class.shell-body--mobile-open]="isMobileSidebarOpen">
        <aside class="side-nav" *ngIf="auth.isAuthenticated" aria-label="Primary navigation">
          <div class="nav-group-label" *ngIf="isSidebarOpen">Navigation</div>

          <a
            mat-button
            class="side-link"
            *ngFor="let item of navItems"
            [routerLink]="item.route"
            routerLinkActive="side-link--active"
            [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
            [class.side-link--compact]="!isSidebarOpen"
            [attr.aria-label]="item.label"
            [matTooltip]="!isSidebarOpen ? item.label : ''"
            (click)="onNavItemClick()"
          >
            <mat-icon>{{ item.icon }}</mat-icon>
            <span *ngIf="isSidebarOpen">{{ item.label }}</span>
          </a>

          <ng-container *ngIf="auth.isAdmin">
            <div class="nav-group-label" *ngIf="isSidebarOpen">Admin</div>

            <a
              mat-button
              class="side-link"
              *ngFor="let item of adminNavItems"
              [routerLink]="item.route"
              routerLinkActive="side-link--active"
              [class.side-link--compact]="!isSidebarOpen"
              [attr.aria-label]="item.label"
              [matTooltip]="!isSidebarOpen ? item.label : ''"
              (click)="onNavItemClick()"
            >
              <mat-icon>{{ item.icon }}</mat-icon>
              <span *ngIf="isSidebarOpen">{{ item.label }}</span>
            </a>
          </ng-container>
        </aside>

        <button
          class="mobile-backdrop"
          *ngIf="isMobileSidebarOpen"
          (click)="closeMobileSidebar()"
          aria-label="Close navigation"
        ></button>

        <main class="page-content">
          <router-outlet />
        </main>
      </div>
    </div>

    <ng-template #landingLayout>
      <main class="page-content page-content--landing">
        <router-outlet />
      </main>
    </ng-template>

    <footer class="app-signature" *ngIf="showAppChrome" aria-label="Application signature">
      <span class="signature-main">
        <span class="signature-label">Created by</span>
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
    .app-shell {
      min-height: 100vh;
      background: var(--app-background);
    }
    .top-toolbar {
      position: sticky;
      top: 0;
      z-index: 120;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.16);
      background: var(--app-toolbar-bg);
      color: var(--app-toolbar-text);
      border-bottom: 1px solid var(--app-border);
    }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 18px; letter-spacing: 0.01em; }
    .spacer { flex: 1; }
    .sign-in-link { border-radius: 999px; }

    .theme-toggle-fab {
      position: fixed;
      left: 16px;
      bottom: 16px;
      z-index: 180;
      width: auto;
      min-width: 0;
      padding: 0 14px;
      border-radius: 999px;
      background: var(--app-surface-elevated);
      color: var(--app-text);
      border: 1px solid var(--app-border);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
    }
    .theme-toggle-fab mat-icon {
      margin-right: 6px;
    }

    .shell-body {
      display: grid;
      grid-template-columns: 240px minmax(0, 1fr);
      align-items: start;
      min-height: calc(100vh - 64px);
      transition: grid-template-columns 0.24s ease;
    }
    .shell-body--collapsed {
      grid-template-columns: 84px minmax(0, 1fr);
    }

    .side-nav {
      position: sticky;
      top: 64px;
      min-height: calc(100vh - 64px);
      border-right: 1px solid var(--app-border);
      background: var(--app-sidebar-bg);
      padding: 12px;
      display: grid;
      align-content: start;
      gap: 8px;
      overflow: hidden;
      transition: width 0.24s ease, padding 0.24s ease;
      z-index: 110;
    }

    .nav-group-label {
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--app-text-muted);
      font-weight: 800;
      margin: 6px 8px 4px;
    }

    .side-link {
      min-height: 42px;
      justify-content: flex-start;
      border-radius: 12px;
      color: var(--app-text);
      display: inline-flex;
      gap: 10px;
      padding: 0 12px;
      font-weight: 600;
      width: 100%;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    .side-link mat-icon {
      margin: 0;
      color: var(--app-text-muted);
      flex: 0 0 auto;
    }

    .side-link--compact {
      justify-content: center;
      padding: 0;
    }

    .side-link--active {
      background: linear-gradient(180deg, rgba(37, 99, 235, 0.16), rgba(37, 99, 235, 0.24));
      color: var(--app-accent);
    }

    .side-link--active mat-icon {
      color: var(--app-accent);
    }

    .page-content {
      max-width: 1240px;
      margin: 22px auto;
      padding: 0 18px;
      width: 100%;
      color: var(--app-text);
    }
    .page-content--landing {
      max-width: none;
      width: 100%;
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }
    .mobile-backdrop {
      display: none;
    }

    .active-link { background: rgba(255,255,255,0.15); border-radius: 6px; }
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
      border: 1px solid var(--app-border);
      border-bottom: 0;
      background: var(--app-surface-elevated);
      backdrop-filter: blur(6px);
      color: var(--app-text);
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
      color: var(--app-text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-size: 11px;
      line-height: 1;
    }
    .signature-name {
      color: var(--app-text);
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
      color: var(--app-text);
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
      color: var(--app-text-muted);
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
      fill: var(--app-accent);
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
      .top-toolbar { padding: 0 8px; }
      .brand { font-size: 15px; gap: 6px; }

      .shell-body,
      .shell-body--collapsed {
        display: block;
        min-height: calc(100vh - 56px);
      }

      .side-nav {
        position: fixed;
        top: 56px;
        left: 0;
        min-height: calc(100vh - 56px);
        width: 260px;
        transform: translateX(-110%);
        transition: transform 0.24s ease;
        box-shadow: 0 8px 26px rgba(15, 23, 42, 0.2);
      }

      .shell-body--mobile-open .side-nav {
        transform: translateX(0);
      }

      .mobile-backdrop {
        display: block;
        position: fixed;
        inset: 56px 0 0 0;
        border: 0;
        background: rgba(15, 23, 42, 0.4);
        z-index: 105;
      }

      .page-content { margin: 14px auto 78px; padding: 0 10px; }

      .app-signature {
        right: 8px;
        bottom: 8px;
        padding: 7px 10px;
        border-radius: 999px;
        max-width: calc(100vw - 16px);
        border: 1px solid var(--app-border);
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
        backdrop-filter: blur(4px);
      }
      .app-signature:hover {
        transform: none;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
      }
      .signature-main {
        gap: 6px;
      }
      .signature-label {
        display: inline;
        font-size: 10px;
        letter-spacing: 0.4px;
      }
      .signature-name {
        font-size: 13px;
        letter-spacing: 0;
      }
      .signature-hint {
        display: none;
      }

      .app-signature:focus-within {
        border-color: rgba(100, 116, 139, 0.6);
      }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  readonly navItems: ReadonlyArray<{ route: string; label: string; icon: string; exact?: boolean }> = [
    { route: '/dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { route: '/datasets', label: 'Datasets', icon: 'dataset' },
    { route: '/uploads', label: 'Uploads', icon: 'view_list' }
  ];

  readonly adminNavItems: ReadonlyArray<{ route: string; label: string; icon: string }> = [
    { route: '/admin/users', label: 'Admin Panel', icon: 'admin_panel_settings' },
    { route: '/admin/activity', label: 'Activity', icon: 'monitoring' }
  ];

  readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly oauthService = inject(OAuthService);
  private readonly activityMonitorService = inject(ActivityMonitorService);
  private readonly themeService = inject(ThemeService);
  private routeSub: Subscription | null = null;
  isSidebarOpen = true;
  isMobileSidebarOpen = false;

  get themeIcon(): string {
    return this.themeService.currentTheme === 'dark' ? 'light_mode' : 'dark_mode';
  }

  get themeTooltip(): string {
    return this.themeService.currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  get navToggleIcon(): string {
    if (this.isMobile) {
      return this.isMobileSidebarOpen ? 'close' : 'menu';
    }

    return this.isSidebarOpen ? 'menu_open' : 'menu';
  }

  private get isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  get showAppChrome(): boolean {
    return !this.router.url.startsWith('/login') && !this.router.url.startsWith('/register');
  }

  ngOnInit(): void {
    this.themeService.initialize();

    if (isLocalAuthMode()) {
      this.auth.initializeLocalSession();
    }
    else
    {
      this.oauthService.configure(authConfig);
      this.oauthService.loadDiscoveryDocumentAndTryLogin();
      this.oauthService.setupAutomaticSilentRefresh();
    }

    this.routeSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        if (this.isMobile) {
          this.isMobileSidebarOpen = false;
        }

        if (!this.auth.isAuthenticated) {
          return;
        }

        const nav = event as NavigationEnd;
        this.activityMonitorService.trackView(nav.urlAfterRedirects).subscribe({
          error: () => {
            // Tracking failures should not affect user navigation.
          }
        });
      });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleSidebar(): void {
    if (this.isMobile) {
      this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
      return;
    }

    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen = false;
  }

  onNavItemClick(): void {
    if (this.isMobile) {
      this.isMobileSidebarOpen = false;
    }
  }
}
