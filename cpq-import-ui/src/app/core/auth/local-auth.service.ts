import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AccessRole, AuthTokenResponse, AuthUser, SaveAccessRoleRequest } from '../models/auth.models';
import { ToastService } from '../services/toast.service';
import { NotificationService } from '../services/notification.service';

@Injectable({ providedIn: 'root' })
export class LocalAuthService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly notificationService = inject(NotificationService);
  private readonly tokenStorageKey = 'cpq.local.auth.token';
  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(null);

  readonly currentUser$ = this.currentUserSubject.asObservable();

  get currentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenStorageKey);
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  login(userName: string, password: string): Observable<AuthTokenResponse> {
    return this.http.post<AuthTokenResponse>(`${environment.apiUrl}/auth/login`, { userName, password }).pipe(
      tap((response) => this.setSession(response))
    );
  }

  register(userName: string, displayName: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/register`, {
      userName,
      displayName,
      password
    }).pipe(
      tap((response) => {
        this.toast.success('Account created! Awaiting admin approval.');
        // Notify admins immediately
        this.notificationService.pollNow().subscribe();
      }),
      catchError((error) => {
        this.toast.error(error?.error?.error ?? 'Registration failed.');
        throw error;
      })
    );
  }

  ensureUserLoaded(): Observable<AuthUser | null> {
    if (!this.token) {
      this.currentUserSubject.next(null);
      return of(null);
    }

    if (this.currentUser) {
      return of(this.currentUser);
    }

    return this.http.get<AuthUser>(`${environment.apiUrl}/auth/me`).pipe(
      tap((user) => this.currentUserSubject.next(user)),
      catchError(() => {
        this.logout();
        return of(null);
      })
    );
  }

  getPendingUsers(): Observable<AuthUser[]> {
    return this.http.get<AuthUser[]>(`${environment.apiUrl}/auth/pending`);
  }

  getUsers(): Observable<AuthUser[]> {
    return this.http.get<AuthUser[]>(`${environment.apiUrl}/auth/users`);
  }

  getAccessRoles(): Observable<AccessRole[]> {
    return this.http.get<AccessRole[]>(`${environment.apiUrl}/access/roles`);
  }

  getCapabilityCatalog(): Observable<string[]> {
    return this.http.get<string[]>(`${environment.apiUrl}/access/capabilities`);
  }

  createAccessRole(request: SaveAccessRoleRequest): Observable<AccessRole> {
    return this.http.post<AccessRole>(`${environment.apiUrl}/access/roles`, request).pipe(tap(() => this.toast.success('Role created.')));
  }

  updateAccessRole(roleId: string, request: SaveAccessRoleRequest): Observable<AccessRole> {
    return this.http.put<AccessRole>(`${environment.apiUrl}/access/roles/${roleId}`, request).pipe(tap(() => this.toast.success('Role capabilities saved.')));
  }

  deleteAccessRole(roleId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/access/roles/${roleId}`).pipe(tap(() => this.toast.success('Role deleted.')));
  }

  updateUserAccess(userId: string, isApproved: boolean, isSuspended: boolean, roleIds: string[]): Observable<AuthUser> {
    return this.http.put<AuthUser>(`${environment.apiUrl}/access/users/${userId}`, { isApproved, isSuspended, roleIds }).pipe(tap(() => this.toast.success('User access updated.')));
  }

  approveUser(userId: string, roleIds: string[]): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${environment.apiUrl}/auth/users/${userId}/approve`, {
      roleIds
    }).pipe(
      tap(() => {
        this.toast.success('User approved and notification sent.');
        this.notificationService.pollNow().subscribe();
      })
    );
  }

  rejectUser(userId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/users/${userId}/reject`, {}).pipe(
      tap(() => {
        this.toast.success('User request rejected and removed.');
        this.notificationService.pollNow().subscribe();
      }),
      catchError((error) => {
        this.toast.error(error?.error?.error ?? 'Failed to reject user.');
        throw error;
      })
    );
  }

  updateRole(userId: string, roleIds: string[], isSuspended = false): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${environment.apiUrl}/auth/users/${userId}/role`, {
      roleIds,
      isSuspended
    }).pipe(
      tap(() => {
        this.toast.success('User role updated.');
        this.notificationService.pollNow().subscribe();
      })
    );
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/auth/users/${userId}`).pipe(
      tap(() => {
        this.toast.success('User deleted.');
        this.notificationService.pollNow().subscribe();
      })
    );
  }

  resetDevData(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/admin/maintenance/reset-dev-data`, {}).pipe(
      tap(() => {
        this.toast.success('Maintenance data reset completed.');
        this.notificationService.pollNow().subscribe();
      })
    );
  }

  createUser(payload: {
    userName: string;
    displayName: string;
    password: string;
    isApproved: boolean;
    roleIds: string[];
  }): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${environment.apiUrl}/auth/users`, payload).pipe(
      tap(() => {
        this.toast.success('User created successfully.');
        this.notificationService.pollNow().subscribe();
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenStorageKey);
    this.currentUserSubject.next(null);
  }

  private setSession(response: AuthTokenResponse): void {
    localStorage.setItem(this.tokenStorageKey, response.accessToken);
    this.currentUserSubject.next(response.user);
  }
}
