export interface EvolisDecryptResponse {
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