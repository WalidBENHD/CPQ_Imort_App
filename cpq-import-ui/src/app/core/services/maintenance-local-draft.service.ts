import { Injectable, inject } from '@angular/core';
import { AuthFacade } from '../auth/auth.facade';

export type MaintenanceDraftDatasetKey = 'Article' | 'PriceList' | 'Description' | 'CurrencyRate';
export type MaintenanceDraftAction = 'Add' | 'Modify' | 'Deactivate';

export interface LocalMaintenanceChange {
  id: string;
  dataset: MaintenanceDraftDatasetKey;
  datasetName: string;
  recordKey: string;
  identity: string;
  label: string;
  action: MaintenanceDraftAction;
  values: Record<string, string>;
  originalValues?: Record<string, string>;
  valid: boolean;
}

export interface LocalMaintenanceDraft {
  version: 1;
  userId: string;
  name: string;
  selectedDataset: MaintenanceDraftDatasetKey;
  changes: LocalMaintenanceChange[];
  blockingIssues?: string[];
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceLocalDraftService {
  private readonly auth = inject(AuthFacade);
  private readonly storagePrefix = 'cpq.maintenance.local-draft.v1';

  load(): LocalMaintenanceDraft | null {
    const storage = this.storage;
    if (!storage) return null;
    try {
      const value = storage.getItem(this.storageKey);
      if (!value) return null;
      const draft = JSON.parse(value) as LocalMaintenanceDraft;
      if (draft.version !== 1 || draft.userId !== this.userKey || !Array.isArray(draft.changes)) {
        this.clear();
        return null;
      }
      return draft;
    } catch {
      this.clear();
      return null;
    }
  }

  save(input: Pick<LocalMaintenanceDraft, 'name' | 'selectedDataset' | 'changes' | 'blockingIssues'>): LocalMaintenanceDraft | null {
    const storage = this.storage;
    if (!storage) return null;
    const draft: LocalMaintenanceDraft = {
      version: 1,
      userId: this.userKey,
      name: input.name,
      selectedDataset: input.selectedDataset,
      changes: input.changes.map(change => ({
        ...change,
        values: { ...change.values },
        originalValues: change.originalValues ? { ...change.originalValues } : undefined
      })),
      blockingIssues: input.blockingIssues ? [...input.blockingIssues] : undefined,
      updatedAt: new Date().toISOString()
    };
    try {
      storage.setItem(this.storageKey, JSON.stringify(draft));
      return draft;
    } catch {
      return null;
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(this.storageKey);
    } catch {
      // A blocked storage provider should not prevent maintenance work.
    }
  }

  private get userKey(): string {
    return this.auth.userId || this.auth.loginName || 'anonymous';
  }

  private get storageKey(): string {
    return `${this.storagePrefix}.${encodeURIComponent(this.userKey)}`;
  }

  private get storage(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }
}
