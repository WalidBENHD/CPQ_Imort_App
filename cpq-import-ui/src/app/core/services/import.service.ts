import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  CommitResult, ComparisonRow, ComparisonStatus, DashboardOverview, DatasetRequirement, EntityType, ImportComparison, ImportJob, PagedResult, RowStatus, StagingRow
} from '../models/import.models';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly base = `${environment.apiUrl}/imports`;

  getJobs(
    page = 1,
    pageSize = 20,
    search?: string | null,
    status?: string | null,
    entityType?: EntityType | null
  ): Observable<PagedResult<ImportJob>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    if (entityType) params = params.set('entityType', entityType);
    return this.http.get<PagedResult<ImportJob>>(this.base, { params });
  }

  getDashboardOverview(): Observable<DashboardOverview> {
    return this.http.get<DashboardOverview>(`${environment.apiUrl}/dashboard/overview`);
  }

  getJob(id: string): Observable<ImportJob> {
    return this.http.get<ImportJob>(`${this.base}/${id}`);
  }

  getRows(jobId: string, page = 1, pageSize = 50, search?: string | null, status?: RowStatus, comparisonStatus?: ComparisonStatus): Observable<PagedResult<StagingRow>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    if (comparisonStatus) params = params.set('comparisonStatus', comparisonStatus);
    return this.http.get<PagedResult<StagingRow>>(`${this.base}/${jobId}/rows`, { params });
  }

  refreshValidation(jobId: string): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/refresh-validation`, {}).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  updateRow(jobId: string, rowId: string, fields: Record<string, string | null>): Observable<ImportJob> {
    return this.http.put<ImportJob>(`${this.base}/${jobId}/rows/${rowId}`, { fields }).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  cancel(jobId: string): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/cancel`, {}).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  upload(file: File, entityType: EntityType): Observable<ImportJob> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportJob>(`${this.base}/upload?entityType=${entityType}`, form).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  commit(jobId: string): Observable<CommitResult> {
    return this.http.post<CommitResult>(`${this.base}/${jobId}/commit`, {}).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  getComparison(jobId: string): Observable<ImportComparison> {
    return this.http.get<ImportComparison>(`${this.base}/${jobId}/comparison`);
  }

  reject(jobId: string, reason: string): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/reject`, { reason }).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  downloadOriginal(jobId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${jobId}/download`, { responseType: 'blob' });
  }

  downloadErrorReport(jobId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${jobId}/error-report`, { responseType: 'blob' });
  }

  downloadTemplate(entityType: EntityType): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/templates/${entityType}`, { responseType: 'blob' });
  }

  getDatasetRequirements(): Observable<DatasetRequirement[]> {
    return this.http.get<DatasetRequirement[]>(`${environment.apiUrl}/templates/requirements`);
  }

  getDatasetRequirement(entityType: EntityType | string): Observable<DatasetRequirement> {
    return this.http.get<DatasetRequirement>(`${environment.apiUrl}/templates/requirements/${entityType}`);
  }
}
