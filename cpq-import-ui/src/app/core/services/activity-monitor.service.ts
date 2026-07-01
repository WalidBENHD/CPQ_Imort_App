import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/import.models';
import { ActivityEvent, ActivityOverview, ActivityTrackViewRequest } from '../models/activity.models';

@Injectable({ providedIn: 'root' })
export class ActivityMonitorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/activity`;

  getOverview(): Observable<ActivityOverview> {
    return this.http.get<ActivityOverview>(`${this.base}/overview`);
  }

  getActivities(options: {
    page?: number;
    pageSize?: number;
    fromUtc?: string | null;
    toUtc?: string | null;
    userId?: string | null;
    excludeCurrentUser?: boolean;
    category?: string | null;
    action?: string | null;
    search?: string | null;
    statusCode?: number | null;
  }): Observable<PagedResult<ActivityEvent>> {
    let params = new HttpParams()
      .set('page', options.page ?? 1)
      .set('pageSize', options.pageSize ?? 50);

    if (options.fromUtc) params = params.set('fromUtc', options.fromUtc);
    if (options.toUtc) params = params.set('toUtc', options.toUtc);
    if (options.userId) params = params.set('userId', options.userId);
    if (options.excludeCurrentUser) params = params.set('excludeCurrentUser', 'true');
    if (options.category) params = params.set('category', options.category);
    if (options.action) params = params.set('action', options.action);
    if (options.search) params = params.set('search', options.search);
    if (typeof options.statusCode === 'number') params = params.set('statusCode', options.statusCode);

    return this.http.get<PagedResult<ActivityEvent>>(this.base, { params });
  }

  trackView(page: string): Observable<void> {
    const payload: ActivityTrackViewRequest = {
      page,
      title: typeof document !== 'undefined' ? document.title : null,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      clientTime: new Date().toISOString()
    };

    return this.http.post<void>(`${this.base}/track-view`, payload);
  }
}
