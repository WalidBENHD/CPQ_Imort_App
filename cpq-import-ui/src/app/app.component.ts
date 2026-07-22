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

type NavItem = {
  route: string;
  label: string;
  description: string;
  icon: string;
  capabilities?: string[];
  exact?: boolean;
};

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
          <span class="brand__mark"><mat-icon>cloud_upload</mat-icon></span>
          <span class="brand__name">CPQ Platform</span>
        </span>

        <span class="toolbar-context" *ngIf="auth.isAuthenticated">
          <span class="toolbar-context__divider"></span>
          <span class="toolbar-context__page">{{ currentPageTitle }}</span>
        </span>

        <span class="spacer"></span>

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
      </mat-toolbar>

      <div class="shell-body" [class.shell-body--collapsed]="!isSidebarOpen" [class.shell-body--mobile-open]="isMobileSidebarOpen">
        <aside class="side-nav" *ngIf="auth.isAuthenticated" aria-label="Primary navigation">
          <div class="side-nav__content">
          <div class="side-nav__identity" [class.side-nav__identity--compact]="!showSidebarLabels">
            <span class="side-nav__identity-mark"><mat-icon>hub</mat-icon></span>
            <span class="side-nav__identity-copy" *ngIf="showSidebarLabels">
              <small>Governed workspace</small>
              <strong>Saint-Marcellin PDU</strong>
            </span>
            <span class="side-nav__identity-status" *ngIf="showSidebarLabels"><i></i> Live</span>
          </div>

          <ng-container *ngIf="visibleWorkNavItems.length">
            <div class="nav-group-label" *ngIf="showSidebarLabels"><span>Workspace</span><i></i></div>

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
              <span class="side-link__copy" *ngIf="showSidebarLabels"><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
            </a>
          </ng-container>

          <ng-container *ngIf="auth.isInternalTools">
            <div class="nav-group-label" *ngIf="showSidebarLabels"><span>Specialist tools</span><i></i></div>

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
              <span class="side-link__copy" *ngIf="showSidebarLabels"><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
            </a>
          </ng-container>

          <ng-container *ngIf="visibleAdminNavItems.length">
            <div class="nav-group-label" *ngIf="showSidebarLabels"><span>Administration</span><i></i></div>

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
              <span class="side-link__copy" *ngIf="showSidebarLabels"><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
            </a>
          </ng-container>
          </div>

          <div class="side-nav__footer">
          <div class="theme-toggle-row" [class.theme-toggle-row--compact]="!showSidebarLabels">
            <span class="theme-toggle-row__icon" *ngIf="showSidebarLabels"><mat-icon>{{ isDarkTheme ? 'dark_mode' : 'light_mode' }}</mat-icon></span>
            <span *ngIf="showSidebarLabels" class="theme-toggle-row__label"><strong>{{ themeLabel }}</strong><small>Interface appearance</small></span>

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
      height: 58px;
      min-height: 58px;
      padding: 0 18px;
      box-shadow: 0 5px 18px rgba(15, 23, 42, 0.14);
      background: linear-gradient(110deg, #243c9b 0%, #3b59c5 58%, #2948aa 100%);
      color: var(--app-toolbar-text);
      border-bottom: 1px solid rgba(255, 255, 255, 0.16);
    }
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
    .spacer { flex: 1; }
    .scope-chip {
      min-height: 30px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-right: 12px;
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
      grid-template-columns: 276px minmax(0, 1fr);
      align-items: start;
      min-height: calc(100vh - 58px);
      transition: grid-template-columns 180ms ease;
    }
    .shell-body--collapsed {
      grid-template-columns: 80px minmax(0, 1fr);
    }

    .side-nav {
      position: sticky;
      top: 58px;
      height: calc(100vh - 58px);
      border-right: 1px solid var(--app-border);
      background:
        radial-gradient(circle at 0 0, color-mix(in srgb, var(--app-accent) 9%, transparent), transparent 34%),
        linear-gradient(180deg, var(--app-sidebar-bg), color-mix(in srgb, var(--app-sidebar-bg) 92%, var(--app-background)));
      padding: 12px 11px 10px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      overflow: hidden;
      z-index: 110;
      box-shadow: 12px 0 34px rgba(15, 23, 42, 0.04);
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
    }

    .side-nav__identity--compact {
      display: flex;
      justify-content: center;
      min-height: 52px;
      padding: 6px 0;
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
    .side-nav__identity-copy { min-width: 0; display: grid; gap: 2px; }
    .side-nav__identity-copy small { color: var(--app-text-muted); font-size: 9px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
    .side-nav__identity-copy strong { overflow: hidden; color: var(--app-text); font-size: 12px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
    .side-nav__identity-status { display: inline-flex; align-items: center; gap: 5px; color: #087e78; font-size: 9px; font-weight: 850; text-transform: uppercase; }
    .side-nav__identity-status i { width: 6px; height: 6px; border-radius: 50%; background: #14b8a6; box-shadow: 0 0 0 4px rgba(20, 184, 166, .12); }

    .nav-group-label {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 10px;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      color: var(--app-text-muted);
      font-weight: 800;
      margin: 16px 9px 6px;
    }

    .nav-group-label i { flex: 1; height: 1px; background: linear-gradient(90deg, var(--app-border), transparent); }

    .nav-group-label:first-child { margin-top: 2px; }

    .side-link {
      position: relative;
      min-height: 54px;
      justify-content: flex-start;
      align-items: center;
      border: 1px solid transparent;
      border-radius: 14px;
      color: var(--app-text);
      display: inline-flex;
      gap: 10px;
      padding: 6px 9px;
      margin: 3px 0;
      width: 100%;
      transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
    }

    .side-link:hover { border-color: color-mix(in srgb, var(--app-accent) 15%, var(--app-border)); background: color-mix(in srgb, var(--app-accent) 6%, var(--app-surface)); transform: translateX(2px); }
    .side-link--compact:hover { transform: none; }

    :host ::ng-deep .side-link .mdc-button__label {
      width: 100%;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    :host ::ng-deep .side-link--compact .mdc-button__label { justify-content: center; }

    .side-link__icon {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      border: 1px solid color-mix(in srgb, var(--app-text-muted) 12%, var(--app-border));
      border-radius: 11px;
      background: color-mix(in srgb, var(--app-soft-surface) 82%, transparent);
      transition: transform var(--motion-fast) var(--ease-out), border-color var(--motion-fast) ease, background var(--motion-fast) ease;
    }

    .side-link__icon mat-icon {
      margin: 0;
      color: var(--app-text-muted);
      flex: 0 0 auto;
      width: 19px;
      height: 19px;
      font-size: 19px;
      transition: transform var(--motion-fast) var(--ease-out), color var(--motion-fast) ease;
    }
    .side-link:hover .side-link__icon { transform: scale(1.04); }

    .side-link__copy { min-width: 0; display: grid; flex: 1; gap: 2px; text-align: left; }
    .side-link__copy strong { overflow: hidden; font-size: 13px; font-weight: 800; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
    .side-link__copy small { overflow: hidden; color: var(--app-text-muted); font-size: 9px; font-weight: 600; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }

    .side-link--compact {
      justify-content: center;
      min-height: 50px;
      padding: 6px 0;
    }

    .side-link--compact .side-link__icon { width: 38px; height: 38px; }

    .theme-toggle-row {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
      min-height: 54px;
      padding: 7px 9px;
      border: 1px solid var(--app-border);
      border-radius: 14px;
      background: var(--app-surface-elevated);
      color: var(--app-text);
      box-shadow: 0 6px 18px rgba(15, 23, 42, .04);
    }

    .theme-toggle-row__icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; color: var(--app-accent); background: color-mix(in srgb, var(--app-accent) 9%, var(--app-soft-surface)); }
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
    }

    .theme-toggle-row__label strong { font-size: 12px; font-weight: 800; }
    .theme-toggle-row__label small { color: var(--app-text-muted); font-size: 9px; }

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
      border-color: color-mix(in srgb, #0f9f96 28%, var(--app-border));
      background: linear-gradient(100deg, color-mix(in srgb, #0f9f96 13%, var(--app-surface)), color-mix(in srgb, #2563eb 6%, var(--app-surface)));
      color: color-mix(in srgb, #087e78 88%, var(--app-text));
      box-shadow: 0 7px 18px rgba(15, 159, 150, .09);
    }

    .side-link--active .side-link__icon {
      border-color: color-mix(in srgb, #0f9f96 32%, var(--app-border));
      background: color-mix(in srgb, #0f9f96 14%, var(--app-surface));
    }

    .side-link--active .side-link__icon mat-icon {
      color: #0f9f96;
    }

    .side-link--active .side-link__copy small { color: color-mix(in srgb, #087e78 58%, var(--app-text-muted)); }

    :host ::ng-deep .side-link--active .mdc-button__label::after {
      content: '';
      width: 6px;
      height: 6px;
      margin: 0 3px 0 auto;
      border-right: 2px solid #0f9f96;
      border-bottom: 2px solid #0f9f96;
      transform: rotate(-45deg);
    }

    :host ::ng-deep .side-link--active.side-link--compact .mdc-button__label::after { display: none; }

    .side-link--active::before {
      content: '';
      position: absolute;
      left: -4px;
      top: 14px;
      bottom: 14px;
      width: 3px;
      border-radius: 4px;
      background: #0f9f96;
      box-shadow: 0 0 12px rgba(15, 159, 150, 0.3);
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
      min-height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--app-text-muted);
      font-size: 10px;
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

    :host-context(.theme-dark) .side-link { color: #e2e8f0; }
    :host-context(.theme-dark) .side-nav__identity {
      border-color: rgba(45, 212, 191, .18);
      background: linear-gradient(145deg, rgba(13, 148, 136, .12), rgba(17, 26, 47, .9));
      box-shadow: 0 10px 24px rgba(2, 6, 23, .22);
    }
    :host-context(.theme-dark) .side-nav__identity--compact { border-color: transparent; background: transparent; box-shadow: none; }
    :host-context(.theme-dark) .side-nav__identity-status { color: #5eead4; }
    :host-context(.theme-dark) .side-link__icon mat-icon { color: #94a3b8; }
    :host-context(.theme-dark) .side-link__icon { border-color: rgba(148, 163, 184, .14); background: rgba(15, 23, 42, .48); }
    :host-context(.theme-dark) .nav-group-label { color: #8fa2bd; }
    :host-context(.theme-dark) .theme-toggle-row { color: #e2e8f0; }
    :host-context(.theme-dark) .side-link--active {
      border-color: rgba(45, 212, 191, .25);
      background: rgba(20, 184, 166, 0.16);
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
    @media (max-width: 768px) {
      .top-toolbar { height: 56px; min-height: 56px; padding: 0 8px; }
      .brand { font-size: 14px; gap: 6px; }
      .brand__mark { width: 28px; height: 28px; border-radius: 9px; }
      .toolbar-context,
      .scope-chip { display: none; }

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
  isSidebarOpen = true;
  isMobileSidebarOpen = false;

  get visibleWorkNavItems(): ReadonlyArray<NavItem> {
    return this.navItems.filter(item => item.capabilities?.every(capability => this.auth.hasCapability(capability)) ?? true);
  }

  get visibleAdminNavItems(): ReadonlyArray<NavItem> {
    return this.adminNavItems.filter(item => item.capabilities?.every(capability => this.auth.hasCapability(capability)) ?? true);
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
