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
      class="notification-button">
      <span
        class="notification-anchor"
        [matBadge]="unreadCount$ | async"
        matBadgeColor="warn"
        [matBadgeHidden]="(unreadCount$ | async) === 0"
        aria-hidden="false">
        <mat-icon>notifications</mat-icon>
      </span>
    </button>

    <mat-menu #notificationMenu="matMenu" class="notification-menu" panelClass="notification-menu-panel">
      <div class="notification-shell">
        <div class="notification-header">
          <div>
            <div class="header-title">Notifications</div>
            <div class="header-subtitle">
              {{ unreadCount$ | async }} unread
            </div>
          </div>

          <button 
            mat-icon-button 
            *ngIf="(unreadCount$ | async) as unreadCount; else noUnread"
            [hidden]="!unreadCount"
            (click)="markAllAsRead($event)" 
            matTooltip="Mark all as read"
            class="header-action">
            <mat-icon>done_all</mat-icon>
          </button>
          <ng-template #noUnread></ng-template>
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
            (click)="onNotificationClick(notification)">
            <div class="notification-icon" [ngClass]="getNotificationToneClass(notification)">
              <mat-icon>{{ getNotificationIcon(notification) }}</mat-icon>
            </div>

            <div class="notification-content">
              <div class="notification-title">{{ notification.title }}</div>
              <div class="notification-message">{{ notification.message }}</div>

              <div class="notification-meta">
                <span class="notification-type">{{ getNotificationTypeLabel(notification) }}</span>
                <span class="notification-dot"></span>
                <span class="notification-state">{{ notification.isRead ? 'Read' : 'New' }}</span>
                <span class="notification-dot"></span>
                <span class="notification-time">{{ notification.createdAt | date:'short' }}</span>
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
      </div>
    </mat-menu>
  `,
  styles: [`
    .notification-button { position: relative; }
    .notification-anchor {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      line-height: 1;
    }
    .notification-menu { min-width: 480px !important; max-width: 480px !important; }
    .notification-menu-panel { width: clamp(480px, 52vw, 680px); }
    .notification-shell {
      display: grid;
      gap: 6px;
      padding: 6px;
    }
    .notification-header { 
      display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
      padding: 10px 10px 4px; font-weight: 600; font-size: 14px;
    }
    .header-title { flex: 1; font-size: 14px; font-weight: 800; }
    .header-subtitle { margin-top: 3px; color: #64748b; font-size: 12px; font-weight: 600; }
    .header-action { color: var(--app-accent); }
    .notification-list { max-height: 500px; overflow-y: auto; display: grid; gap: 4px; padding: 0 1px 2px; scrollbar-width: thin; scrollbar-color: rgba(148, 163, 184, 0.7) transparent; }
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
      padding: 10px 10px 10px 12px; border: 1px solid rgba(226, 232, 240, 0.95); border-radius: 14px; cursor: pointer;
      display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 10px; align-items: start;
      transition: background 0.2s, border-color 0.2s, transform 0.2s; position: relative;
      background: var(--app-surface-elevated);
      border-color: var(--app-border);
      box-shadow: none;
      text-align: left;
    }
    .notification-item:hover { background: var(--app-soft-surface); border-color: rgba(148, 163, 184, 0.38); }
    .notification-item.unread { border-color: rgba(37, 99, 235, 0.20); }
    .notification-icon {
      width: 28px;
      height: 28px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: rgba(37, 99, 235, 0.10);
      color: var(--app-accent);
      flex-shrink: 0;
    }
    .notification-icon.toast-success { background: rgba(16, 185, 129, 0.12); color: #059669; }
    .notification-icon.toast-warning { background: rgba(245, 158, 11, 0.12); color: #d97706; }
    .notification-icon.toast-danger { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
    .notification-icon mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .notification-content { min-width: 0; display: grid; gap: 2px; }
    .notification-title { font-weight: 800; font-size: 12.25px; color: var(--app-text); line-height: 1.22; }
    .notification-message { font-size: 11.25px; color: var(--app-text-muted); line-height: 1.32; word-break: break-word; }
    .notification-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; color: var(--app-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .notification-type { color: var(--app-accent); }
    .notification-dot { width: 4px; height: 4px; border-radius: 999px; background: #cbd5e1; }
    .notification-state { color: var(--app-text-muted); }
    .notification-time { flex-shrink: 0; font-size: 10px; color: var(--app-text-muted); white-space: nowrap; text-transform: none; letter-spacing: 0; }
    .delete-btn { flex-shrink: 0; margin-top: -2px; color: var(--app-text-muted); width: 28px; height: 28px; }
    .delete-btn:hover { color: #dc2626; }
    .notification-item.unread .notification-title { color: var(--app-text); }
    .notification-item.unread .notification-message { color: var(--app-text); }
    .notification-item.unread .notification-time { color: var(--app-text-muted); }
    .notification-item.unread .notification-state { color: var(--app-accent); }

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
