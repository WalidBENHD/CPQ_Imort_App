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

    <mat-menu #notificationMenu="matMenu" class="notification-menu">
      <div class="notification-header">
        <span class="header-title">Notifications</span>
        <button 
          mat-icon-button 
          *ngIf="(unreadCount$ | async) as unreadCount; else noUnread"
          [hidden]="!unreadCount"
          (click)="markAllAsRead($event)" 
          matTooltip="Mark all as read">
          <mat-icon style="font-size: 18px; width: 18px; height: 18px;">done_all</mat-icon>
        </button>
        <ng-template #noUnread></ng-template>
      </div>

      <mat-divider></mat-divider>

      <div class="notification-list" *ngIf="notifications$ | async as notifications">
        <div *ngIf="notifications.length === 0" class="empty-state">
          <mat-icon>inbox</mat-icon>
          <p>No notifications yet</p>
        </div>

        <div *ngFor="let notification of notifications" 
          class="notification-item" 
          [class.unread]="!notification.isRead"
          (click)="onNotificationClick(notification)">
          <div class="notification-content">
            <div class="notification-title">{{ notification.title }}</div>
            <div class="notification-message">{{ notification.message }}</div>
            <div class="notification-time">{{ notification.createdAt | date:'short' }}</div>
          </div>
          <button 
            mat-icon-button 
            (click)="deleteNotification($event, notification.id)"
            class="delete-btn"
            matTooltip="Delete">
            <mat-icon style="font-size: 16px; width: 16px; height: 16px;">close</mat-icon>
          </button>
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
    .notification-menu { min-width: 360px !important; max-width: 360px !important; }
    .notification-header { 
      display: flex; justify-content: space-between; align-items: center; 
      padding: 12px 16px; font-weight: 600; font-size: 14px;
    }
    .header-title { flex: 1; }
    .notification-list { max-height: 400px; overflow-y: auto; }
    .empty-state { 
      padding: 40px 16px; text-align: center; color: rgba(0,0,0,0.54);
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .empty-state mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .notification-item { 
      padding: 12px 16px; border-bottom: 1px solid #f0f0f0; cursor: pointer;
      display: flex; gap: 8px; align-items: flex-start;
      transition: background 0.2s; position: relative;
    }
    .notification-item:hover { background: #f5f5f5; }
    .notification-item.unread { background: #f9f9ff; border-left: 3px solid #3f51b5; }
    .notification-content { flex: 1; min-width: 0; }
    .notification-title { font-weight: 600; font-size: 13px; color: rgba(0,0,0,0.87); }
    .notification-message { font-size: 12px; color: rgba(0,0,0,0.65); margin-top: 4px; line-height: 1.4; word-break: break-word; }
    .notification-time { font-size: 11px; color: rgba(0,0,0,0.38); margin-top: 4px; }
    .delete-btn { flex-shrink: 0; }
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
        return this.auth.isAdmin ? ['/admin/users'] : ['/dashboard'];

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
