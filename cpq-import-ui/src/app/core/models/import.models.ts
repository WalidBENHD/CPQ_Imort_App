export type EntityType = 'Article' | 'PriceList' | 'Description' | 'CurrencyRate';
export type ImportStatus = 'Pending' | 'Processing' | 'AwaitingApproval' | 'Committed' | 'Rejected' | 'Failed';
export type RowStatus = 'Valid' | 'Warning' | 'Error';

export interface ImportJob {
  id: string;
  originalFileName: string;
  entityType: number;
  entityTypeLabel: EntityType;
  status: number;
  statusLabel: ImportStatus;
  createdBy: string;
  createdByDisplayName: string;
  createdAt: string;
  processedAt: string | null;
  committedAt: string | null;
  committedBy: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  committedRows: number;
}

export interface ValidationMessage {
  field: string;
  message: string;
  severity: 'Info' | 'Warning' | 'Error';
}

export interface StagingRow {
  id: string;
  rowNumber: number;
  status: number;
  statusLabel: RowStatus;
  fields: Record<string, string | null>;
  validationMessages: ValidationMessage[];
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CommitResult {
  jobId: string;
  committedRows: number;
  message: string;
}

export const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string; description: string }[] = [
  { value: 'Article',      label: 'Articles',           description: 'Article numbers, names, categories and units' },
  { value: 'PriceList',    label: 'Price Lists',         description: 'Article prices with currency and validity dates' },
  { value: 'Description',  label: 'Descriptions',        description: 'Translations and descriptions per language' },
  { value: 'CurrencyRate', label: 'Currency Rates',      description: 'Exchange rates between currency pairs' }
];
