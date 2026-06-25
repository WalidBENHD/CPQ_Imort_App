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
      border-radius: 12px; font-size: 12px; font-weight: 500; white-space: nowrap;
    }
    .badge.small { padding: 2px 6px; font-size: 11px; }
    .badge-pending           { background: #e0e0e0; color: #424242; }
    .badge-processing        { background: #e3f2fd; color: #1565c0; }
    .badge-awaiting-approval { background: #fff8e1; color: #f57f17; }
    .badge-committed         { background: #e8f5e9; color: #2e7d32; }
    .badge-rejected          { background: #ffebee; color: #c62828; }
    .badge-failed            { background: #fce4ec; color: #880e4f; }
    .badge-valid             { background: #e8f5e9; color: #2e7d32; }
    .badge-warning           { background: #fff8e1; color: #f57f17; }
    .badge-error             { background: #ffebee; color: #c62828; }
  `]
})
export class StatusBadgeComponent {
  @Input() status: AnyStatus = '';
  @Input() small = false;

  get label() {
    const labels: Record<string, string> = {
      AwaitingApproval: 'Awaiting Approval',
      Pending: 'Pending',
      Processing: 'Processing',
      Committed: 'Committed',
      Rejected: 'Rejected',
      Failed: 'Failed',
      Valid: 'Valid',
      Warning: 'Warning',
      Error: 'Error'
    };
    return labels[this.status] ?? this.status;
  }

  get badgeClass() {
    return `badge-${this.status.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`;
  }
}
