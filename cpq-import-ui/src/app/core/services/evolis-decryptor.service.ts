import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EvolisDecryptResponse, EvolisDecryptionHistory, EvolisDecryptionMetrics } from '../models/evolis.models';

@Injectable({ providedIn: 'root' })
export class EvolisDecryptorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/evolis`;

  decrypt(file: File): Observable<EvolisDecryptResponse> {
    const form = new FormData();
    form.append('file', file);

    return this.http.post<EvolisDecryptResponse>(`${this.base}/decrypt`, form);
  }

  downloadPdf(file: File): Observable<Blob> {
    const form = new FormData();
    form.append('file', file);

    return this.http.post(`${this.base}/decrypt-pdf`, form, { responseType: 'blob' });
  }

  getHistory(allUsers: boolean, page: number, pageSize: number, search: string, status: string): Observable<EvolisDecryptionHistory> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search.trim()) params = params.set('search', search.trim());
    if (status !== 'All') params = params.set('status', status);
    return this.http.get<EvolisDecryptionHistory>(`${this.base}/history${allUsers ? '/all' : ''}`, { params });
  }

  getMetrics(allUsers: boolean): Observable<EvolisDecryptionMetrics> {
    return this.http.get<EvolisDecryptionMetrics>(`${this.base}/${allUsers ? 'metrics' : 'history/metrics'}`);
  }
}
