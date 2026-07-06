import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EvolisDecryptResponse } from '../models/evolis.models';

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
}