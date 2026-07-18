import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ApprovedComparisonSnapshot, ComparisonRow, ComparisonStatus, DashboardOverview, DatasetRequirement, DependencyContext, DependencyImpact, EntityType, ImportComparison, ImportJob, PagedResult, PublicationResult, ReleasePackage, RowStatus, StagingRow
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

  approve(jobId: string): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/approve`, {}).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  getDependencyContext(jobId: string): Observable<DependencyContext> {
    return this.http.get<DependencyContext>(`${this.base}/${jobId}/dependency-context`);
  }

  previewDependencyAnchor(jobId: string, articleMasterJobId: string): Observable<DependencyImpact> {
    return this.http.post<DependencyImpact>(`${this.base}/${jobId}/dependency-context/preview`, { articleMasterJobId });
  }

  applyDependencyAnchor(jobId: string, articleMasterJobId: string): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/dependency-context/apply`, { articleMasterJobId });
  }

  createReleasePackage(jobId: string, articleMasterJobId: string, name: string): Observable<ReleasePackage> {
    return this.http.post<ReleasePackage>(`${this.base}/${jobId}/release-package`, { articleMasterJobId, name });
  }

  submitReleasePackage(packageId: string): Observable<ReleasePackage> {
    return this.http.post<ReleasePackage>(`${this.base}/release-packages/${packageId}/submit`, {});
  }

  getReleasePackage(packageId: string): Observable<ReleasePackage> {
    return this.http.get<ReleasePackage>(`${this.base}/release-packages/${packageId}`);
  }

  withdrawReleasePackage(packageId: string): Observable<ReleasePackage> {
    return this.http.post<ReleasePackage>(`${this.base}/release-packages/${packageId}/withdraw`, {}).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  dissolveReleasePackage(packageId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/release-packages/${packageId}`);
  }

  approveReleasePackage(packageId: string): Observable<ReleasePackage> {
    return this.http.post<ReleasePackage>(`${this.base}/release-packages/${packageId}/approve`, {});
  }

  rejectReleasePackage(packageId: string, reason: string): Observable<ReleasePackage> {
    return this.http.post<ReleasePackage>(`${this.base}/release-packages/${packageId}/reject`, { reason }).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  publishReleasePackage(packageId: string): Observable<ReleasePackage> {
    return this.http.post<ReleasePackage>(`${this.base}/release-packages/${packageId}/publish`, {});
  }

  copyToWorkspace(jobId: string, fileName: string): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/copy-to-workspace`, { fileName });
  }

  renameUpload(jobId: string, name: string): Observable<ImportJob> {
    return this.http.patch<ImportJob>(`${this.base}/${jobId}/name`, { name });
  }

  addRow(jobId: string, fields: Record<string, string | null>): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/rows`, { fields });
  }

  deleteRows(jobId: string, rowIds: string[]): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/rows/delete`, { rowIds });
  }

  restoreRows(jobId: string, rowIds: string[]): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/rows/restore`, { rowIds });
  }

  getRemovedRows(jobId: string): Observable<StagingRow[]> {
    return this.http.get<StagingRow[]>(`${this.base}/${jobId}/rows/removed`);
  }

  submitForReview(jobId: string): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/submit`, {}).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  withdrawFromReview(jobId: string): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/withdraw`, {}).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  deletePrivateDraft(jobId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${jobId}`);
  }

  returnToReview(jobId: string): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/return-to-review`, {}).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  publish(jobId: string): Observable<PublicationResult> {
    return this.http.post<PublicationResult>(`${this.base}/${jobId}/publish`, {}).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  getComparison(jobId: string): Observable<ImportComparison> {
    return this.http.get<ImportComparison>(`${this.base}/${jobId}/comparison`);
  }

  getApprovalSnapshot(jobId: string): Observable<ApprovedComparisonSnapshot | null> {
    return this.http.get<ApprovedComparisonSnapshot | null>(`${this.base}/${jobId}/approval-snapshot`);
  }

  reject(jobId: string, reason: string): Observable<ImportJob> {
    return this.http.post<ImportJob>(`${this.base}/${jobId}/reject`, { reason }).pipe(
      tap(() => this.notificationService.pollNow().subscribe())
    );
  }

  downloadOriginal(jobId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${jobId}/download`, { responseType: 'blob' });
  }

  downloadWorkingCopy(jobId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${jobId}/working-copy`, { responseType: 'blob' });
  }

  downloadErrorReport(jobId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${jobId}/error-report`, { responseType: 'blob' });
  }

  downloadComparisonReport(jobId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${jobId}/comparison-report`, { responseType: 'blob' });
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
