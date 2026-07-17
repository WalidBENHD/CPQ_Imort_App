export type EntityType = 'Article' | 'PriceList' | 'Description' | 'CurrencyRate';
export type ImportStatus = 'Pending' | 'Processing' | 'AwaitingApproval' | 'NeedsCorrection' | 'Approved' | 'Committed' | 'Rejected' | 'Failed' | 'Cancelled';
export type ImportWorkflowStage = 'Private' | 'Submitted' | 'Approved' | 'Published' | 'Rejected' | 'Withdrawn';
export type RowStatus = 'Valid' | 'Warning' | 'Error';
export type ComparisonStatus = 'New' | 'Modified' | 'Unchanged';
export type ValidationAnchorKind = 0 | 1 | 2 | 3;
export type ReleasePackageStatus = 0 | 1 | 2 | 3 | 4 | 5;

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
  workflowStage: number;
  workflowStageLabel: ImportWorkflowStage;
  createdBy: string;
  createdByDisplayName: string;
  createdAt: string;
  processedAt: string | null;
  submittedAt: string | null;
  submittedByUserId: string | null;
  submittedByDisplayName: string | null;
  withdrawnAt: string | null;
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
  draftAddedRows: number;
  draftModifiedRows: number;
  draftRemovedRows: number;
  validationAnchorJobId: string | null;
  validationAnchorKind: ValidationAnchorKind;
  validationAnchorPinnedAt: string | null;
  releasePackageId: string | null;
}

export interface ValidationAnchorSummary {
  jobId: string;
  fileName: string;
  versionLabel: string;
  publishedAt: string | null;
  articleCount: number;
  isActive: boolean;
  isReleaseCandidate: boolean;
}

export interface DependencyImpact {
  totalRows: number;
  validReferences: number;
  missingReferences: number;
  articlesWithoutDependentData: number;
  missingArticleNumbers: string[];
}

export interface ReleasePackageItem {
  jobId: string;
  entityType: EntityType;
  datasetName: string;
  fileName: string;
  status: number;
  workflowStage: number;
  totalRows: number;
  errorRows: number;
  isValidationAnchor: boolean;
}

export interface ReleasePackage {
  id: string;
  name: string;
  status: ReleasePackageStatus;
  createdBy: string;
  createdByDisplayName: string;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByDisplayName: string | null;
  publishedAt: string | null;
  publishedByDisplayName: string | null;
  failureReason: string | null;
  items: ReleasePackageItem[];
}

export interface DependencyContext {
  jobId: string;
  isDependentDataset: boolean;
  anchorKind: ValidationAnchorKind;
  pinnedAt: string | null;
  currentAnchor: ValidationAnchorSummary | null;
  latestActiveMaster: ValidationAnchorSummary | null;
  hasNewerMaster: boolean;
  currentImpact: DependencyImpact;
  latestImpact: DependencyImpact | null;
  releasePackage: ReleasePackage | null;
  candidateMasters: ValidationAnchorSummary[];
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
  isUserAdded: boolean;
  isUserModified: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedByDisplayName: string | null;
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
  evolisMetrics: { total: number; thisMonth: number; successful: number; failed: number; failedThisMonth: number } | null;
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
  },
  {
    key: 'Description',
    name: 'Article Descriptions',
    description: 'Localized descriptions validated against a governed Article Master version.',
    owner: 'Saint-Marcellin PDU content owner',
    template: 'Article Description Template',
    status: 'Active',
    currentVersion: 'v1.0',
    icon: 'description',
    fileNameFragment: 'Article_Descriptions'
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
