import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { Notification, NotificationType } from '../../core/models/notification.models';
import { AuthFacade } from '../../core/auth/auth.facade';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [
    CommonModule, DatePipe, MatIconModule, MatButtonModule, MatMenuModule,
    MatBadgeModule, MatDividerModule, MatListModule, MatTooltipModule
  ],
  template: `
    <button 
      mat-icon-button 
      [matMenuTriggerFor]="notificationMenu"
      matTooltip="Notifications"
      class="notification-button"
      aria-label="Open notifications">
      <span
        class="notification-anchor"
        [matBadge]="unreadCount$ | async"
        matBadgeColor="warn"
        [matBadgeHidden]="(unreadCount$ | async) === 0"
        aria-hidden="false">
        <mat-icon>notifications</mat-icon>
      </span>
    </button>

    <mat-menu #notificationMenu="matMenu" class="notification-menu-panel">
      <div class="notification-shell">
        <div class="notification-header">
          <div class="header-identity">
            <span class="header-mark"><mat-icon>notifications_active</mat-icon></span>
            <span>
              <strong>Activity inbox</strong>
              <small>Updates that need your awareness</small>
            </span>
          </div>
          <span class="unread-summary" [class.unread-summary--clear]="(unreadCount$ | async) === 0">
            {{ unreadCount$ | async }} unread
          </span>
        </div>

        <div class="notification-toolbar">
          <strong>Recent updates</strong>
          <button mat-button type="button" *ngIf="(unreadCount$ | async) as unreadCount" (click)="markAllAsRead($event)" class="header-action">
            <mat-icon>done_all</mat-icon> Mark all read
          </button>
        </div>

        <div class="notification-list" *ngIf="notifications$ | async as notifications">
          <div *ngIf="notifications.length === 0" class="empty-state">
            <div class="empty-icon">
              <mat-icon>inbox</mat-icon>
            </div>
            <div class="empty-copy">
              <strong>No notifications yet</strong>
              <span>New activity will appear here as it happens.</span>
            </div>
          </div>

          <div 
            role="button"
            tabindex="0"
            *ngFor="let notification of notifications" 
            class="notification-item" 
            [class.unread]="!notification.isRead"
            (click)="onNotificationClick(notification)"
            (keydown.enter)="onNotificationClick(notification)">
            <span class="unread-indicator" *ngIf="!notification.isRead" aria-label="Unread"></span>
            <div class="notification-icon" [ngClass]="getNotificationToneClass(notification)">
              <mat-icon>{{ getNotificationIcon(notification) }}</mat-icon>
            </div>

            <div class="notification-content">
              <div class="notification-title">{{ notification.title }}</div>
              <div class="notification-message">{{ notification.message }}</div>

              <div class="notification-meta">
                <span class="notification-type">{{ getNotificationTypeLabel(notification) }}</span>
                <span class="notification-dot"></span>
                <span class="notification-time">{{ notification.createdAt | date:'short' }}</span>
                <span class="notification-state" *ngIf="!notification.isRead">New</span>
              </div>
            </div>

            <button 
              mat-icon-button 
              (click)="deleteNotification($event, notification.id)"
              class="delete-btn"
              matTooltip="Delete">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>
        <div class="notification-footnote"><mat-icon>shield</mat-icon> Only activity relevant to your access is shown.</div>
      </div>
    </mat-menu>
  `,
  styles: [`
    :host { display: flex; align-items: center; height: 40px; }
    .notification-button { position: relative; width: 40px; height: 40px; padding: 0; display: grid; place-items: center; }
    .notification-anchor {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 1px solid rgba(255, 255, 255, 0.42);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.16);
      line-height: 1;
    }
    .notification-anchor mat-icon { width: 19px; height: 19px; font-size: 19px; }
    .notification-shell {
      display: grid;
      padding: 16px;
      color: var(--app-text);
    }
    .notification-header { 
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      padding-bottom: 15px; border-bottom: 1px solid var(--app-border);
    }
    .header-identity { display: flex; align-items: center; min-width: 0; gap: 11px; }
    .header-identity > span:last-child { display: flex; min-width: 0; flex-direction: column; }
    .header-identity strong { font-size: 16px; line-height: 1.2; }
    .header-identity small { margin-top: 3px; color: var(--app-text-muted); font-size: 11px; }
    .header-mark { width: 38px; height: 38px; display: grid; flex: 0 0 auto; place-items: center; border-radius: 12px; background: color-mix(in srgb, var(--app-accent) 12%, var(--app-surface)); color: var(--app-accent); }
    .header-mark mat-icon { width: 20px; height: 20px; font-size: 20px; }
    .unread-summary { padding: 6px 9px; border: 1px solid color-mix(in srgb, var(--app-accent) 30%, var(--app-border)); border-radius: 999px; background: color-mix(in srgb, var(--app-accent) 8%, var(--app-surface)); color: var(--app-accent); font-size: 10px; font-weight: 900; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.04em; }
    .unread-summary--clear { border-color: var(--app-border); background: transparent; color: var(--app-text-muted); }
    .notification-toolbar { display: flex; min-height: 47px; align-items: center; justify-content: space-between; gap: 10px; }
    .notification-toolbar > strong { color: var(--app-text-muted); font-size: 10px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
    .header-action { color: var(--app-accent); font-size: 11px; font-weight: 850; }
    .header-action mat-icon { width: 17px; height: 17px; margin-right: 3px; font-size: 17px; }
    .notification-list { max-height: min(470px, calc(100vh - 190px)); overflow-y: auto; display: grid; gap: 8px; padding: 0 3px 2px 0; scrollbar-width: thin; scrollbar-color: rgba(148, 163, 184, 0.7) transparent; }
    .notification-list::-webkit-scrollbar { width: 8px; }
    .notification-list::-webkit-scrollbar-track { background: transparent; }
    .notification-list::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.45);
      border-radius: 999px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    .notification-list::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.68); background-clip: padding-box; }
    .empty-state { 
      padding: 22px 14px 24px; text-align: center; color: rgba(0,0,0,0.54);
      display: grid; justify-items: center; gap: 10px;
    }
    .empty-icon {
      width: 40px;
      height: 40px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: rgba(37, 99, 235, 0.08);
      color: #2563eb;
    }
    .empty-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .empty-copy { display: grid; gap: 4px; }
    .empty-copy strong { font-size: 14px; color: #0f172a; }
    .empty-copy span { font-size: 12px; color: #64748b; }
    .notification-item { 
      padding: 12px 10px 12px 13px; border: 1px solid rgba(226, 232, 240, 0.95); border-radius: 14px; cursor: pointer;
      display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 11px; align-items: start;
      transition: background 0.2s, border-color 0.2s, transform 0.2s; position: relative;
      background: var(--app-surface);
      border-color: var(--app-border);
      box-shadow: none;
      text-align: left;
    }
    .notification-item:hover { transform: translateY(-1px); background: color-mix(in srgb, var(--app-accent) 3%, var(--app-surface)); border-color: color-mix(in srgb, var(--app-accent) 25%, var(--app-border)); }
    .notification-item.unread { border-color: color-mix(in srgb, var(--app-accent) 24%, var(--app-border)); background: color-mix(in srgb, var(--app-accent) 4%, var(--app-surface)); }
    .unread-indicator { position: absolute; top: 15px; left: -4px; width: 7px; height: 7px; border: 2px solid var(--app-surface); border-radius: 50%; background: var(--app-accent); box-sizing: content-box; }
    .notification-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: rgba(37, 99, 235, 0.10);
      color: var(--app-accent);
      flex-shrink: 0;
    }
    .notification-icon.toast-success { background: rgba(16, 185, 129, 0.12); color: #059669; }
    .notification-icon.toast-warning { background: rgba(245, 158, 11, 0.12); color: #d97706; }
    .notification-icon.toast-danger { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
    .notification-icon mat-icon { font-size: 19px; width: 19px; height: 19px; }
    .notification-content { min-width: 0; display: grid; gap: 4px; padding-top: 1px; }
    .notification-title { font-weight: 850; font-size: 13px; color: var(--app-text); line-height: 1.25; }
    .notification-message { font-size: 11.5px; color: var(--app-text-muted); line-height: 1.42; word-break: break-word; }
    .notification-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 2px; font-size: 9.5px; font-weight: 800; color: var(--app-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .notification-type { color: var(--app-accent); }
    .notification-dot { width: 4px; height: 4px; border-radius: 999px; background: #cbd5e1; }
    .notification-state { margin-left: auto; padding: 3px 6px; border-radius: 999px; background: color-mix(in srgb, var(--app-accent) 10%, var(--app-surface)); color: var(--app-accent); }
    .notification-time { flex-shrink: 0; font-size: 10px; color: var(--app-text-muted); white-space: nowrap; text-transform: none; letter-spacing: 0; }
    .delete-btn { flex-shrink: 0; margin-top: -4px; color: var(--app-text-muted); width: 30px; height: 30px; }
    .delete-btn:hover { color: #dc2626; }
    .notification-item.unread .notification-title { color: var(--app-text); }
    .notification-item.unread .notification-message { color: var(--app-text); }
    .notification-item.unread .notification-time { color: var(--app-text-muted); }
    .notification-item.unread .notification-state { color: var(--app-accent); }
    .notification-footnote { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px 4px 0; color: var(--app-text-muted); font-size: 10px; }
    .notification-footnote mat-icon { width: 14px; height: 14px; font-size: 14px; }

    @media (max-width: 520px) {
      .notification-shell { padding: 14px; }
      .notification-header { align-items: flex-start; }
      .header-identity small { max-width: 175px; }
      .notification-list { max-height: calc(100vh - 205px); }
      .notification-item { grid-template-columns: 34px minmax(0, 1fr) auto; gap: 9px; padding-inline: 11px 7px; }
      .notification-icon { width: 34px; height: 34px; border-radius: 10px; }
      .notification-message { font-size: 11px; }
      .notification-state { display: none; }
    }

    :host-context(html.theme-dark) .notification-shell {
      background: transparent;
    }

    :host-context(html.theme-dark) .notification-menu-panel,
    :host-context(html.theme-dark) .notification-menu-panel .mdc-menu-surface {
      background: linear-gradient(180deg, rgba(10, 15, 28, 0.99), rgba(7, 11, 22, 0.99)) !important;
      border: 1px solid rgba(126, 162, 255, 0.20) !important;
      box-shadow: 0 26px 62px rgba(0, 0, 0, 0.60), 0 8px 18px rgba(0, 0, 0, 0.40) !important;
    }

    :host-context(html.theme-dark) .notification-header {
      color: var(--app-text);
    }

    :host-context(html.theme-dark) .header-subtitle,
    :host-context(html.theme-dark) .notification-time,
    :host-context(html.theme-dark) .notification-state,
    :host-context(html.theme-dark) .empty-copy span {
      color: #94a3b8;
    }

    :host-context(html.theme-dark) .header-action,
    :host-context(html.theme-dark) .notification-type {
      color: var(--app-accent);
    }

    :host-context(html.theme-dark) .notification-item {
      background: var(--app-surface-elevated) !important;
      border-color: var(--app-border) !important;
    }

    :host-context(html.theme-dark) .notification-item:hover {
      background: rgba(15, 23, 42, 0.86) !important;
      border-color: rgba(126, 162, 255, 0.26) !important;
    }

    :host-context(html.theme-dark) .notification-icon {
      background: rgba(126, 162, 255, 0.12);
      color: #93c5fd;
    }

    :host-context(html.theme-dark) .notification-icon.toast-success {
      background: rgba(34, 197, 94, 0.18);
      color: #86efac;
    }

    :host-context(html.theme-dark) .notification-icon.toast-warning {
      background: rgba(245, 158, 11, 0.18);
      color: #fcd34d;
    }

    :host-context(html.theme-dark) .notification-icon.toast-danger {
      background: rgba(239, 68, 68, 0.18);
      color: #fca5a5;
    }

    :host-context(html.theme-dark) .notification-title {
      color: var(--app-text);
    }

    :host-context(html.theme-dark) .notification-message {
      color: var(--app-text-muted);
    }

    :host-context(html.theme-dark) .notification-dot {
      background: #64748b;
    }

    :host-context(html.theme-dark) .delete-btn {
      color: #94a3b8;
    }

    :host-context(html.theme-dark) .delete-btn:hover {
      color: #fca5a5;
    }

    :host-context(html.theme-dark) .empty-state {
      color: #94a3b8;
    }

    :host-context(html.theme-dark) .empty-icon {
      background: rgba(126, 162, 255, 0.14);
      color: #93c5fd;
    }

    :host-context(html.theme-dark) .notification-list {
      scrollbar-color: rgba(126, 162, 255, 0.5) transparent;
    }

    :host-context(html.theme-dark) .notification-list::-webkit-scrollbar-thumb {
      background: rgba(126, 162, 255, 0.42);
    }

    :host-context(html.theme-dark) .notification-list::-webkit-scrollbar-thumb:hover {
      background: rgba(126, 162, 255, 0.64);
      background-clip: padding-box;
    }
  `]
})
export class NotificationCenterComponent implements OnInit, OnDestroy {
  @ViewChild(MatMenuTrigger) private menuTrigger?: MatMenuTrigger;

  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthFacade);
  private readonly destroy$ = new Subject<void>();

  notifications$ = this.notificationService.notifications$;
  unreadCount$ = this.notificationService.unreadCount$;

  getNotificationIcon(notification: Notification): string {
    switch (notification.notificationType) {
      case NotificationType.UserPendingApproval:
        return 'person_alert';
      case NotificationType.ImportApproved:
      case NotificationType.ImportCommitted:
      case NotificationType.UserApproved:
        return 'task_alt';
      case NotificationType.ImportRejected:
      case NotificationType.ImportFailed:
      case NotificationType.UserDeleted:
        return 'error_outline';
      case NotificationType.ImportNeedsCorrection:
      case NotificationType.UserRoleChanged:
        return 'rule';
      default:
        return 'notifications_active';
    }
  }

  getNotificationToneClass(notification: Notification): string {
    switch (notification.notificationType) {
      case NotificationType.ImportApproved:
      case NotificationType.ImportCommitted:
      case NotificationType.UserApproved:
        return 'toast-success';
      case NotificationType.ImportRejected:
      case NotificationType.ImportFailed:
      case NotificationType.UserDeleted:
        return 'toast-danger';
      case NotificationType.ImportNeedsCorrection:
      case NotificationType.UserRoleChanged:
        return 'toast-warning';
      case NotificationType.UserPendingApproval:
      default:
        return 'toast-approval';
    }
  }

  getNotificationTypeLabel(notification: Notification): string {
    switch (notification.notificationType) {
      case NotificationType.UserPendingApproval:
        return 'Approval';
      case NotificationType.ImportUploaded:
        return 'Import';
      case NotificationType.ImportRejected:
      case NotificationType.ImportFailed:
      case NotificationType.ImportNeedsCorrection:
        return 'Attention';
      case NotificationType.ImportApproved:
      case NotificationType.ImportCommitted:
        return 'Completed';
      case NotificationType.UserApproved:
      case NotificationType.UserRoleChanged:
      case NotificationType.UserDeleted:
        return 'User';
      default:
        return 'Update';
    }
  }

  ngOnInit() {
    this.notificationService.startPolling();
    this.notificationService.getNotifications();
  }

  ngOnDestroy() {
    this.notificationService.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  onNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    }

    const route = this.resolveNotificationRoute(notification);
    this.menuTrigger?.closeMenu();

    if (route) {
      this.router.navigate(route);
    }
  }

  private resolveNotificationRoute(notification: Notification): string[] | null {
    if (notification.relatedImportId) {
      return ['/import', notification.relatedImportId];
    }

    switch (notification.notificationType) {
      case NotificationType.UserPendingApproval:
        return this.auth.hasCapability('users.manage') && this.auth.hasCapability('users.assign_roles') ? ['/admin/users'] : ['/dashboard'];

      case NotificationType.UserApproved:
      case NotificationType.UserRoleChanged:
      case NotificationType.UserDeleted:
        return ['/dashboard'];

      case NotificationType.ImportUploaded:
      case NotificationType.ImportRejected:
      case NotificationType.ImportApproved:
      case NotificationType.ImportCommitted:
      case NotificationType.ImportFailed:
      case NotificationType.ImportNeedsCorrection:
        return ['/uploads'];

      default:
        return ['/dashboard'];
    }
  }

  markAllAsRead(e: Event) {
    e.stopPropagation();
    this.notificationService.markAllAsRead()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  deleteNotification(e: Event, notificationId: string) {
    e.stopPropagation();
    this.notificationService.deleteNotification(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }
}
