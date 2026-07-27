import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { ComparisonRow, ImportJob, StagingRow } from '../models/import.models';
import { ImportService } from './import.service';
import {
  LocalMaintenanceChange,
  LocalMaintenanceDraft,
  MaintenanceDraftDatasetKey,
  MaintenanceLocalDraftService
} from './maintenance-local-draft.service';

export interface WithdrawableMaintenanceRequest {
  id: string;
  kind: 'package' | 'job';
  name: string;
  jobs: ImportJob[];
}

@Injectable({ providedIn: 'root' })
export class MaintenanceWithdrawalService {
  private readonly imports = inject(ImportService);
  private readonly localDrafts = inject(MaintenanceLocalDraftService);

  withdrawToPrivateBasket(request: WithdrawableMaintenanceRequest): Observable<LocalMaintenanceDraft> {
    const action: Observable<unknown> = request.kind === 'package'
      ? this.imports.withdrawReleasePackage(request.id)
      : this.imports.withdrawFromReview(request.id);

    // Removed rows are intentionally private-draft data, so restoration starts
    // only after the server has returned the request to its owner.
    return action.pipe(
      switchMap(() => this.restoreChanges(request)),
      switchMap(changes => {
        const draft = this.localDrafts.save({
          name: request.name,
          selectedDataset: changes[0].dataset,
          changes
        });
        if (!draft) {
          return throwError(() => new Error('The withdrawn changes could not be saved in the private workspace.'));
        }

        const discard = request.kind === 'package'
          ? this.imports.discardReleasePackage(request.id)
          : this.imports.deletePrivateDraft(request.id);
        return discard.pipe(map(() => draft));
      })
    );
  }

  private restoreChanges(request: WithdrawableMaintenanceRequest): Observable<LocalMaintenanceChange[]> {
    if (!request.jobs.length) {
      return throwError(() => new Error('The maintenance request does not contain any datasets to restore.'));
    }

    return forkJoin(request.jobs.map(job => forkJoin({
      active: this.loadAllRows(job.id),
      removed: this.imports.getRemovedRows(job.id),
      comparison: this.imports.getComparison(job.id)
    }).pipe(map(rows => this.toLocalChanges(job, rows.active, rows.removed, rows.comparison.rows))))).pipe(
      map(groups => groups.flat()),
      switchMap(changes => changes.length
        ? of(changes)
        : throwError(() => new Error('The withdrawn request did not contain any staged changes to restore.')))
    );
  }

  private loadAllRows(jobId: string): Observable<StagingRow[]> {
    const pageSize = 200;
    return this.imports.getRows(jobId, 1, pageSize).pipe(
      switchMap(firstPage => {
        const pageCount = Math.ceil(firstPage.total / firstPage.pageSize);
        if (pageCount <= 1) return of(firstPage.items);
        const remainingPages = Array.from({ length: pageCount - 1 }, (_, index) => index + 2);
        return forkJoin(remainingPages.map(page => this.imports.getRows(jobId, page, firstPage.pageSize))).pipe(
          map(pages => [firstPage.items, ...pages.map(result => result.items)].flat())
        );
      })
    );
  }

  private toLocalChanges(
    job: ImportJob,
    activeRows: StagingRow[],
    removedRows: StagingRow[],
    comparisonRows: ComparisonRow[]
  ): LocalMaintenanceChange[] {
    const dataset = this.datasetKey(job.entityType);
    const activeChanges = activeRows
      .filter(row => row.isUserAdded || row.isUserModified)
      .map(row => this.toLocalChange(
        job,
        dataset,
        row,
        row.isUserAdded ? 'Add' : 'Modify',
        comparisonRows.find(item => item.rowId === row.id)
      ));
    const removedChanges = removedRows
      .filter(row => !row.isUserAdded)
      .map(row => this.toLocalChange(job, dataset, row, 'Deactivate'));
    return [...activeChanges, ...removedChanges];
  }

  private toLocalChange(
    job: ImportJob,
    dataset: MaintenanceDraftDatasetKey,
    row: StagingRow,
    action: LocalMaintenanceChange['action'],
    comparison?: ComparisonRow
  ): LocalMaintenanceChange {
    const values = Object.fromEntries(Object.entries(row.fields).map(([key, value]) => [key, value ?? '']));
    const originalValues = action === 'Modify'
      ? comparison?.changes.reduce<Record<string, string>>((result, field) => {
          result[field.field] = field.baselineValue ?? '';
          return result;
        }, { ...values })
      : undefined;
    const identity = this.localIdentity(dataset, values);
    const recordKey = dataset === 'CurrencyRate'
      ? `${values['FromCurrency'] ?? ''}/${values['ToCurrency'] ?? ''}`
      : dataset === 'Description'
        ? `${values['ArticleNumber'] ?? ''} / ${values['LanguageCode'] ?? ''}`
        : values['ArticleNumber'] ?? '';
    const label = action === 'Add'
      ? 'New governed record'
      : action === 'Modify'
        ? 'Field values updated'
        : 'Removed from projected release';

    return {
      id: `withdrawn-${job.id}-${row.id}-${action}`,
      dataset,
      datasetName: job.entityTypeLabel,
      recordKey,
      identity,
      label,
      action,
      values,
      originalValues,
      valid: true
    };
  }

  private datasetKey(entityType: number): MaintenanceDraftDatasetKey {
    if (entityType === 1) return 'Article';
    if (entityType === 2) return 'PriceList';
    if (entityType === 3) return 'Description';
    return 'CurrencyRate';
  }

  private localIdentity(dataset: MaintenanceDraftDatasetKey, values: Record<string, string | null>): string {
    const fields = dataset === 'Description'
      ? ['ArticleNumber', 'LanguageCode']
      : dataset === 'CurrencyRate'
        ? ['FromCurrency', 'ToCurrency', 'ValidFrom']
        : ['ArticleNumber'];
    return fields.map(field => values[field]?.trim().toLowerCase() ?? '').join('|');
  }
}
