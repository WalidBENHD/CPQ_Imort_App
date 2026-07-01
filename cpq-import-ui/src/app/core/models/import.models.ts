export type EntityType = 'Article' | 'PriceList' | 'Description' | 'CurrencyRate';
export type ImportStatus = 'Pending' | 'Processing' | 'AwaitingApproval' | 'Committed' | 'Rejected' | 'Failed';
export type RowStatus = 'Valid' | 'Warning' | 'Error';

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

export const DATASET_CATALOG: DatasetDefinition[] = [
  {
    key: 'Article',
    name: 'Product Master',
    description: 'Core product attributes used across CPQ updates and downstream sites.',
    owner: 'Product Data Stewardship',
    template: 'Product Master Template',
    status: 'Active',
    currentVersion: 'v3.2',
    icon: 'inventory_2',
    fileNameFragment: 'Product_Master'
  },
  {
    key: 'PriceList',
    name: 'Pricing Conditions',
    description: 'Commercial prices and validity windows controlled by the pricing team.',
    owner: 'Pricing Operations',
    template: 'Pricing Conditions Template',
    status: 'Active',
    currentVersion: 'v4.1',
    icon: 'price_change',
    fileNameFragment: 'Pricing_Conditions'
  },
  {
    key: 'Description',
    name: 'Product Texts',
    description: 'Localized descriptions and content aligned across all international sites.',
    owner: 'Localization Team',
    template: 'Product Texts Template',
    status: 'Active',
    currentVersion: 'v2.5',
    icon: 'translate',
    fileNameFragment: 'Product_Texts'
  },
  {
    key: 'CurrencyRate',
    name: 'Exchange Rates',
    description: 'Currency conversion references used for international pricing updates.',
    owner: 'Finance Operations',
    template: 'Exchange Rates Template',
    status: 'Monitored',
    currentVersion: 'v1.8',
    icon: 'currency_exchange',
    fileNameFragment: 'Exchange_Rates'
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
