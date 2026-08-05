import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { AuthFacade } from '../../core/auth/auth.facade';
import {
  EvolisDecryptResponse,
  EvolisDecryptionMetrics,
  EvolisDecryptionRun,
  EvolisPresentation
} from '../../core/models/evolis.models';
import { EvolisDecryptorService } from '../../core/services/evolis-decryptor.service';
import { DownloadActionComponent } from '../../shared/download-action/download-action.component';
import { parseEvolisPresentation } from './evolis-parser';

type HistoryScope = 'mine' | 'all';
type HistoryStatus = 'All' | 'Successful' | 'Failed';
type DownloadKind = 'source' | 'pdf';

@Component({
  selector: 'app-evolis-decryptor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, DownloadActionComponent],
  templateUrl: './evolis-decryptor.component.html',
  styleUrl: './evolis-decryptor.component.scss'
})
export class EvolisDecryptorComponent implements OnInit {
  readonly auth = inject(AuthFacade);
  private readonly decryptorService = inject(EvolisDecryptorService);
  private readonly route = inject(ActivatedRoute);

  selectedFile: File | null = null;
  dragActive = false;
  processing = false;
  result: EvolisDecryptResponse | null = null;
  presentation: EvolisPresentation | null = null;
  resultOrigin: 'new' | 'history' | null = null;
  errorMessage = '';
  successMessage = '';
  activeDownload: DownloadKind | null = null;
  historyDownloadId: string | null = null;
  openingHistoryId: string | null = null;

  historyScope: HistoryScope = this.route.snapshot.queryParamMap.get('history') === 'all'
    && this.auth.hasCapability('tools.evolis.audit') ? 'all' : 'mine';
  historySearch = '';
  historyStatus: HistoryStatus = 'All';
  historyItems: EvolisDecryptionRun[] = [];
  historyMetrics: EvolisDecryptionMetrics = { total: 0, thisMonth: 0, successful: 0, failed: 0, failedThisMonth: 0 };
  historyPage = 1;
  readonly historyPageSize = 12;
  historyTotal = 0;
  historyLoading = false;
  historyMobileOpen = false;
  resetDialogOpen = false;
  resetConfirmation = '';
  resettingHistory = false;
  private historySearchTimer: number | null = null;
  private readonly expandedTables = new Set<number>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('resultSection') resultSection?: ElementRef<HTMLElement>;

  ngOnInit(): void {
    this.loadHistory();
  }

  get canViewAllHistory(): boolean {
    return this.auth.hasCapability('tools.evolis.audit');
  }

  get canResetHistory(): boolean {
    return this.auth.hasCapability('system.maintenance');
  }

  get resetConfirmed(): boolean {
    return this.resetConfirmation.trim().toUpperCase() === 'RESET EVOLIS';
  }

  get historyPageCount(): number {
    return Math.max(1, Math.ceil(this.historyTotal / this.historyPageSize));
  }

  get selectedFileSize(): string {
    return this.selectedFile ? this.formatHistorySize(this.selectedFile.size) : '';
  }

