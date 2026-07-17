export interface EvolisDecryptResponse {
  runId: string;
  sourceFileName: string;
  downloadFileName: string;
  content: string;
}

export interface EvolisLineRowView {
  type: 'L';
  quantity: string;
  genericPartNumber: string;
}

export interface EvolisConfiguredRowView {
  type: 'C';
  genericPartNumber: string;
  quantity: string;
  description: string;
  unitPrice: string;
  totalPrice: string;
}

export interface EvolisTableView {
  title: string;
  idPanier: string;
  date: string;
  lineRows: EvolisLineRowView[];
  configuredRows: EvolisConfiguredRowView[];
  subtotal: string;
}

export interface EvolisPresentation {
  tables: EvolisTableView[];
  grandTotal: string;
}

export interface EvolisDecryptionRun {
  id: string;
  fileName: string;
  fileSize: number;
  userId: string;
  userDisplayName: string;
  startedAtUtc: string;
  completedAtUtc: string | null;
  status: number;
  statusLabel: 'Processing' | 'Successful' | 'Failed';
  outputFormat: string | null;
  failureReason: string | null;
}

export interface EvolisDecryptionHistory {
  items: EvolisDecryptionRun[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EvolisDecryptionMetrics {
  total: number;
  thisMonth: number;
  successful: number;
  failed: number;
  failedThisMonth: number;
}
