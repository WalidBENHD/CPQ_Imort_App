import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApprovedComparisonSnapshot, ComparisonFieldChange, ComparisonRow } from '../../core/models/import.models';

@Component({
  selector: 'app-approval-record',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <mat-card class="approval-record-card">
      <mat-card-content>
        <ng-container *ngIf="snapshot as record; else approvalRecordStatus">
          <div class="approval-record-head">
            <div class="approval-record-title">
              <span class="approval-record-icon"><mat-icon>verified_user</mat-icon></span>
              <div>
                <div class="approval-record-eyebrow">Approval record</div>
                <h3>What the approver accepted</h3>
              </div>
            </div>
            <span class="approval-record-lock"><mat-icon>lock</mat-icon> Recorded at commit</span>
          </div>

          <p class="approval-record-copy">
            This is the exact server-side comparison approved by <strong>{{ record.approvedByDisplayName }}</strong>
            on <strong>{{ record.approvedAtUtc | date:'dd/MM/yyyy HH:mm' }}</strong>. It does not change when newer uploads are committed.
          </p>

          <div class="approval-baseline">
            <mat-icon>account_tree</mat-icon>
            <div>
              <span>Approved against</span>
              <ng-container *ngIf="record.comparison.hasBaseline; else initialApprovalBaseline">
                <a [routerLink]="['/import', record.comparison.baselineJobId]">previous approved baseline</a>
                <small>{{ record.comparison.baselineJobId }}</small>
              </ng-container>
              <ng-template #initialApprovalBaseline>
                <strong>Initial baseline</strong>
                <small>No earlier committed upload existed.</small>
              </ng-template>
            </div>
          </div>

          <div class="approval-metrics">
            <div class="approval-metric approval-new"><span>New</span><strong>{{ record.comparison.newRows }}</strong></div>
            <div class="approval-metric approval-modified"><span>Modified</span><strong>{{ record.comparison.modifiedRows }}</strong></div>
            <div class="approval-metric approval-unchanged"><span>Unchanged</span><strong>{{ record.comparison.unchangedRows }}</strong></div>
            <div class="approval-metric approval-missing"><span>Missing</span><strong>{{ record.comparison.missingBaselineRows }}</strong></div>
          </div>

          <div class="approval-impact-groups" *ngIf="hasApprovedImpact()">
            <details class="approval-impact approval-impact-new" *ngIf="record.comparison.newRows > 0">
              <summary><span>Rows approved for addition</span><strong>{{ record.comparison.newRows }}</strong></summary>
              <div class="approval-impact-list">
                <details class="approval-impact-item" *ngFor="let row of approvedRows('New')">
                  <summary><span>{{ row.key }}</span><small>View accepted values</small></summary>
                  <div class="approval-field-list">
                    <div class="approval-field" *ngFor="let change of row.changes">
                      <span>{{ change.field }}</span><strong>{{ change.currentValue || 'Empty' }}</strong>
                    </div>
                  </div>
                </details>
              </div>
            </details>

            <details class="approval-impact approval-impact-modified" *ngIf="record.comparison.modifiedRows > 0">
              <summary><span>Rows approved for update</span><strong>{{ record.comparison.modifiedRows }}</strong></summary>
              <div class="approval-impact-list">
                <details class="approval-impact-item" *ngFor="let row of approvedRows('Modified')">
                  <summary><span>{{ row.key }}</span><small>{{ approvedChangedFields(row) }}</small></summary>
                  <div class="approval-field-list">
                    <div class="approval-field approval-field-change" *ngFor="let change of approvedChanges(row)">
                      <span>{{ change.field }}</span>
                      <div><del>{{ change.baselineValue || 'Empty' }}</del><mat-icon>arrow_forward</mat-icon><strong>{{ change.currentValue || 'Empty' }}</strong></div>
                    </div>
                  </div>
                </details>
              </div>
            </details>

            <details class="approval-impact approval-impact-missing" *ngIf="record.comparison.missingBaselineRows > 0">
              <summary><span>Rows approved for scoped deletion</span><strong>{{ record.comparison.missingBaselineRows }}</strong></summary>
              <div class="approval-impact-list">
                <details class="approval-impact-item" *ngFor="let row of record.comparison.missingRows">
                  <summary><span>{{ row.key }}</span><small>View removed baseline values</small></summary>
                  <div class="approval-field-list">
                    <div class="approval-field" *ngFor="let field of row.baselineValues | keyvalue">
                      <span>{{ field.key }}</span><strong>{{ field.value || 'Empty' }}</strong>
                    </div>
                  </div>
                </details>
              </div>
            </details>
          </div>
        </ng-container>

        <ng-template #approvalRecordStatus>
          <div class="approval-record-empty" *ngIf="loading; else legacyApprovalRecord">
            <mat-spinner diameter="22"></mat-spinner>
            <span>Loading the approval record...</span>
          </div>
          <ng-template #legacyApprovalRecord>
            <div class="approval-record-empty">
              <mat-icon>history</mat-icon>
              <div>
                <strong>Historical comparison was not recorded</strong>
                <span>This upload was committed before approval evidence tracking was enabled.</span>
              </div>
            </div>
          </ng-template>
        </ng-template>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .approval-record-card { margin-bottom: 16px; border: 1px solid #b8c7e8; border-left: 5px solid #1d4ed8; box-shadow: 0 10px 28px rgba(30,64,175,.08); background: linear-gradient(135deg,#fff,#f5f8ff); }
    .approval-record-head,.approval-record-title,.approval-record-lock,.approval-baseline { display: flex; align-items: center; }
    .approval-record-head { justify-content: space-between; gap: 16px; }
    .approval-record-title { gap: 12px; }
    h3 { margin: 2px 0 0; color: #0f172a; font-size: 19px; }
    .approval-record-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: #fff; background: #1d4ed8; box-shadow: 0 6px 14px rgba(29,78,216,.24); }
    .approval-record-eyebrow { color: #1d4ed8; text-transform: uppercase; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
    .approval-record-lock { gap: 5px; padding: 6px 10px; border: 1px solid #bfdbfe; border-radius: 999px; color: #1e40af; background: #eff6ff; font-size: 12px; font-weight: 700; }
    .approval-record-lock mat-icon { width: 15px; height: 15px; font-size: 15px; }
    .approval-record-copy { margin: 16px 0; color: #334155; line-height: 1.6; }
    .approval-baseline { gap: 10px; padding: 11px 13px; border: 1px solid #dbeafe; border-radius: 10px; background: #fff; color: #334155; }
    .approval-baseline mat-icon { color: #2563eb; }
    .approval-baseline div { display: flex; align-items: baseline; flex-wrap: wrap; gap: 5px; }
    .approval-baseline span,.approval-baseline small { color: #64748b; }
    .approval-baseline a,.approval-baseline strong { color: #1d4ed8; font-weight: 800; }
    .approval-baseline small { width: 100%; font-size: 11px; word-break: break-all; }
    .approval-metrics { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-top: 14px; }
    .approval-metric { padding: 12px 14px; border: 1px solid #dbe3ef; border-top-width: 3px; border-radius: 11px; background: #fff; }
    .approval-metric span { display: block; color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .approval-metric strong { display: block; margin-top: 4px; color: #0f172a; font-size: 24px; }
    .approval-new { border-top-color: #16a34a; } .approval-modified { border-top-color: #4f46e5; } .approval-unchanged { border-top-color: #64748b; } .approval-missing { border-top-color: #ea580c; }
    .approval-impact-groups { display: grid; gap: 8px; margin-top: 14px; }
    .approval-impact { border: 1px solid #dbe3ef; border-radius: 10px; background: #fff; overflow: hidden; }
    .approval-impact > summary { display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 11px 13px; color: #334155; font-weight: 700; }
    summary::marker { color: #64748b; }
    .approval-impact > summary strong { min-width: 34px; padding: 3px 8px; text-align: center; border-radius: 999px; background: #f1f5f9; color: #0f172a; }
    .approval-impact-list { max-height: 220px; overflow-y: auto; border-top: 1px solid #e2e8f0; padding: 6px; }
    .approval-impact-item { padding: 8px 9px; border-radius: 7px; color: #0f172a; }
    .approval-impact-item:nth-child(odd) { background: #f8fafc; }
    .approval-impact-item > summary { display: flex; justify-content: space-between; gap: 12px; cursor: pointer; }
    .approval-impact-item > summary span { font-weight: 700; word-break: break-word; }
    .approval-impact-item > summary small { color: #64748b; text-align: right; }
    .approval-field-list { display: grid; gap: 5px; margin-top: 8px; padding: 8px; border-top: 1px dashed #cbd5e1; }
    .approval-field { display: grid; grid-template-columns: minmax(110px,.45fr) 1fr; gap: 10px; font-size: 12px; }
    .approval-field > span { color: #64748b; font-weight: 700; }
    .approval-field > strong { color: #0f172a; word-break: break-word; }
    .approval-field-change > div { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .approval-field-change del { color: #b91c1c; }
    .approval-field-change mat-icon { width: 14px; height: 14px; font-size: 14px; color: #64748b; }
    .approval-impact-new > summary { box-shadow: inset 4px 0 #16a34a; } .approval-impact-modified > summary { box-shadow: inset 4px 0 #4f46e5; } .approval-impact-missing > summary { box-shadow: inset 4px 0 #ea580c; }
    .approval-record-empty { display: flex; align-items: center; gap: 12px; color: #475569; }
    .approval-record-empty div { display: grid; gap: 2px; } .approval-record-empty strong { color: #0f172a; } .approval-record-empty span { font-size: 13px; }
    :host-context(html.theme-dark) .approval-record-card { border-color: rgba(96,165,250,.35); border-left-color: #60a5fa; background: linear-gradient(135deg,rgba(15,23,42,.98),rgba(17,30,58,.98)); box-shadow: 0 12px 30px rgba(0,0,0,.3); }
    :host-context(html.theme-dark) h3,:host-context(html.theme-dark) .approval-metric strong,:host-context(html.theme-dark) .approval-impact-item,:host-context(html.theme-dark) .approval-record-empty strong { color: #f8fafc; }
    :host-context(html.theme-dark) .approval-record-eyebrow { color: #93c5fd; } :host-context(html.theme-dark) .approval-record-copy { color: #cbd5e1; }
    :host-context(html.theme-dark) .approval-record-lock { color: #bfdbfe; border-color: rgba(96,165,250,.35); background: rgba(30,64,175,.2); }
    :host-context(html.theme-dark) .approval-baseline,:host-context(html.theme-dark) .approval-metric,:host-context(html.theme-dark) .approval-impact { background: rgba(15,23,42,.78); border-color: rgba(148,163,184,.22); }
    :host-context(html.theme-dark) .approval-baseline,:host-context(html.theme-dark) .approval-impact > summary { color: #cbd5e1; }
    :host-context(html.theme-dark) .approval-baseline a,:host-context(html.theme-dark) .approval-baseline strong { color: #93c5fd; }
    :host-context(html.theme-dark) .approval-impact > summary strong { color: #f8fafc; background: rgba(51,65,85,.85); }
    :host-context(html.theme-dark) .approval-impact-list { border-top-color: rgba(148,163,184,.18); }
    :host-context(html.theme-dark) .approval-impact-item:nth-child(odd) { background: rgba(30,41,59,.65); }
    :host-context(html.theme-dark) .approval-impact-item small,:host-context(html.theme-dark) .approval-record-empty { color: #94a3b8; }
    :host-context(html.theme-dark) .approval-field-list { border-top-color: rgba(148,163,184,.25); }
    :host-context(html.theme-dark) .approval-field > strong,:host-context(html.theme-dark) .approval-field-change strong { color: #f8fafc; }
    @media (max-width:600px) {
      .approval-record-card { border-left-width: 4px; } mat-card-content { padding: 14px !important; }
      .approval-record-head { align-items: flex-start; flex-direction: column; } .approval-record-lock { align-self: flex-start; }
      .approval-record-copy { margin: 13px 0; } .approval-baseline { align-items: flex-start; }
      .approval-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
      .approval-metric { padding: 10px 11px; } .approval-metric strong { font-size: 21px; }
      .approval-impact > summary { padding: 10px; }
      .approval-impact-item > summary { align-items: flex-start; flex-direction: column; gap: 2px; }
      .approval-impact-item > summary small { text-align: left; } .approval-field { grid-template-columns: 1fr; gap: 2px; }
    }
  `]
})
export class ApprovalRecordComponent {
  @Input() snapshot: ApprovedComparisonSnapshot | null = null;
  @Input() loading = false;

  approvedRows(status: 'New' | 'Modified'): ComparisonRow[] {
    return this.snapshot?.comparison.rows.filter(row => row.comparisonStatus === status) ?? [];
  }

  approvedChangedFields(row: ComparisonRow): string {
    const fields = this.approvedChanges(row).map(change => change.field);
    return fields.length === 1 ? `Changed field: ${fields[0]}` : `Changed fields: ${fields.join(', ')}`;
  }

  approvedChanges(row: ComparisonRow): ComparisonFieldChange[] {
    return row.changes.filter(change => change.isDifferent);
  }

  hasApprovedImpact(): boolean {
    const comparison = this.snapshot?.comparison;
    return !!comparison && (comparison.newRows > 0 || comparison.modifiedRows > 0 || comparison.missingBaselineRows > 0);
  }
}