  onFileSelected(event: Event): void {
    this.setFile((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = false;
    this.setFile(event.dataTransfer?.files?.[0] ?? null);
  }

  decrypt(): void {
    if (!this.selectedFile || this.processing) return;
    this.processing = true;
    this.errorMessage = '';

    this.decryptorService.decrypt(this.selectedFile).subscribe({
      next: response => {
        this.activateResult(response, 'new');
        this.processing = false;
        this.loadHistory();
      },
      error: error => {
        this.errorMessage = this.readError(error, 'Unable to decrypt the selected file.');
        this.processing = false;
        this.loadHistory();
      }
    });
  }

  openHistory(item: EvolisDecryptionRun): void {
    if (!item.hasResult || this.openingHistoryId) return;
    this.openingHistoryId = item.id;
    this.errorMessage = '';
    this.decryptorService.getHistoryResult(item.id).subscribe({
      next: response => {
        this.activateResult(response, 'history');
        this.selectedFile = null;
        this.openingHistoryId = null;
        this.historyMobileOpen = false;
        window.setTimeout(() => this.resultSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      },
      error: error => {
        this.errorMessage = this.readError(error, 'Unable to reopen this retained result.');
        this.openingHistoryId = null;
      }
    });
  }

  downloadSource(item?: EvolisDecryptionRun): void {
    const id = item?.id ?? this.result?.runId;
    const fileName = item?.fileName ?? this.result?.sourceFileName;
    if (!id || !fileName || this.activeDownload || this.historyDownloadId) return;
    if (item) this.historyDownloadId = item.id;
    else this.activeDownload = 'source';

    this.decryptorService.downloadSource(id).subscribe({
      next: blob => {
        this.saveBlob(blob, fileName);
        this.activeDownload = null;
        this.historyDownloadId = null;
      },
      error: error => {
        this.errorMessage = this.readError(error, 'Unable to download the retained source file.');
        this.activeDownload = null;
        this.historyDownloadId = null;
      }
    });
  }

  downloadReport(format: 'pdf'): void {
    if (!this.result || this.activeDownload) return;
    this.activeDownload = format;
    this.decryptorService.downloadReport(this.result.runId, format).subscribe({
      next: blob => {
        const base = this.result!.sourceFileName.replace(/\.[^.]+$/, '');
        this.saveBlob(blob, `${base}_decrypted.pdf`);
        this.activeDownload = null;
      },
      error: error => {
        this.errorMessage = this.readError(error, 'Unable to generate the PDF report.');
        this.activeDownload = null;
      }
    });
  }

  reset(): void {
    this.selectedFile = null;
    this.result = null;
    this.presentation = null;
    this.resultOrigin = null;
    this.errorMessage = '';
    this.expandedTables.clear();
    if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
  }

  openResetDialog(): void {
    if (!this.canResetHistory) return;
    this.resetConfirmation = '';
    this.resetDialogOpen = true;
  }

  closeResetDialog(): void {
    if (this.resettingHistory) return;
    this.resetDialogOpen = false;
    this.resetConfirmation = '';
  }

  resetEvolisHistory(): void {
    if (!this.resetConfirmed || this.resettingHistory) return;
    this.resettingHistory = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.decryptorService.resetHistory().subscribe({
      next: response => {
        this.resettingHistory = false;
        this.resetDialogOpen = false;
        this.resetConfirmation = '';
        this.reset();
        this.historyPage = 1;
        this.historyItems = [];
        this.historyTotal = 0;
        this.historyMetrics = { total: 0, thisMonth: 0, successful: 0, failed: 0, failedThisMonth: 0 };
        this.successMessage = response.deletedRecords
          ? `${response.deletedRecords} Evolis record${response.deletedRecords === 1 ? '' : 's'} deleted. Other application data was preserved.`
          : 'Evolis history was already empty. Other application data was preserved.';
        this.loadHistory();
      },
      error: error => {
        this.resettingHistory = false;
        this.errorMessage = this.readError(error, 'Unable to reset Evolis history.');
      }
    });
  }

  setHistoryScope(scope: HistoryScope): void {
    if (scope === 'all' && !this.canViewAllHistory) return;
    this.historyScope = scope;
    this.historyPage = 1;
    this.loadHistory();
  }

  setHistoryStatus(status: HistoryStatus): void {
    this.historyStatus = status;
    this.historyPage = 1;
    this.loadHistory();
  }

  onHistorySearch(): void {
    if (this.historySearchTimer !== null) window.clearTimeout(this.historySearchTimer);
    this.historySearchTimer = window.setTimeout(() => {
      this.historyPage = 1;
      this.loadHistory();
    }, 250);
  }

  changeHistoryPage(direction: -1 | 1): void {
    const target = this.historyPage + direction;
    if (target < 1 || target > this.historyPageCount) return;
    this.historyPage = target;
    this.loadHistory();
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('');
  }

  formatHistorySize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(bytes >= 102400 ? 0 : 1)} KB`;
  }

  compactFileName(value: string, maximumLength = 32): string {
    if (value.length <= maximumLength) return value;
    const endLength = 14;
    const startLength = maximumLength - endLength - 1;
    return `${value.slice(0, startLength)}…${value.slice(-endLength)}`;
  }

  isTableExpanded(index: number): boolean {
    return this.expandedTables.has(index);
  }

  toggleTable(index: number): void {
    if (this.expandedTables.has(index)) this.expandedTables.delete(index);
    else this.expandedTables.add(index);
  }

  formatTableDate(value: string): string {
    return value.length === 8 ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
  }

  trackHistory(_: number, item: EvolisDecryptionRun): string {
    return item.id;
  }

  private activateResult(response: EvolisDecryptResponse, origin: 'new' | 'history'): void {
    this.result = response;
    this.presentation = parseEvolisPresentation(response.content);
    this.resultOrigin = origin;
    this.expandedTables.clear();
  }

  private loadHistory(): void {
    this.historyLoading = true;
    const allUsers = this.historyScope === 'all' && this.canViewAllHistory;
    forkJoin({
      history: this.decryptorService.getHistory(allUsers, this.historyPage, this.historyPageSize, this.historySearch, this.historyStatus),
      metrics: this.decryptorService.getMetrics(allUsers)
    }).subscribe({
      next: result => {
        this.historyItems = result.history.items;
        this.historyTotal = result.history.total;
        this.historyMetrics = result.metrics;
        this.historyLoading = false;
      },
      error: () => {
        this.historyItems = [];
        this.historyTotal = 0;
        this.historyLoading = false;
      }
    });
  }

  private setFile(file: File | null): void {
    if (!file) return;
    this.selectedFile = file;
    this.result = null;
    this.presentation = null;
    this.resultOrigin = null;
    this.errorMessage = '';
    this.expandedTables.clear();
  }

  private saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private readError(error: any, fallback: string): string {
    if (error?.status === 401 || error?.status === 403) return 'You do not have access to this decryption record.';
    return error?.error?.error ?? error?.error?.message ?? fallback;
  }
}
