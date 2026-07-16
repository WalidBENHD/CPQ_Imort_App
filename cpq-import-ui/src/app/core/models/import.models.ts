export type EntityType = 'Article' | 'PriceList' | 'Description' | 'CurrencyRate';
export type ImportStatus = 'Pending' | 'Processing' | 'AwaitingApproval' | 'NeedsCorrection' | 'Approved' | 'Committed' | 'Rejected' | 'Failed' | 'Cancelled';
export type RowStatus = 'Valid' | 'Warning' | 'Error';
export type ComparisonStatus = 'New' | 'Modified' | 'Unchanged';

export interface DatasetDefinition {
  key: EntityType;
  name: string;
  description: string;
  owner: string;
  template: string;
  status: string;
  currentVersion: string;
  icon: string;
  fileNameFragment: string;
}

export interface PilotScope {
  site: string;
  productFamily: string;
  dataDomains: string[];
  submissionType: string;
  category: string;
  currency: string;
}

export interface DatasetColumnRequirement {
  name: string;
  required: boolean;
  dataType: string;
  description: string;
  example: string | null;
}

export interface DatasetValidationRule {
  field: string;
  rule: string;
  severity: string;
}

export interface DatasetRequirement {
  entityType: number;
  entityTypeLabel: EntityType;
  displayName: string;
  owner: string;
  templateName: string;
  currentVersion: string;
  description: string;
  columns: DatasetColumnRequirement[];
  validationRules: DatasetValidationRule[];
}

export interface ImportJob {
  id: string;
  originalFileName: string;
  entityType: number;
  entityTypeLabel: string;
  status: number;
  statusLabel: ImportStatus;
  createdBy: string;
  createdByDisplayName: string;
  createdAt: string;
  processedAt: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  approvedByDisplayName: string | null;
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
  isActiveBaseline: boolean;
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

export interface PublicationResult {
  jobId: string;
  publishedRows: number;
  message: string;
}

export interface ComparisonFieldChange {
  field: string;
  currentValue: string | null;
  baselineValue: string | null;
  isDifferent: boolean;
}

export interface ComparisonRow {
  rowId: string;
  rowNumber: number;
  key: string;
  comparisonStatus: ComparisonStatus;
  changedFieldCount: number;
  changes: ComparisonFieldChange[];
}

export interface ComparisonMissingItem {
  key: string;
  baselineValues: Record<string, string | null>;
}

export interface ImportComparison {
  jobId: string;
  baselineJobId: string;
  entityType: EntityType;
  entityTypeLabel: string;
  hasBaseline: boolean;
  comparedRows: number;
  newRows: number;
  modifiedRows: number;
  unchangedRows: number;
  missingBaselineRows: number;
  rows: ComparisonRow[];
  missingRows: ComparisonMissingItem[];
}

export interface ApprovedComparisonSnapshot {
  schemaVersion: number;
  approvedAtUtc: string;
  approvedByUserId: string;
  approvedByDisplayName: string;
  comparison: ImportComparison;
}

export interface DashboardSummary {
  awaitingApproval: number;
  committedToday: number;
  rejected: number;
  totalSubmissions: number;
  openExceptions: number;
  agingApprovals: number;
}

export interface DashboardAttentionItem {
  jobId: string | null;
  title: string;
  dataset: string;
  message: string;
  severity: 'Low' | 'Medium' | 'High';
  actionLabel: string | null;
  occurredAt: string | null;
}

export interface DashboardDatasetHealth {
  entityType: EntityType;
  datasetName: string;
  owner: string;
  status: 'Healthy' | 'Watch' | 'Attention';
  currentVersion: string;
  totalSubmissions: number;
  openItems: number;
  errorRows: number;
  errorRate: number;
  lastActivityAt: string | null;
}

export interface DashboardActivityItem {
  jobId: string;
  action: string;
  title: string;
  dataset: string;
  performedByDisplayName: string;
  performedAt: string;
  details: string | null;
}

export interface DashboardOverview {
  summary: DashboardSummary;
  attentionItems: DashboardAttentionItem[];
  datasetHealth: DashboardDatasetHealth[];
  activityFeed: DashboardActivityItem[];
  recentSubmissions: ImportJob[];
}

export const PILOT_SCOPE: PilotScope = {
  site: 'Saint-Marcellin',
  productFamily: 'PDU',
  dataDomains: ['Article Master', 'Basis Price'],
  submissionType: 'Annual full snapshot',
  category: 'Standard',
  currency: 'EUR'
};

export const DATASET_CATALOG: DatasetDefinition[] = [
  {
    key: 'Article',
    name: 'Article Master',
    description: 'Governed article master data for the Saint-Marcellin PDU pilot.',
    owner: 'Saint-Marcellin PDU data owner',
    template: 'Article Master Template',
    status: 'Active',
    currentVersion: 'v1.0',
    icon: 'inventory_2',
    fileNameFragment: 'Article_Master'
  },
  {
    key: 'PriceList',
    name: 'Basis Price',
    description: 'Single unit price used by CPQ for the Saint-Marcellin PDU pilot.',
    owner: 'Saint-Marcellin PDU pricing owner',
    template: 'Basis Price Template',
    status: 'Active',
    currentVersion: 'v1.0',
    icon: 'payments',
    fileNameFragment: 'Basis_Price'
  }
];

export const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string; description: string }[] = DATASET_CATALOG.map(dataset => ({
  value: dataset.key,
  label: dataset.name,
  description: dataset.description
}));

export function getDatasetDefinition(type: EntityType): DatasetDefinition {
  return DATASET_CATALOG.find(dataset => dataset.key === type) ?? DATASET_CATALOG[0];
}
