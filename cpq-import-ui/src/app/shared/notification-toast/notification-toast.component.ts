import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { Notification } from '../../core/models/notification.models';

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="notification-toast-container">
      <div class="notification-toast-icon">
        <mat-icon>notifications_active</mat-icon>
      </div>
      <div class="notification-toast-content">
        <div class="notification-toast-title">{{ data.title }}</div>
        <div class="notification-toast-message">{{ data.message }}</div>
      </div>
      <button 
        class="notification-toast-close"
        (click)="dismissToast()">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .notification-toast-container {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      width: 100%;
      max-width: 400px;
      background: inherit;
      color: inherit;
    }

    .notification-toast-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }

    .notification-toast-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .notification-toast-title {
      font-weight: 600;
      font-size: 14px;
      line-height: 1.3;
    }

    .notification-toast-message {
      font-size: 13px;
      line-height: 1.4;
      opacity: 0.9;
      word-break: break-word;
    }

    .notification-toast-close {
      flex-shrink: 0;
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      opacity: 0.8;
      transition: opacity 0.2s;
      color: inherit;
    }

    .notification-toast-close:hover {
      opacity: 1;
    }

    .notification-toast-close mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class NotificationToastComponent {
  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: Notification,
    private snackBarRef: MatSnackBarRef<NotificationToastComponent>
  ) {}

  dismissToast() {
    this.snackBarRef.dismiss();
  }
}
