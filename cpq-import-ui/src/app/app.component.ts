import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
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

type NavItem = {
  route: string;
  label: string;
  description: string;
  icon: string;
  capabilities?: string[];
  exact?: boolean;
};

type HeaderCommand = {
  route: string;
  label: string;
  description: string;
  icon: string;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, NgFor, RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, NotificationCenterComponent],
  template: `
    <ng-container *ngIf="navigationReady; else appBooting">
    <div class="app-shell" *ngIf="showAppChrome; else landingLayout">
      <mat-toolbar class="top-toolbar">
        <div class="toolbar-leading">
          <button
            mat-icon-button
            *ngIf="auth.isAuthenticated"
            (click)="toggleSidebar()"
            aria-label="Toggle navigation"
          >
            <mat-icon>{{ navToggleIcon }}</mat-icon>
          </button>

          <span class="brand">
            <span class="brand__mark"><mat-icon>cloud_upload</mat-icon></span>
            <span class="brand__name">CPQ Platform</span>
          </span>

          <span class="toolbar-context" *ngIf="auth.isAuthenticated">
            <span class="toolbar-context__divider"></span>
            <span class="toolbar-context__page">{{ currentPageTitle }}</span>
          </span>
        </div>

        <div
          class="header-command"
          *ngIf="auth.isAuthenticated && auth.hasCapability('imports.view')"
          [class.header-command--open]="headerCommandOpen"
          (click)="$event.stopPropagation()"
        >
          <form class="header-command__field" (submit)="runPrimaryHeaderCommand(); $event.preventDefault()">
            <mat-icon>search</mat-icon>
            <input
              type="search"
              aria-label="Find data or navigate the platform"
              placeholder="Search CPQ data, uploads and evidence"
              autocomplete="off"
              [value]="headerQuery"
              (input)="setHeaderQuery($any($event.target).value)"
              (focus)="headerCommandOpen = true"
              (keydown.escape)="closeHeaderCommand()"
            />
            <button type="button" class="header-command__clear" *ngIf="headerQuery" aria-label="Clear search" (click)="clearHeaderQuery()">
              <mat-icon>close</mat-icon>
            </button>
          </form>

          <section class="header-command__panel" *ngIf="headerCommandOpen">
            <div class="header-command__heading">
              <span>{{ headerQuery ? 'Search and navigate' : 'Quick access' }}</span>
              <small>Saint-Marcellin · PDU</small>
            </div>

            <button type="button" class="header-command__result header-command__result--primary" *ngIf="headerQuery" (click)="traceHeaderQuery()">
              <span class="header-command__result-icon"><mat-icon>manage_search</mat-icon></span>
              <span>
                <strong>Trace “{{ headerQuery }}”</strong>
                <small>Find its current CPQ value and full publication history</small>
              </span>
              <span class="header-command__action">Trace <mat-icon>arrow_forward</mat-icon></span>
            </button>

            <button type="button" class="header-command__result" *ngIf="headerQuery" (click)="searchUploadsFromHeader()">
              <span class="header-command__result-icon"><mat-icon>upload_file</mat-icon></span>
              <span>
                <strong>Search publications for “{{ headerQuery }}”</strong>
                <small>Open uploads with this search already applied</small>
              </span>
              <mat-icon class="header-command__arrow">north_east</mat-icon>
            </button>

            <button type="button" class="header-command__result" *ngFor="let command of filteredHeaderCommands" (click)="navigateHeaderCommand(command.route)">
              <span class="header-command__result-icon"><mat-icon>{{ command.icon }}</mat-icon></span>
              <span>
                <strong>{{ command.label }}</strong>
                <small>{{ command.description }}</small>
              </span>
              <mat-icon class="header-command__arrow">arrow_forward</mat-icon>
            </button>

            <div class="header-command__empty" *ngIf="headerQuery && filteredHeaderCommands.length === 0">
              <mat-icon>tips_and_updates</mat-icon>
              Use Trace for an exact business reference, or search the publication archive.
            </div>
          </section>
        </div>

        <div class="toolbar-actions">
          <button mat-icon-button class="quick-create" *ngIf="auth.isAuthenticated && canCreateAnything" [matMenuTriggerFor]="createMenu" aria-label="Create new work" matTooltip="Create new work">
            <mat-icon>add</mat-icon>
          </button>

          <span class="scope-chip" *ngIf="auth.isAuthenticated && auth.hasCapability('imports.view')">
            <i></i>
            Saint-Marcellin · PDU
          </span>

          <app-notification-center *ngIf="auth.isAuthenticated"></app-notification-center>

          <button mat-icon-button class="profile-trigger" *ngIf="auth.isAuthenticated" [matMenuTriggerFor]="userMenu" aria-label="Open profile menu">
            <span>{{ auth.userInitials }}</span>
          </button>

          <a mat-button class="sign-in-link" *ngIf="!auth.isAuthenticated" routerLink="/login" routerLinkActive="active-link">
            <mat-icon>login</mat-icon> Sign in
          </a>
        </div>

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
              <span class="profile-menu__label"><mat-icon>admin_panel_settings</mat-icon> Assigned roles</span>
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

        <mat-menu #createMenu="matMenu" class="create-menu-panel">
          <section class="create-menu" (click)="$event.stopPropagation()">
            <header class="create-menu__header">
              <span class="create-menu__mark"><mat-icon>add</mat-icon></span>
              <span>
                <small>Start governed work</small>
                <strong>What would you like to prepare?</strong>
              </span>
            </header>

            <div class="create-menu__actions">
              <button mat-menu-item class="create-menu__action" routerLink="/import/new" *ngIf="canUploadDataset">
                <span class="create-menu__icon create-menu__icon--upload"><mat-icon>upload_file</mat-icon></span>
                <span class="create-menu__copy">
                  <strong>Upload a dataset</strong>
                  <small>Import an Excel file into your private workspace</small>
                </span>
                <mat-icon class="create-menu__arrow">arrow_forward</mat-icon>
              </button>

              <button mat-menu-item class="create-menu__action" routerLink="/maintenance/new" *ngIf="canCreateMaintenance">
                <span class="create-menu__icon create-menu__icon--change"><mat-icon>edit_square</mat-icon></span>
                <span class="create-menu__copy">
                  <strong>Prepare a data change</strong>
                  <small>Change governed records without uploading a file</small>
                </span>
                <mat-icon class="create-menu__arrow">arrow_forward</mat-icon>
              </button>

              <button mat-menu-item class="create-menu__action" [routerLink]="['/uploads']" [queryParams]="{ space: 'workspace' }">
                <span class="create-menu__icon create-menu__icon--workspace"><mat-icon>workspaces</mat-icon></span>
                <span class="create-menu__copy">
                  <strong>Open my workspace</strong>
                  <small>Continue drafts that are still private to you</small>
                </span>
                <mat-icon class="create-menu__arrow">arrow_forward</mat-icon>
              </button>
            </div>

            <footer class="create-menu__footer">
              <span><i></i> Active scope</span>
              <strong>Saint-Marcellin · PDU</strong>
            </footer>
          </section>
        </mat-menu>
      </mat-toolbar>

      <div class="shell-body" [class.shell-body--collapsed]="!isSidebarOpen" [class.shell-body--mobile-open]="isMobileSidebarOpen">
        <aside class="side-nav" *ngIf="auth.isAuthenticated" aria-label="Primary navigation">
          <div class="side-nav__content">
          <ng-container *ngIf="visibleWorkNavItems.length">
            <div class="nav-group-label"><span>Workspace</span><i></i></div>

            <a
              mat-button
              class="side-link"
              *ngFor="let item of visibleWorkNavItems"
              [routerLink]="item.route"
              routerLinkActive="side-link--active"
              [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
              [class.side-link--compact]="!showSidebarLabels"
              [attr.aria-label]="item.label"
              [matTooltip]="!showSidebarLabels ? item.label : ''"
              (click)="onNavItemClick()"
            >
              <span class="side-link__icon"><mat-icon>{{ item.icon }}</mat-icon></span>
              <span class="side-link__copy"><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
            </a>
          </ng-container>

          <ng-container *ngIf="auth.isInternalTools">
            <div class="nav-group-label"><span>Specialist tools</span><i></i></div>

            <a
              mat-button
              class="side-link"
              *ngFor="let item of internalToolsNavItems"
              [routerLink]="item.route"
              routerLinkActive="side-link--active"
              [class.side-link--compact]="!showSidebarLabels"
              [attr.aria-label]="item.label"
              [matTooltip]="!showSidebarLabels ? item.label : ''"
              (click)="onNavItemClick()"
            >
              <span class="side-link__icon"><mat-icon>{{ item.icon }}</mat-icon></span>
              <span class="side-link__copy"><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
            </a>
          </ng-container>

          <ng-container *ngIf="visibleAdminNavItems.length">
            <div class="nav-group-label"><span>Administration</span><i></i></div>

            <a
              mat-button
              class="side-link"
              *ngFor="let item of visibleAdminNavItems"
              [routerLink]="item.route"
              routerLinkActive="side-link--active"
              [class.side-link--compact]="!showSidebarLabels"
              [attr.aria-label]="item.label"
              [matTooltip]="!showSidebarLabels ? item.label : ''"
              (click)="onNavItemClick()"
            >
              <span class="side-link__icon"><mat-icon>{{ item.icon }}</mat-icon></span>
              <span class="side-link__copy"><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
            </a>
          </ng-container>
          </div>

          <div class="side-nav__footer">
          <div class="theme-toggle-row" [class.theme-toggle-row--compact]="!showSidebarLabels">
            <span class="theme-toggle-row__icon"><mat-icon>{{ isDarkTheme ? 'dark_mode' : 'light_mode' }}</mat-icon></span>
            <span class="theme-toggle-row__label"><strong>{{ themeLabel }}</strong><small>Interface appearance</small></span>

            <button
              class="theme-toggle-row__switch"
              type="button"
              [attr.aria-label]="themeSwitchAriaLabel"
              [attr.aria-pressed]="isDarkTheme"
              [matTooltip]="!showSidebarLabels ? themeSwitchAriaLabel : ''"
              (click)="toggleTheme()"
            >
              <span class="theme-toggle-row__track" [class.theme-toggle-row__track--dark]="isDarkTheme">
                <span class="theme-toggle-row__thumb" [class.theme-toggle-row__thumb--dark]="isDarkTheme"></span>
                <mat-icon class="theme-toggle-row__thumb-icon" aria-hidden="true">{{ isDarkTheme ? 'dark_mode' : 'light_mode' }}</mat-icon>
              </span>
            </button>
          </div>

          <a
            class="sidebar-credit"
            [class.sidebar-credit--compact]="!showSidebarLabels"
            href="https://www.linkedin.com/in/walid-benhamed-26214914b/"
            target="_blank"
            rel="noopener noreferrer"
            [matTooltip]="!showSidebarLabels ? 'Designed and built by Walid Benhamed' : ''"
          >Designed by Walid Benhamed</a>
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
    </ng-container>

    <ng-template #appBooting>
      <main class="app-boot" aria-label="Loading CPQ Platform">
        <section class="app-boot__brand">
          <span class="app-boot__mark"><mat-icon>cloud_upload</mat-icon></span>
          <span>
            <strong>CPQ Platform</strong>
            <small>Preparing your governed workspace</small>
          </span>
        </section>
        <span class="app-boot__progress" aria-hidden="true"><i></i></span>
      </main>
    </ng-template>

  `,
  styles: [`
    .app-boot {
      min-height: 100vh;
      display: grid;
      place-content: center;
      gap: 22px;
      padding: 24px;
      color: #0f1f3d;
      background:
        radial-gradient(circle at 14% 18%, rgba(15, 159, 150, .11), transparent 32%),
        radial-gradient(circle at 88% 72%, rgba(45, 82, 204, .10), transparent 34%),
        #f5f6f2;
    }
    .app-boot__brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .app-boot__mark {
      width: 46px;
      height: 46px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      color: #fff;
      background: linear-gradient(145deg, #0f9f96, #2549a7);
      box-shadow: 0 12px 28px rgba(37, 73, 167, .2);
    }
    .app-boot__mark mat-icon { width: 24px; height: 24px; font-size: 24px; }
    .app-boot__brand span:last-child { display: grid; gap: 2px; }
    .app-boot__brand strong { font-size: 18px; letter-spacing: -.02em; }
    .app-boot__brand small { color: #64748b; font-size: 12px; }
    .app-boot__progress {
      width: 100%;
      height: 3px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(37, 73, 167, .1);
    }
    .app-boot__progress i {
      display: block;
      width: 42%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #0f9f96, #3156cb);
      animation: app-boot-progress 1.15s ease-in-out infinite;
    }
    @keyframes app-boot-progress {
      from { transform: translateX(-110%); }
      to { transform: translateX(245%); }
    }
    .app-shell {
      min-height: 100vh;
      background: var(--app-background);
    }
    .top-toolbar {
      position: sticky;
      top: 0;
      z-index: 120;
      height: 58px;
      min-height: 58px;
      display: grid;
      grid-template-columns: minmax(270px, 1fr) minmax(360px, 680px) minmax(270px, 1fr);
      align-items: center;
      gap: 20px;
      padding: 0 18px;
      box-shadow: 0 5px 18px rgba(15, 23, 42, 0.14);
      background: linear-gradient(110deg, #243c9b 0%, #3b59c5 58%, #2948aa 100%);
      color: var(--app-toolbar-text);
      border-bottom: 1px solid rgba(255, 255, 255, 0.16);
    }
    .toolbar-leading,
    .toolbar-actions {
      min-width: 0;
      display: flex;
      align-items: center;
    }
    .toolbar-leading { justify-content: flex-start; }
    .toolbar-actions { justify-content: flex-end; gap: 5px; }
    .brand { display: flex; align-items: center; gap: 9px; font-weight: 750; font-size: 16px; letter-spacing: -0.01em; }
    .brand__mark {
      width: 31px;
      height: 31px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.18);
      transition: transform var(--motion-fast) var(--ease-out), background-color var(--motion-fast) ease;
    }
    .brand:hover .brand__mark { transform: translateY(-1px) rotate(-3deg); background: rgba(255, 255, 255, 0.2); }
    .brand__mark mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .brand__name { white-space: nowrap; }
    .toolbar-context { display: flex; align-items: center; gap: 14px; margin-left: 16px; }
    .toolbar-context__divider { width: 1px; height: 22px; background: rgba(255, 255, 255, 0.25); }
    .toolbar-context__page { color: rgba(255, 255, 255, 0.82); font-size: 13px; font-weight: 650; }
    .header-command {
      position: relative;
      width: 100%;
      margin: 0;
      z-index: 3;
    }
    .header-command__field {
      height: 38px;
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      padding: 0 9px 0 11px;
      border: 1px solid rgba(255, 255, 255, .22);
      border-radius: 13px;
      background: rgba(8, 24, 78, .24);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .05);
      transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }
    .header-command--open .header-command__field,
    .header-command__field:focus-within {
      border-color: rgba(153, 246, 228, .65);
      background: rgba(7, 24, 72, .42);
      box-shadow: 0 0 0 3px rgba(45, 212, 191, .1);
    }
    .header-command__field > mat-icon {
      width: 18px;
      height: 18px;
      color: rgba(255, 255, 255, .76);
      font-size: 18px;
    }
    .header-command__field input {
      min-width: 0;
      width: 100%;
      border: 0;
      outline: 0;
      background: transparent;
      color: #fff;
      font: inherit;
      font-size: 12px;
      font-weight: 560;
    }
    .header-command__field input::placeholder { color: rgba(255, 255, 255, .64); }
    .header-command__field input::-webkit-search-cancel-button { display: none; }
    .header-command__clear {
      width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
      padding: 0;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: rgba(255, 255, 255, .72);
      cursor: pointer;
    }
    .header-command__clear:hover { background: rgba(255, 255, 255, .12); color: #fff; }
    .header-command__clear mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .header-command__panel {
      position: absolute;
      top: calc(100% + 10px);
      left: 0;
      width: min(580px, calc(100vw - 32px));
      max-height: min(620px, calc(100vh - 86px));
      overflow-y: auto;
      padding: 10px;
      border: 1px solid color-mix(in srgb, var(--app-accent) 20%, var(--app-border));
      border-radius: 18px;
      background: color-mix(in srgb, var(--app-surface) 96%, transparent);
      color: var(--app-text);
      box-shadow: 0 24px 64px rgba(15, 23, 42, .24), 0 4px 16px rgba(15, 23, 42, .1);
      backdrop-filter: blur(18px);
      animation: command-panel-enter 160ms var(--ease-out) both;
    }
    .header-command__heading {
      min-height: 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px 7px;
      color: var(--app-muted);
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .header-command__heading small {
      color: color-mix(in srgb, var(--app-accent) 72%, var(--app-muted));
      font: inherit;
      letter-spacing: .04em;
      text-transform: none;
    }
    .header-command__result {
      width: 100%;
      min-height: 58px;
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto;
      align-items: center;
      gap: 11px;
      padding: 8px 10px;
      border: 0;
      border-radius: 12px;
      background: transparent;
      color: var(--app-text);
      text-align: left;
      cursor: pointer;
      transition: background-color 140ms ease, transform 140ms ease;
    }
    .header-command__result:hover,
    .header-command__result:focus-visible {
      outline: 0;
      background: color-mix(in srgb, var(--app-accent) 8%, var(--app-surface));
      transform: translateX(2px);
    }
    .header-command__result--primary {
      margin-bottom: 4px;
      border: 1px solid color-mix(in srgb, #0f9f96 26%, var(--app-border));
      background: linear-gradient(110deg, color-mix(in srgb, #0f9f96 10%, var(--app-surface)), var(--app-surface));
    }
    .header-command__result-icon {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 11px;
      background: color-mix(in srgb, var(--app-accent) 10%, var(--app-surface));
      color: var(--app-accent);
    }
    .header-command__result-icon mat-icon { width: 19px; height: 19px; font-size: 19px; }
    .header-command__result > span:nth-child(2) { min-width: 0; display: grid; gap: 3px; }
    .header-command__result strong {
      overflow: hidden;
      color: var(--app-text);
      font-size: 12px;
      font-weight: 760;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .header-command__result small {
      overflow: hidden;
      color: var(--app-muted);
      font-size: 10px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .header-command__arrow { width: 17px; height: 17px; color: var(--app-muted); font-size: 17px; }
    .header-command__action {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #0f8f86;
      font-size: 10px;
      font-weight: 800;
    }
    .header-command__action mat-icon { width: 15px; height: 15px; font-size: 15px; }
    .header-command__empty {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 5px 4px 0;
      padding: 10px;
      border-top: 1px solid var(--app-border);
      color: var(--app-muted);
      font-size: 10px;
      line-height: 1.45;
    }
    .header-command__empty mat-icon { width: 17px; height: 17px; color: #ca8a04; font-size: 17px; }
    .quick-create {
      width: 34px;
      height: 34px;
      min-width: 34px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, .25);
      border-radius: 10px;
      background: rgba(255, 255, 255, .1);
      color: #fff;
    }
    .quick-create:hover { background: rgba(255, 255, 255, .17); }
    .quick-create mat-icon { width: 18px; height: 18px; margin: 0; font-size: 18px; }
    .scope-chip {
      min-height: 30px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0 4px;
      padding: 0 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 999px;
      background: rgba(11, 25, 79, 0.2);
      color: rgba(255, 255, 255, 0.9);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .scope-chip i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #5eead4;
      box-shadow: 0 0 0 4px rgba(94, 234, 212, 0.12);
      animation: scope-signal 3s ease-in-out infinite;
    }
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
      transition: transform var(--motion-fast) var(--ease-out), background-color var(--motion-fast) ease, border-color var(--motion-fast) ease;
    }
    .profile-trigger:hover span { transform: translateY(-1px); border-color: rgba(255,255,255,.7); background: rgba(255,255,255,.23); }

    .shell-body {
      display: grid;
      grid-template-columns: 252px minmax(0, 1fr);
      align-items: start;
      min-height: calc(100vh - 58px);
      transition: grid-template-columns 300ms cubic-bezier(.22, 1, .36, 1);
    }
    .shell-body--collapsed {
      grid-template-columns: 74px minmax(0, 1fr);
    }

    .side-nav {
      position: sticky;
      top: 58px;
      height: calc(100vh - 58px);
      border-right: 1px solid var(--app-border);
      background:
        radial-gradient(circle at 0 0, color-mix(in srgb, var(--app-accent) 9%, transparent), transparent 34%),
        linear-gradient(180deg, var(--app-sidebar-bg), color-mix(in srgb, var(--app-sidebar-bg) 92%, var(--app-background)));
      padding: 18px 10px 10px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      overflow: hidden;
      z-index: 110;
      box-shadow: 8px 0 28px rgba(15, 23, 42, 0.025);
      transition: padding 300ms cubic-bezier(.22, 1, .36, 1), box-shadow 300ms ease;
    }

    .side-nav__content {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: clip;
      scrollbar-width: thin;
      padding: 0 2px 12px;
    }

    .side-nav__identity {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      min-height: 62px;
      margin: 0 0 12px;
      padding: 10px;
      border: 1px solid color-mix(in srgb, var(--app-accent) 18%, var(--app-border));
      border-radius: 16px;
      background:
        linear-gradient(145deg, color-mix(in srgb, var(--app-accent) 9%, var(--app-surface-elevated)), var(--app-surface-elevated));
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.055);
      transition: min-height 260ms cubic-bezier(.22, 1, .36, 1), padding 260ms cubic-bezier(.22, 1, .36, 1), border-color 180ms ease, background 220ms ease, box-shadow 220ms ease;
    }

    .side-nav__identity--compact {
      min-height: 52px;
      grid-template-columns: 40px minmax(0, 0fr) 0;
      gap: 0;
      padding: 6px;
      border-color: transparent;
      background: transparent;
      box-shadow: none;
    }

    .side-nav__identity-mark {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 13px;
      color: #fff;
      background: linear-gradient(145deg, #0f9f96, #1967d2);
      box-shadow: 0 7px 16px rgba(15, 159, 150, 0.22);
    }

    .side-nav__identity-mark mat-icon { width: 20px; height: 20px; font-size: 20px; }
    .side-nav__identity-copy { min-width: 0; display: grid; gap: 2px; overflow: hidden; opacity: 1; transform: translateX(0); transition: opacity 140ms ease, transform 220ms cubic-bezier(.22, 1, .36, 1); }
    .side-nav__identity-copy small { color: var(--app-text-muted); font-size: 9px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
    .side-nav__identity-copy strong { overflow: hidden; color: color-mix(in srgb, var(--app-text) 80%, #64748b); font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .side-nav__identity-status { display: inline-flex; align-items: center; gap: 5px; overflow: hidden; color: #087e78; font-size: 9px; font-weight: 850; text-transform: uppercase; white-space: nowrap; opacity: 1; transition: opacity 120ms ease; }
    .side-nav__identity--compact .side-nav__identity-copy,
    .side-nav__identity--compact .side-nav__identity-status { opacity: 0; transform: translateX(-5px); pointer-events: none; }
    .side-nav__identity-status i { width: 6px; height: 6px; border-radius: 50%; background: #14b8a6; box-shadow: 0 0 0 4px rgba(20, 184, 166, .12); }

    .nav-group-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 8px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--app-text-muted);
      font-weight: 780;
      margin: 21px 10px 8px;
      max-height: 18px;
      overflow: hidden;
      opacity: 1;
      transform: translateY(0);
      transition: max-height 230ms cubic-bezier(.22, 1, .36, 1), margin 260ms cubic-bezier(.22, 1, .36, 1), opacity 130ms ease, transform 220ms cubic-bezier(.22, 1, .36, 1);
    }

    .nav-group-label i { flex: 1; height: 1px; background: linear-gradient(90deg, color-mix(in srgb, var(--app-text-muted) 16%, transparent), transparent); }

    .nav-group-label:first-child { margin-top: 2px; }

    .side-link {
      position: relative;
      min-height: 44px;
      justify-content: flex-start;
      align-items: center;
      border: 1px solid transparent;
      border-radius: 11px;
      color: #607086;
      display: inline-flex;
      gap: 8px;
      padding: 5px 9px;
      margin: 2px 0;
      width: 100%;
      transition: min-height 260ms cubic-bezier(.22, 1, .36, 1), padding 260ms cubic-bezier(.22, 1, .36, 1), border-color 180ms ease, background-color 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
    }

    .side-link:hover { border-color: transparent; background: color-mix(in srgb, var(--app-accent) 4%, var(--app-surface)); color: color-mix(in srgb, var(--app-text) 82%, #64748b); transform: none; }
    .side-link--compact:hover { transform: none; }

    :host ::ng-deep .side-link .mdc-button__label {
      width: 100%;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    :host ::ng-deep .side-link--compact .mdc-button__label { justify-content: center; gap: 0; }

    .side-link__icon {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      transition: transform var(--motion-fast) var(--ease-out), border-color var(--motion-fast) ease, background var(--motion-fast) ease;
    }

    .side-link__icon mat-icon {
      margin: 0;
      color: var(--app-text-muted);
      flex: 0 0 auto;
      width: 18px;
      height: 18px;
      font-size: 18px;
      transition: transform var(--motion-fast) var(--ease-out), color var(--motion-fast) ease;
    }
    .side-link:hover .side-link__icon { transform: none; }

    .side-link__copy { min-width: 0; max-width: 180px; display: grid; flex: 1; gap: 2px; overflow: hidden; text-align: left; opacity: 1; transform: translateX(0); transition: max-width 260ms cubic-bezier(.22, 1, .36, 1), opacity 130ms ease, transform 220ms cubic-bezier(.22, 1, .36, 1); }
    .side-link__copy strong { overflow: hidden; color: inherit; font-size: 12px; font-weight: 580; line-height: 1.2; letter-spacing: .004em; text-overflow: ellipsis; white-space: nowrap; }
    .side-link__copy small { display: none; overflow: hidden; color: var(--app-text-muted); font-size: 8px; font-weight: 600; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }

    .side-link--compact {
      justify-content: center;
      width: 100%;
      min-width: 0;
      min-height: 44px;
      margin: 1px 0;
      padding: 6px 0;
      box-sizing: border-box;
    }

    :host ::ng-deep .side-link--compact.mat-mdc-button {
      width: 100%;
      min-width: 0;
      max-width: none;
    }

    .side-link--compact .side-link__icon { width: 32px; height: 32px; transform: none; }
    .side-link--compact .side-link__copy { max-width: 0; flex: 0 1 0; opacity: 0; transform: translateX(-6px); pointer-events: none; }
    .shell-body--collapsed .nav-group-label { max-height: 0; margin-top: 3px; margin-bottom: 2px; opacity: 0; transform: translateY(-4px); }
    .shell-body--collapsed .side-nav { padding-inline: 10px; box-shadow: 7px 0 22px rgba(15, 23, 42, .035); }

    .side-link--compact.side-link--active {
      width: 100%;
      min-width: 0;
      max-width: none;
      min-height: 44px;
      margin: 2px 0;
      padding: 4px;
      border-radius: 11px;
    }

    .side-link--compact.side-link--active::before { display: none; }
    .side-link--compact.side-link--active .side-link__icon { width: 32px; height: 32px; }

    .theme-toggle-row {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
      min-height: 46px;
      padding: 6px 8px;
      border: 1px solid transparent;
      border-radius: 12px;
      background: color-mix(in srgb, var(--app-soft-surface) 62%, transparent);
      color: var(--app-text);
      box-shadow: none;
    }

    .theme-toggle-row__icon { width: 30px; max-width: 30px; height: 30px; display: grid; place-items: center; overflow: hidden; flex: 0 0 auto; border-radius: 9px; color: var(--app-accent); background: color-mix(in srgb, var(--app-accent) 8%, transparent); opacity: 1; transform: translateX(0); transition: max-width 240ms cubic-bezier(.22, 1, .36, 1), opacity 120ms ease, transform 220ms cubic-bezier(.22, 1, .36, 1); }
    .theme-toggle-row__icon mat-icon { width: 18px; height: 18px; font-size: 18px; }

    .theme-toggle-row--compact {
      justify-content: center;
      gap: 0;
      min-height: 48px;
      padding: 5px 0;
      border-color: transparent;
      background: transparent;
      box-shadow: none;
    }

    .theme-toggle-row__label {
      min-width: 0;
      display: grid;
      flex: 1;
      gap: 2px;
      white-space: nowrap;
      max-width: 150px;
      overflow: hidden;
      opacity: 1;
      transform: translateX(0);
      transition: max-width 250ms cubic-bezier(.22, 1, .36, 1), opacity 120ms ease, transform 220ms cubic-bezier(.22, 1, .36, 1);
    }

    .theme-toggle-row--compact .theme-toggle-row__icon,
    .theme-toggle-row--compact .theme-toggle-row__label { max-width: 0; flex-basis: 0; opacity: 0; transform: translateX(-5px); pointer-events: none; }
    .theme-toggle-row--compact .theme-toggle-row__switch { margin-inline: auto; }

    .shell-body:not(.shell-body--collapsed) .side-link__copy,
    .shell-body:not(.shell-body--collapsed) .side-nav__identity-copy,
    .shell-body:not(.shell-body--collapsed) .side-nav__identity-status,
    .shell-body:not(.shell-body--collapsed) .nav-group-label,
    .shell-body:not(.shell-body--collapsed) .theme-toggle-row__icon,
    .shell-body:not(.shell-body--collapsed) .theme-toggle-row__label { transition-delay: 70ms; }

    .theme-toggle-row__label strong { color: #40516a; font-size: 11px; font-weight: 650; }
    .theme-toggle-row__label small { display: none; }

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

    .theme-toggle-row--compact .theme-toggle-row__switch {
      margin-left: 0;
      width: 100%;
    }

    .theme-toggle-row--compact .theme-toggle-row__track {
      width: 38px;
    }

    .theme-toggle-row--compact .theme-toggle-row__thumb-icon {
      left: 4px;
    }

    .theme-toggle-row--compact .theme-toggle-row__thumb--dark {
      transform: translateX(16px);
    }

    .theme-toggle-row--compact .theme-toggle-row__track--dark .theme-toggle-row__thumb-icon {
      left: 22px;
    }

    .side-link--active {
      min-height: 44px;
      border-color: transparent;
      background: linear-gradient(90deg, color-mix(in srgb, #0f9f96 10%, var(--app-surface)), color-mix(in srgb, #2563eb 3%, var(--app-surface)));
      color: #087e78;
      box-shadow: none;
    }

    .side-link--active .side-link__icon {
      border-color: color-mix(in srgb, #0f9f96 32%, var(--app-border));
      background: color-mix(in srgb, #0f9f96 14%, var(--app-surface));
    }

    .side-link--active .side-link__icon mat-icon {
      color: #0f9f96;
    }

    .side-link--active .side-link__copy small { color: color-mix(in srgb, #087e78 58%, var(--app-text-muted)); }
    .side-link--active .side-link__copy small { display: none; }
    .side-link--active .side-link__copy strong { color: #087e78; font-weight: 680; }

    :host ::ng-deep .side-link--active .mdc-button__label::after {
      display: none;
    }

    :host ::ng-deep .side-link--active.side-link--compact .mdc-button__label::after { display: none; }

    .side-link--active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 10px;
      bottom: 10px;
      width: 3px;
      border-radius: 4px;
      background: #0f9f96;
      box-shadow: 0 0 9px rgba(15, 159, 150, 0.22);
    }

    .side-nav__footer {
      flex: 0 0 auto;
      display: grid;
      gap: 6px;
      margin-top: auto;
      padding: 8px 2px 0;
      border-top: 0;
      background: transparent;
    }

    .sidebar-credit {
      min-height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--app-text-muted);
      font-size: 9px;
      line-height: 1;
      text-align: center;
      text-decoration: none;
      letter-spacing: 0.03em;
    }

    .sidebar-credit:hover { color: #0f9f96; }

    .sidebar-credit--compact {
      width: 32px;
      min-height: 32px;
      margin: 0 auto;
      border-radius: 10px;
      background: color-mix(in srgb, var(--app-accent) 9%, transparent);
      color: var(--app-accent);
      font-size: 0;
    }

    .sidebar-credit--compact::after {
      content: 'WB';
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.04em;
    }

    :host-context(.theme-dark) .side-link { color: #9dabc0; }
    :host-context(.theme-dark) .side-link__copy strong,
    :host-context(.theme-dark) .theme-toggle-row__label strong { color: inherit; }
    :host-context(.theme-dark) .side-link--active .side-link__copy strong { color: #99f6e4; }
    :host-context(.theme-dark) .side-nav__identity {
      border-color: rgba(45, 212, 191, .18);
      background: linear-gradient(145deg, rgba(13, 148, 136, .12), rgba(17, 26, 47, .9));
      box-shadow: 0 10px 24px rgba(2, 6, 23, .22);
    }
    :host-context(.theme-dark) .side-nav__identity--compact { border-color: transparent; background: transparent; box-shadow: none; }
    :host-context(.theme-dark) .side-nav__identity-status { color: #5eead4; }
    :host-context(.theme-dark) .side-link__icon mat-icon { color: #94a3b8; }
    :host-context(.theme-dark) .side-link__icon { border-color: transparent; background: transparent; }
    :host-context(.theme-dark) .nav-group-label { color: #70829d; }
    :host-context(.theme-dark) .theme-toggle-row { color: #e2e8f0; background: rgba(15,23,42,.32); }
    :host-context(.theme-dark) .side-link--active {
      border-color: transparent;
      background: linear-gradient(90deg, rgba(20, 184, 166, .14), rgba(37, 99, 235, .045));
      color: #ccfbf1;
    }
    :host-context(.theme-dark) .side-link--active .side-link__icon { border-color: rgba(45, 212, 191, .28); background: rgba(13, 148, 136, .18); }
    :host-context(.theme-dark) .side-link--active .side-link__icon mat-icon { color: #2dd4bf; }
    :host-context(.theme-dark) .side-link--active .side-link__copy small { color: #99c8c6; }
    :host-context(.theme-dark) .theme-toggle-row { border-color: rgba(148, 163, 184, .18); background: rgba(17, 26, 47, .88); box-shadow: 0 8px 20px rgba(2, 6, 23, .2); }
    :host-context(.theme-dark) .theme-toggle-row--compact { border-color: transparent; background: transparent; box-shadow: none; }
    :host-context(.theme-dark) .sidebar-credit { color: #94a3b8; }

    .page-content {
      max-width: none;
      margin: 12px 0 20px;
      padding: 0 12px;
      width: 100%;
      color: var(--app-text);
    }
    .page-content > router-outlet + * {
      display: block;
      width: min(100%, 1920px);
      margin-inline: auto;
      animation: shell-page-enter 420ms var(--ease-out) both;
    }
    .page-content--landing > router-outlet + * {
      width: 100%;
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
    @keyframes shell-page-enter {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes scope-signal {
      0%, 100% { box-shadow: 0 0 0 4px rgba(94, 234, 212, 0.12); }
      50% { box-shadow: 0 0 0 7px rgba(94, 234, 212, 0.04), 0 0 12px rgba(94, 234, 212, .28); }
    }
    @keyframes command-panel-enter {
      from { opacity: 0; transform: translateY(-6px) scale(.99); }
      to { opacity: 1; transform: none; }
    }
    @media (max-width: 1240px) {
      .top-toolbar {
        grid-template-columns: minmax(220px, auto) minmax(300px, 1fr) minmax(230px, auto);
        gap: 12px;
      }
      .toolbar-context { display: none; }
    }
    @media (max-width: 980px) {
      .top-toolbar {
        grid-template-columns: minmax(185px, auto) minmax(230px, 1fr) auto;
        gap: 9px;
      }
      .scope-chip { display: none; }
    }
    @media (max-width: 768px) {
      .top-toolbar {
        height: 56px;
        min-height: 56px;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        padding: 0 8px;
      }
      .brand { font-size: 14px; gap: 6px; }
      .brand__mark { width: 28px; height: 28px; border-radius: 9px; }
      .toolbar-context,
      .scope-chip,
      .header-command,
      .quick-create { display: none; }

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
        width: min(90vw, 320px);
        padding: 14px 12px 10px;
        background:
          radial-gradient(circle at 0 0, color-mix(in srgb, var(--app-accent) 9%, transparent), transparent 34%),
          var(--app-surface);
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

      .side-nav__footer { padding-top: 10px; }
      .side-link { min-height: 56px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .scope-chip i, .page-content > router-outlet + * { animation: none; }
      .brand__mark, .profile-trigger span, .side-link, .side-link mat-icon { transition: none; }
      .app-boot__progress i { animation: none; width: 100%; }
      .header-command__panel { animation: none; }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  readonly navItems: ReadonlyArray<NavItem> = [
    { route: '/dashboard', label: 'Dashboard', description: 'Operational overview', icon: 'space_dashboard', capabilities: ['imports.view'] },
    { route: '/datasets', label: 'Datasets', description: 'Governed data catalogue', icon: 'dataset', capabilities: ['imports.view'] },
    { route: '/business-trace', label: 'Business trace', description: 'Published decision history', icon: 'manage_search', capabilities: ['imports.view'] },
    { route: '/uploads', label: 'Publications', description: 'Uploads and release records', icon: 'upload_file', capabilities: ['imports.view'] },
    { route: '/maintenance', label: 'Data maintenance', description: 'Requests, corrections and approvals', icon: 'edit_square', capabilities: ['imports.view'] }
  ];

  readonly adminNavItems: ReadonlyArray<NavItem> = [
    { route: '/admin/users', label: 'People', description: 'Accounts and assignments', icon: 'group', capabilities: ['users.manage', 'users.assign_roles'] },
    { route: '/admin/access-studio', label: 'Roles & access', description: 'Capabilities and controls', icon: 'admin_panel_settings', capabilities: ['roles.manage'] },
    { route: '/admin/activity', label: 'Activity', description: 'Audit and platform events', icon: 'timeline', capabilities: ['audit.view'] },
    { route: '/admin/maintenance', label: 'System', description: 'Platform health and tasks', icon: 'settings_suggest', capabilities: ['system.maintenance'] }
  ];

  readonly internalToolsNavItems: ReadonlyArray<NavItem> = [
    { route: '/internal-tools/evolis-decryptor', label: 'Evolis Decryptor', description: 'Secure internal utility', icon: 'lock_open' }
  ];

  readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly oauthService = inject(OAuthService);
  private readonly activityMonitorService = inject(ActivityMonitorService);
  private readonly themeService = inject(ThemeService);
  private routeSub: Subscription | null = null;
  navigationReady = false;
  isSidebarOpen = true;
  isMobileSidebarOpen = false;
  headerCommandOpen = false;
  headerQuery = '';

  get visibleWorkNavItems(): ReadonlyArray<NavItem> {
    return this.navItems.filter(item => item.capabilities?.every(capability => this.auth.hasCapability(capability)) ?? true);
  }

  get visibleAdminNavItems(): ReadonlyArray<NavItem> {
    return this.adminNavItems.filter(item => item.capabilities?.every(capability => this.auth.hasCapability(capability)) ?? true);
  }

  get headerCommands(): ReadonlyArray<HeaderCommand> {
    return [
      ...this.visibleWorkNavItems,
      ...this.visibleAdminNavItems,
      ...(this.auth.isInternalTools ? this.internalToolsNavItems : [])
    ];
  }

  get filteredHeaderCommands(): ReadonlyArray<HeaderCommand> {
    const query = this.headerQuery.trim().toLowerCase();
    const commands = query
      ? this.headerCommands.filter(command =>
          `${command.label} ${command.description}`.toLowerCase().includes(query))
      : this.headerCommands.filter(command =>
          ['/dashboard', '/uploads', '/business-trace', '/maintenance'].includes(command.route));

    return commands.slice(0, this.headerQuery ? 5 : 4);
  }

  get canUploadDataset(): boolean {
    return this.auth.hasCapability('imports.upload') && this.auth.hasCapability('imports.submit');
  }

  get canCreateMaintenance(): boolean {
    return this.auth.hasCapability('imports.upload')
      && this.auth.hasCapability('imports.correct_own')
      && this.auth.hasCapability('imports.submit');
  }

  get canCreateAnything(): boolean {
    return this.canUploadDataset || this.canCreateMaintenance || this.auth.hasCapability('imports.view');
  }

  get showSidebarLabels(): boolean {
    return this.isSidebarOpen || this.isMobile;
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

  get currentPageTitle(): string {
    const path = this.router.url.split('?')[0];
    if (path.startsWith('/import/')) return 'Upload details';
    if (path.startsWith('/maintenance/new')) return 'New maintenance request';
    if (/^\/maintenance\/(package|job)\//.test(path)) return 'Maintenance request';
    if (path.startsWith('/maintenance')) return 'Data maintenance';
    if (path.startsWith('/admin/access-studio')) return 'Roles & access';
    if (path.startsWith('/admin/users')) return 'People';
    if (path.startsWith('/admin/activity')) return 'Activity';
    if (path.startsWith('/admin/maintenance')) return 'System';
    if (path.startsWith('/internal-tools/evolis-decryptor')) return 'Evolis Decryptor';
    if (path.startsWith('/business-trace')) return 'Business trace';
    if (path.startsWith('/datasets')) return 'Datasets';
    if (path.startsWith('/uploads')) return 'Uploads';
    return 'Dashboard';
  }

  ngOnInit(): void {
    this.navigationReady = this.router.navigated;
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
        this.navigationReady = true;
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

  @HostListener('document:click')
  closeHeaderCommand(): void {
    this.headerCommandOpen = false;
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalShortcut(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && this.auth.isAuthenticated) {
      event.preventDefault();
      this.headerCommandOpen = true;
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>('.header-command__field input')?.focus();
      });
    }
  }

  setHeaderQuery(value: string): void {
    this.headerQuery = value;
    this.headerCommandOpen = true;
  }

  clearHeaderQuery(): void {
    this.headerQuery = '';
    this.headerCommandOpen = true;
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('.header-command__field input')?.focus();
    });
  }

  runPrimaryHeaderCommand(): void {
    if (this.headerQuery.trim()) {
      this.traceHeaderQuery();
      return;
    }

    this.headerCommandOpen = true;
  }

  traceHeaderQuery(): void {
    const identifier = this.headerQuery.trim();
    if (!identifier) return;

    this.closeAndResetHeader();
    void this.router.navigate(['/business-trace'], { queryParams: { identifier } });
  }

  searchUploadsFromHeader(): void {
    const query = this.headerQuery.trim();
    if (!query) return;

    this.closeAndResetHeader();
    void this.router.navigate(['/uploads'], { queryParams: { q: query } });
  }

  navigateHeaderCommand(route: string): void {
    this.closeAndResetHeader();
    void this.router.navigateByUrl(route);
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

  private closeAndResetHeader(): void {
    this.headerCommandOpen = false;
    this.headerQuery = '';
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
