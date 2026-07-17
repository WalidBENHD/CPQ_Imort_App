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

        <button mat-icon-button class="profile-trigger" *ngIf="auth.isAuthenticated" [matMenuTriggerFor]="userMenu" aria-label="Open profile menu">
          <span>{{ auth.userInitials }}</span>
        </button>

        <a mat-button class="sign-in-link" *ngIf="!auth.isAuthenticated" routerLink="/login" routerLinkActive="active-link">
          <mat-icon>login</mat-icon> Sign in
        </a>

        <mat-menu #userMenu="matMenu" class="user-menu-panel">
          <section class="profile-menu" (click)="$event.stopPropagation()">
            <header class="profile-menu__identity">
              <span class="profile-menu__avatar">{{ auth.userInitials }}</span>
              <span class="profile-menu__person">
                <strong>{{ auth.userName }}</strong>
                <small>{{ auth.loginName }}</small>
              </span>
              <span class="profile-menu__status"><i></i> Active</span>
            </header>

            <div class="profile-menu__section">
              <span class="profile-menu__label"><mat-icon>shield_person</mat-icon> Assigned roles</span>
              <div class="profile-menu__roles" *ngIf="auth.roleNames.length; else noAssignedRole">
                <span *ngFor="let role of auth.roleNames">{{ role }}</span>
              </div>
              <ng-template #noAssignedRole><p class="profile-menu__empty">Standard platform access</p></ng-template>
            </div>

            <div class="profile-menu__access">
              <span class="profile-menu__access-icon"><mat-icon>key</mat-icon></span>
              <span><strong>{{ auth.capabilities.length }} capabilities enabled</strong><small>Access is managed through your assigned roles.</small></span>
            </div>

            <button mat-flat-button type="button" class="profile-menu__logout" (click)="auth.logout()">
              <mat-icon>logout</mat-icon>
              Sign out
            </button>
          </section>
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

          <ng-container *ngIf="auth.isInternalTools">
            <div class="nav-group-label" *ngIf="isSidebarOpen">Internal Tools</div>

            <a
              mat-button
              class="side-link"
              *ngFor="let item of internalToolsNavItems"
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

          <ng-container *ngIf="visibleAdminNavItems.length">
            <div class="nav-group-label" *ngIf="isSidebarOpen">Admin</div>

            <a
              mat-button
              class="side-link"
              *ngFor="let item of visibleAdminNavItems"
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

          <div class="nav-group-label" *ngIf="isSidebarOpen">Settings</div>

          <div class="side-link side-link--settings theme-toggle-row" [class.side-link--compact]="!isSidebarOpen">
            <mat-icon *ngIf="isSidebarOpen">{{ isDarkTheme ? 'dark_mode' : 'light_mode' }}</mat-icon>
            <span *ngIf="isSidebarOpen" class="theme-toggle-row__label">{{ themeLabel }}</span>

            <button
              class="theme-toggle-row__switch"
              type="button"
              [attr.aria-label]="themeSwitchAriaLabel"
              [attr.aria-pressed]="isDarkTheme"
              [matTooltip]="!isSidebarOpen ? themeSwitchAriaLabel : ''"
              (click)="toggleTheme()"
            >
              <span class="theme-toggle-row__track" [class.theme-toggle-row__track--dark]="isDarkTheme">
                <span class="theme-toggle-row__thumb" [class.theme-toggle-row__thumb--dark]="isDarkTheme"></span>
                <mat-icon class="theme-toggle-row__thumb-icon" aria-hidden="true">{{ isDarkTheme ? 'dark_mode' : 'light_mode' }}</mat-icon>
              </span>
            </button>
          </div>

          <div class="side-nav-footer" *ngIf="auth.isAuthenticated">
            <div
              class="signature-card"
              [class.signature-card--collapsed]="!isSidebarOpen"
              [matTooltip]="!isSidebarOpen ? 'Designed and built by Walid Benhamed' : ''"
            >
              <a
                class="signature-mark"
                href="https://www.linkedin.com/in/walid-benhamed-26214914b/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Walid Benhamed's LinkedIn profile"
              >WB</a>

              <div class="signature-copy" *ngIf="isSidebarOpen">
                <span class="signature-label">Designed &amp; built by</span>
                <span class="signature-name">Walid Benhamed</span>
                <span class="signature-role">CPQ Application Specialist</span>
              </div>

              <a
                class="signature-profile-link"
                href="https://www.linkedin.com/in/walid-benhamed-26214914b/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Walid Benhamed's LinkedIn profile"
                matTooltip="View LinkedIn profile"
              >
                <svg class="linkedin-logo" viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path
                    d="M19 3A2 2 0 0 1 21 5V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H19ZM8.6 10.4H6.2V17H8.6V10.4ZM8.8 7.95C8.8 7.17 8.19 6.6 7.4 6.6C6.6 6.6 6 7.17 6 7.95C6 8.72 6.6 9.3 7.4 9.3C8.19 9.3 8.8 8.72 8.8 7.95ZM18 13.35C18 11.35 16.9 10.2 15.2 10.2C14.23 10.2 13.64 10.73 13.35 11.1V10.4H11V17H13.4V13.75C13.4 12.9 13.56 12.08 14.62 12.08C15.66 12.08 15.67 13.05 15.67 13.8V17H18V13.35Z"
                  />
                </svg>
              </a>
            </div>
          </div>
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
    .profile-trigger {
      width: 40px;
      height: 40px;
      margin: 0 0 0 2px;
      padding: 0;
      display: grid;
      place-items: center;
    }
    .profile-trigger span {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.42);
      background: rgba(255, 255, 255, 0.16);
      color: #fff;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.03em;
    }

    .shell-body {
      display: grid;
      grid-template-columns: 240px minmax(0, 1fr);
      align-items: start;
      min-height: calc(100vh - 64px);
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
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      overflow: hidden;
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
      align-items: center;
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

    .side-link--compact mat-icon {
      margin: 0;
    }

    .side-link--settings {
      margin-top: 4px;
      justify-content: flex-start;
      gap: 10px;
    }

    .theme-toggle-row {
      justify-content: flex-start;
      gap: 10px;
      margin-top: 4px;
      min-height: 42px;
    }

    .side-link--compact.theme-toggle-row {
      justify-content: center;
      gap: 0;
      padding: 0;
    }

    .theme-toggle-row__label {
      min-width: 0;
      white-space: nowrap;
    }

    .theme-toggle-row__switch {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      flex: 0 0 auto;
    }

    .theme-toggle-row__track {
      position: relative;
      width: 42px;
      height: 22px;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(37, 99, 235, 0.18), rgba(37, 99, 235, 0.10));
      box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.10);
      transition: background-color 0.25s ease, box-shadow 0.25s ease;
    }

    .theme-toggle-row__track--dark {
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(37, 99, 235, 0.16));
      box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.26);
    }

    .theme-toggle-row__thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
      transition: transform 0.25s ease, background-color 0.25s ease;
    }

    .theme-toggle-row__thumb-icon {
      position: absolute;
      top: 50%;
      left: 5px;
      transform: translateY(-50%);
      width: 10px;
      height: 10px;
      font-size: 10px;
      line-height: 10px;
      color: #2563eb;
      pointer-events: none;
      transition: left 0.25s ease, color 0.25s ease, opacity 0.25s ease;
    }

    .theme-toggle-row__thumb--dark {
      transform: translateX(20px);
      background: #93c5fd;
    }

    .theme-toggle-row__track--dark .theme-toggle-row__thumb-icon {
      left: 25px;
      color: #0f172a;
    }

    .side-link--compact .theme-toggle-row__switch {
      margin-left: 0;
      width: 100%;
    }

    .side-link--compact .theme-toggle-row__track {
      width: 38px;
    }

    .side-link--compact .theme-toggle-row__thumb-icon {
      left: 4px;
    }

    .side-link--compact .theme-toggle-row__thumb--dark {
      transform: translateX(16px);
    }

    .side-link--compact .theme-toggle-row__track--dark .theme-toggle-row__thumb-icon {
      left: 22px;
    }

    .side-link--active {
      background: linear-gradient(180deg, rgba(37, 99, 235, 0.16), rgba(37, 99, 235, 0.24));
      color: var(--app-accent);
    }

    .side-link--active mat-icon {
      color: var(--app-accent);
    }

    .side-nav-footer {
      margin-top: auto;
      padding: 14px 4px 4px;
    }

    .signature-card {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 30px;
      grid-template-areas: "mark copy link";
      gap: 11px;
      align-items: center;
      padding: 13px;
      border: 1px solid color-mix(in srgb, var(--app-accent) 16%, var(--app-border));
      border-radius: 16px;
      background:
        radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--app-accent) 11%, transparent), transparent 48%),
        var(--app-surface-elevated);
      color: var(--app-text);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.07);
    }

    .signature-card--collapsed {
      display: flex;
      justify-content: center;
      padding: 8px 4px;
      border-color: transparent;
      background: transparent;
      box-shadow: none;
    }

    .signature-mark {
      grid-area: mark;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border: 1px solid color-mix(in srgb, var(--app-accent) 22%, transparent);
      border-radius: 14px;
      background: linear-gradient(145deg, var(--app-accent), color-mix(in srgb, var(--app-accent) 70%, #172554));
      color: #fff;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-decoration: none;
      flex: 0 0 auto;
      box-shadow: 0 6px 14px color-mix(in srgb, var(--app-accent) 24%, transparent);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .signature-mark:hover,
    .signature-mark:focus-visible {
      transform: translateY(-1px);
      outline: 2px solid color-mix(in srgb, var(--app-accent) 38%, transparent);
      outline-offset: 2px;
    }

    .signature-copy {
      grid-area: copy;
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
      flex: 1;
    }

    .signature-label {
      color: var(--app-text-muted);
      font-size: 9px;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      line-height: 1;
    }

    .signature-name {
      color: var(--app-text);
      font-size: 13px;
      font-weight: 850;
      line-height: 1.15;
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
    }

    .signature-role {
      color: var(--app-text-muted);
      font-size: 10px;
      line-height: 1.25;
    }

    .signature-profile-link {
      grid-area: link;
      display: grid;
      place-items: center;
      align-items: center;
      width: 30px;
      height: 30px;
      border: 1px solid color-mix(in srgb, var(--app-accent) 20%, var(--app-border));
      border-radius: 10px;
      background: color-mix(in srgb, var(--app-accent) 7%, var(--app-surface));
      color: var(--app-accent);
      text-decoration: none;
      flex-shrink: 0;
      transition: background 160ms ease, color 160ms ease, transform 160ms ease;
    }

    .signature-profile-link:hover,
    .signature-profile-link:focus-visible {
      background: var(--app-accent);
      color: #fff;
      transform: translateY(-1px);
      outline: none;
    }

    .signature-card--collapsed .signature-profile-link {
      display: none;
    }

    .signature-card .linkedin-logo {
      width: 17px;
      height: 17px;
      fill: currentColor;
      flex: 0 0 auto;
    }

    html.theme-dark .signature-card {
      border-color: rgba(126, 162, 255, 0.2);
      background:
        radial-gradient(circle at 8% 0%, rgba(59, 130, 246, 0.16), transparent 48%),
        #111a2f;
      box-shadow: 0 12px 28px rgba(2, 6, 23, 0.3);
    }

    html.theme-dark .signature-card--collapsed {
      border-color: transparent;
      background: transparent;
      box-shadow: none;
    }

    html.theme-dark .signature-label,
    html.theme-dark .signature-role {
      color: #94a3b8;
    }

    html.theme-dark .signature-name {
      color: #e2e8f0;
    }

    html.theme-dark .signature-profile-link {
      border-color: rgba(147, 197, 253, 0.2);
      background: rgba(59, 130, 246, 0.1);
      color: #93c5fd;
    }

    html.theme-dark .signature-profile-link:hover,
    html.theme-dark .signature-profile-link:focus-visible {
      color: #bfdbfe;
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
        height: calc(100vh - 56px);
        width: 260px;
        transform: translateX(-110%);
        transition: transform 0.24s ease;
        box-shadow: 0 8px 26px rgba(15, 23, 42, 0.2);
        overflow-y: auto;
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

      .side-nav-footer {
        margin-top: auto;
        padding-top: 12px;
      }

      .signature-card {
        padding: 10px 12px;
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

  readonly adminNavItems: ReadonlyArray<{ route: string; label: string; icon: string; capabilities: string[] }> = [
    { route: '/admin/users', label: 'People', icon: 'group', capabilities: ['users.manage', 'users.assign_roles'] },
    { route: '/admin/access-studio', label: 'Access Studio', icon: 'shield_person', capabilities: ['roles.manage'] },
    { route: '/admin/activity', label: 'Activity', icon: 'monitoring', capabilities: ['audit.view'] },
    { route: '/admin/maintenance', label: 'Maintenance', icon: 'build_circle', capabilities: ['system.maintenance'] }
  ];

  readonly internalToolsNavItems: ReadonlyArray<{ route: string; label: string; icon: string }> = [
    { route: '/internal-tools/evolis-decryptor', label: 'Evolis Decryptor', icon: 'lock_open' }
  ];

  readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly oauthService = inject(OAuthService);
  private readonly activityMonitorService = inject(ActivityMonitorService);
  private readonly themeService = inject(ThemeService);
  private routeSub: Subscription | null = null;
  isSidebarOpen = true;
  isMobileSidebarOpen = false;

  get visibleAdminNavItems(): ReadonlyArray<{ route: string; label: string; icon: string; capabilities: string[] }> {
    return this.adminNavItems.filter(item => item.capabilities.every(capability => this.auth.hasCapability(capability)));
  }

  get themeIcon(): string {
    return this.themeService.currentTheme === 'dark' ? 'light_mode' : 'dark_mode';
  }

  get themeTooltip(): string {
    return this.themeService.currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  get isDarkTheme(): boolean {
    return this.themeService.currentTheme === 'dark';
  }

  get themeSwitchAriaLabel(): string {
    return this.isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode';
  }

  get themeLabel(): string {
    return this.themeService.currentTheme === 'dark' ? 'Light mode' : 'Dark mode';
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
    this.syncThemeForRoute();

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
        this.syncThemeForRoute();

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

  private syncThemeForRoute(): void {
    const isAuthRoute = this.router.url.startsWith('/login') || this.router.url.startsWith('/register');

    if (isAuthRoute) {
      this.themeService.applyTheme('light');
      return;
    }

    this.themeService.applyTheme(this.themeService.currentTheme);
  }
}
