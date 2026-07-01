import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImportStatus, RowStatus } from '../../core/models/import.models';

type AnyStatus = ImportStatus | RowStatus | string;

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [class]="badgeClass" [class.small]="small">
      {{ label }}
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex; align-items: center; padding: 4px 10px;
      border-radius: 12px; font-size: 12px; font-weight: 600; white-space: nowrap;
      border: 1px solid transparent;
    }
    .badge.small { padding: 2px 6px; font-size: 11px; }
    .badge-pending           { background: #e0e0e0; color: #424242; border-color: #bdbdbd; }
    .badge-processing        { background: #e3f2fd; color: #1565c0; border-color: #bbdefb; }
    .badge-awaiting-approval { background: #fff8e1; color: #f57f17; border-color: #ffe082; font-weight: 700; }
    .badge-committed         { background: #e8f5e9; color: #2e7d32; border-color: #c8e6c9; font-weight: 700; }
    .badge-rejected          { background: #ffebee; color: #c62828; border-color: #ef9a9a; font-weight: 700; }
    .badge-failed            { background: #fce4ec; color: #880e4f; border-color: #f8bbd0; }
    .badge-valid             { background: #e8f5e9; color: #2e7d32; border-color: #c8e6c9; }
    .badge-warning           { background: #fff8e1; color: #f57f17; border-color: #ffe082; }
    .badge-error             { background: #ffebee; color: #c62828; border-color: #ef9a9a; }
  `]
})
export class StatusBadgeComponent {
  @Input() status: AnyStatus = '';
  @Input() small = false;

  get label() {
    const labels: Record<string, string> = {
      AwaitingApproval: 'Awaiting Approval',
      NeedsCorrection: 'Needs Correction',
      Pending: 'Pending',
      Processing: 'Processing',
      Committed: 'Committed',
      Rejected: 'Rejected',
      Failed: 'Failed',
      Cancelled: 'Cancelled',
      Valid: 'Valid',
      Warning: 'Warning',
      Error: 'Error'
    };
    return labels[this.status] ?? this.status;
  }

  get badgeClass() {
    const statusMap: Record<string, string> = {
      Pending: 'badge-pending',
      Processing: 'badge-processing',
      AwaitingApproval: 'badge-awaiting-approval',
      NeedsCorrection: 'badge-warning',
      Committed: 'badge-committed',
      Rejected: 'badge-rejected',
      Failed: 'badge-failed',
      Cancelled: 'badge-pending',
      Valid: 'badge-valid',
      Warning: 'badge-warning',
      Error: 'badge-error'
    };
    return statusMap[this.status as string] || `badge-${this.status.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`;
  }
}
