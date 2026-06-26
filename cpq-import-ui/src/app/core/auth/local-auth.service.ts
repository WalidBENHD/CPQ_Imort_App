import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthTokenResponse, AuthUser } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class LocalAuthService {
  private readonly http = inject(HttpClient);
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
    });
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

  approveUser(userId: string, role: string, isAdmin: boolean): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${environment.apiUrl}/auth/users/${userId}/approve`, {
      role,
      isAdmin
    });
  }

  updateRole(userId: string, role: string, isAdmin: boolean): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${environment.apiUrl}/auth/users/${userId}/role`, {
      role,
      isAdmin
    });
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/auth/users/${userId}`);
  }

  createUser(payload: {
    userName: string;
    displayName: string;
    password: string;
    role: string;
    isAdmin: boolean;
    isApproved: boolean;
  }): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${environment.apiUrl}/auth/users`, payload);
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
