import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { Notification, NotificationType } from '../../core/models/notification.models';

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="notification-toast-container" [ngClass]="toastToneClass">
      <div class="notification-toast-accent" aria-hidden="true"></div>

      <div class="notification-toast-icon" [ngClass]="toastToneClass">
        <mat-icon>{{ toastIcon }}</mat-icon>
      </div>

      <div class="notification-toast-content">
        <div class="notification-toast-meta">
          <span class="notification-toast-kind">{{ toastLabel }}</span>
          <span class="notification-toast-dot"></span>
          <span class="notification-toast-state">New</span>
        </div>
        <div class="notification-toast-title">{{ data.title }}</div>
        <div class="notification-toast-message">{{ data.message }}</div>
      </div>

      <button 
        class="notification-toast-close"
        type="button"
        aria-label="Dismiss notification"
        (click)="dismissToast()">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .notification-toast-panel {
      padding: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }

    .notification-toast-panel .mdc-snackbar__surface,
    .notification-toast-panel .mat-mdc-snackbar-surface {
      padding: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      border-radius: 20px !important;
      min-width: min(420px, calc(100vw - 24px)) !important;
    }

    .notification-toast-panel .mat-mdc-snack-bar-label,
    .notification-toast-panel .mdc-snackbar__label {
      padding: 0 !important;
    }

    .notification-toast-container {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 16px 18px 16px 20px;
      width: 100%;
      max-width: 420px;
      border: 1px solid rgba(203, 213, 225, 0.72);
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
      box-shadow: 0 22px 54px rgba(15, 23, 42, 0.18), 0 6px 14px rgba(30, 64, 175, 0.08);
      color: #10233d;
      overflow: hidden;
      backdrop-filter: blur(10px);
    }

    .notification-toast-accent {
      position: absolute;
      left: 0;
      top: 12px;
      bottom: 12px;
      width: 4px;
      border-radius: 999px;
      background: linear-gradient(180deg, #2563eb, #0f766e);
    }

    .notification-toast-container.toast-approval .notification-toast-accent {
      background: linear-gradient(180deg, #2563eb, #3b82f6);
    }

    .notification-toast-container.toast-success .notification-toast-accent {
      background: linear-gradient(180deg, #059669, #10b981);
    }

    .notification-toast-container.toast-warning .notification-toast-accent {
      background: linear-gradient(180deg, #d97706, #f59e0b);
    }

    .notification-toast-container.toast-danger .notification-toast-accent {
      background: linear-gradient(180deg, #dc2626, #ef4444);
    }

    .notification-toast-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: #eff6ff;
      color: #2563eb;
      margin-top: 2px;
    }

    .notification-toast-icon.toast-approval {
      background: #eff6ff;
      color: #2563eb;
    }

    .notification-toast-icon.toast-success {
      background: #ecfdf5;
      color: #059669;
    }

    .notification-toast-icon.toast-warning {
      background: #fffbeb;
      color: #d97706;
    }

    .notification-toast-icon.toast-danger {
      background: #fef2f2;
      color: #dc2626;
    }

    .notification-toast-icon mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .notification-toast-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .notification-toast-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #5b6b80;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .notification-toast-kind {
      color: #1d4ed8;
    }

    .notification-toast-dot {
      width: 4px;
      height: 4px;
      border-radius: 999px;
      background: #94a3b8;
      flex: 0 0 auto;
    }

    .notification-toast-state {
      color: #64748b;
    }

    .notification-toast-title {
      font-weight: 800;
      font-size: 17px;
      line-height: 1.25;
      color: #10233d;
    }

    .notification-toast-message {
      font-size: 14px;
      line-height: 1.5;
      color: #42556f;
      word-break: break-word;
    }

    .notification-toast-close {
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: rgba(241, 245, 249, 0.88);
      border: 1px solid rgba(203, 213, 225, 0.72);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
      color: #64748b;
    }

    .notification-toast-close:hover {
      background: #ffffff;
      border-color: #cbd5e1;
      transform: translateY(-1px);
    }

    .notification-toast-close mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    @media (max-width: 640px) {
      .notification-toast-panel .mdc-snackbar__surface,
      .notification-toast-panel .mat-mdc-snackbar-surface {
        min-width: calc(100vw - 16px) !important;
      }

      .notification-toast-container {
        gap: 12px;
        padding: 14px 14px 14px 18px;
        max-width: none;
        border-radius: 18px;
      }

      .notification-toast-title {
        font-size: 15px;
      }

      .notification-toast-message {
        font-size: 13px;
      }

      .notification-toast-icon {
        width: 40px;
        height: 40px;
      }
    }
  `]
})
export class NotificationToastComponent {
  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: Notification,
    private snackBarRef: MatSnackBarRef<NotificationToastComponent>
  ) {}

  get toastIcon(): string {
    switch (this.data.notificationType) {
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

  get toastLabel(): string {
    switch (this.data.notificationType) {
      case NotificationType.UserPendingApproval:
      case NotificationType.UserApproved:
      case NotificationType.UserRoleChanged:
      case NotificationType.UserDeleted:
        return 'User event';
      case NotificationType.ImportApproved:
      case NotificationType.ImportCommitted:
      case NotificationType.ImportUploaded:
        return 'Import update';
      case NotificationType.ImportRejected:
      case NotificationType.ImportFailed:
      case NotificationType.ImportNeedsCorrection:
        return 'Action needed';
      default:
        return 'Notification';
    }
  }

  get toastToneClass(): string {
    switch (this.data.notificationType) {
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

  dismissToast() {
    this.snackBarRef.dismiss();
  }
}
