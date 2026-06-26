import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { switchMap, tap, catchError, startWith } from 'rxjs/operators';
import { Notification, NotificationResponse } from '../models/notification.models';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { NotificationToastComponent } from '../../shared/notification-toast/notification-toast.component';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly API_BASE = `${environment.apiUrl}/notifications`;
  
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  private pollingSubscription: any = null;
  private shownNotificationIds = new Set<string>();
  
  notifications$ = this.notificationsSubject.asObservable();
  unreadCount$ = this.unreadCountSubject.asObservable();

  // Poll every 5 seconds for new notifications (near real-time)
  startPolling() {
    // Avoid starting multiple polling subscriptions
    if (this.pollingSubscription) {
      return;
    }

    this.pollingSubscription = interval(5000)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchNotifications()),
        catchError(() => of({ notifications: [], unreadCount: 0 }))
      )
      .subscribe(response => {
        // Find new notifications and show toasts
        response.notifications.forEach(notification => {
          if (!this.shownNotificationIds.has(notification.id)) {
            this.shownNotificationIds.add(notification.id);
            this.showNotificationToast(notification);
          }
        });
        
        this.notificationsSubject.next(response.notifications);
        this.unreadCountSubject.next(response.unreadCount);
      });
  }

  // Manual trigger to fetch notifications immediately
  pollNow(): Observable<NotificationResponse> {
    return this.fetchNotifications().pipe(
      tap(response => {
        // Find new notifications and show toasts
        response.notifications.forEach(notification => {
          if (!this.shownNotificationIds.has(notification.id)) {
            this.shownNotificationIds.add(notification.id);
            this.showNotificationToast(notification);
          }
        });
        
        this.notificationsSubject.next(response.notifications);
        this.unreadCountSubject.next(response.unreadCount);
      }),
      catchError(() => of({ notifications: [], unreadCount: 0 }))
    );
  }

  private showNotificationToast(notification: Notification) {
    const config: MatSnackBarConfig = {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['notification-toast-panel']
    };
    
    this.snackBar.openFromComponent(NotificationToastComponent, {
      ...config,
      data: notification
    });
  }

  stopPolling() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private fetchNotifications(): Observable<NotificationResponse> {
    return this.http.get<NotificationResponse>(this.API_BASE, { params: { pageSize: '20', skip: '0' } });
  }

  getNotifications(pageSize: number = 20, skip: number = 0): Observable<NotificationResponse> {
    return this.http.get<NotificationResponse>(this.API_BASE, { params: { pageSize: pageSize.toString(), skip: skip.toString() } })
      .pipe(
        tap(response => {
          this.notificationsSubject.next(response.notifications);
          this.unreadCountSubject.next(response.unreadCount);
        })
      );
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<number>(`${this.API_BASE}/unread-count`)
      .pipe(
        tap(count => this.unreadCountSubject.next(count))
      );
  }

  markAsRead(notificationId: string): Observable<void> {
    return this.http.put<void>(`${this.API_BASE}/${notificationId}/read`, {})
      .pipe(
        tap(() => {
          const current = this.notificationsSubject.value;
          const updated = current.map(n => 
            n.id === notificationId ? { ...n, isRead: true } : n
          );
          this.notificationsSubject.next(updated);
          const unread = updated.filter(n => !n.isRead).length;
          this.unreadCountSubject.next(unread);
        })
      );
  }

  markAllAsRead(): Observable<void> {
    return this.http.put<void>(`${this.API_BASE}/read-all`, {})
      .pipe(
        tap(() => {
          const current = this.notificationsSubject.value;
          const updated = current.map(n => ({ ...n, isRead: true }));
          this.notificationsSubject.next(updated);
          this.unreadCountSubject.next(0);
        })
      );
  }

  deleteNotification(notificationId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_BASE}/${notificationId}`)
      .pipe(
        tap(() => {
          const current = this.notificationsSubject.value;
          const updated = current.filter(n => n.id !== notificationId);
          this.notificationsSubject.next(updated);
          const unread = updated.filter(n => !n.isRead).length;
          this.unreadCountSubject.next(unread);
        })
      );
  }
}
