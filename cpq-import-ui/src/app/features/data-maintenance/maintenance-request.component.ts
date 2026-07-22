import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, forkJoin, finalize } from 'rxjs';
import { AuthFacade } from '../../core/auth/auth.facade';
import { DatasetRequirement, ImportComparison, ImportJob, ReleasePackage, StagingRow } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';
import { ToastService } from '../../core/services/toast.service';

interface MaintenanceRequestItem {
  job: ImportJob;
  comparison: ImportComparison;
  errorRows: StagingRow[];
}

@Component({
  selector: 'app-maintenance-request',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatIconModule],
  template: `
    <section class="request-page">
      <header class="request-hero">
        <div>
          <a routerLink="/maintenance/requests"><mat-icon>arrow_back</mat-icon> Maintenance requests</a>
          <span class="eyebrow"><mat-icon>edit_note</mat-icon> Governed business change set</span>
          <h1>{{ requestName }}</h1>
          <p>Review the requested record changes, dependency evidence and projected publication impact without leaving Data Maintenance.</p>
        </div>
        <div class="hero-status" [attr.data-status]="statusLabel">
          <span><i></i>{{ statusLabel }}</span>
          <small>{{ ownerName }}</small>
          <em>{{ createdAt | date:'dd MMM yyyy, HH:mm' }}</em>
        </div>
      </header>

      <div class="loading" *ngIf="loading"><mat-icon>sync</mat-icon><strong>Loading maintenance evidence…</strong></div>
      <div class="error" *ngIf="loadError"><mat-icon>error_outline</mat-icon><span><strong>Request unavailable</strong>It could not be loaded or you no longer have access.</span></div>

      <ng-container *ngIf="!loading && !loadError">
        <section class="correction-guidance" *ngIf="correctionReason">
          <mat-icon>assignment_return</mat-icon><div><strong>Correction requested by {{ correctionActor }}</strong><span>{{ correctionReason }}</span></div>
        </section>
        <section class="decision-bar">
          <div class="lifecycle">
            <span [class.done]="stage >= 0"><i>1</i><small>Prepared</small></span><b></b>
            <span [class.done]="stage >= 1"><i>2</i><small>Submitted</small></span><b></b>
            <span [class.done]="stage >= 2"><i>3</i><small>Approved</small></span><b></b>
            <span [class.done]="stage >= 3"><i>4</i><small>Published</small></span>
          </div>
          <div class="actions">
            <button mat-stroked-button color="warn" *ngIf="canDiscard" [disabled]="acting" (click)="showDiscard = true"><mat-icon>delete_outline</mat-icon>Discard</button>
            <button mat-stroked-button *ngIf="canWithdraw" [disabled]="acting" (click)="withdraw()"><mat-icon>undo</mat-icon>Withdraw</button>
            <button mat-stroked-button color="warn" *ngIf="canDecide" [disabled]="acting" (click)="showDecision = true"><mat-icon>assignment_return</mat-icon>Return for correction</button>
            <button mat-flat-button class="approve" *ngIf="canDecide" [disabled]="acting" (click)="approve()"><mat-icon>verified</mat-icon>Approve change set</button>
            <button mat-flat-button class="publish" *ngIf="canPublish" [disabled]="acting" (click)="publish()"><mat-icon>rocket_launch</mat-icon>Publish changes</button>
            <button mat-flat-button class="submit" *ngIf="canSubmit" [disabled]="acting || blockingErrors > 0" (click)="submit()"><mat-icon>send</mat-icon>Submit for approval</button>
          </div>
        </section>

        <section class="summary-grid">
          <article><mat-icon>difference</mat-icon><div><strong>{{ totalChanges }}</strong><span>Record changes</span></div></article>
          <article><mat-icon>dataset</mat-icon><div><strong>{{ items.length }}</strong><span>Affected datasets</span></div></article>
          <article [class.blocked]="blockingErrors"><mat-icon>{{ blockingErrors ? 'error' : 'verified_user' }}</mat-icon><div><strong>{{ blockingErrors }}</strong><span>Blocking rows</span></div></article>
          <article><mat-icon>account_tree</mat-icon><div><strong>{{ isCoordinated ? 'Coordinated' : 'Independent' }}</strong><span>Publication model</span></div></article>
        </section>

        <section class="validation-alert" [class.validation-alert--error]="blockingErrors">
          <mat-icon>{{ blockingErrors ? 'report_problem' : 'check_circle' }}</mat-icon>
          <div>
            <strong>{{ blockingErrors ? 'Correction is required before submission' : 'Server validation passed' }}</strong>
            <span>{{ blockingErrors ? 'Open the affected dataset below and correct its records in this maintenance request.' : 'The authoritative list rules and cross-dataset dependency checks accept the projected state.' }}</span>
          </div>
        </section>

        <section class="dataset-change" *ngFor="let item of items">
          <header>
            <span class="dataset-icon"><mat-icon>{{ datasetIcon(item.job.entityType) }}</mat-icon></span>
            <div><span>{{ item.job.entityTypeLabel }}</span><h2>{{ changeCount(item.comparison) }} requested changes</h2></div>
            <span class="validation-chip" [class.validation-chip--error]="item.job.errorRows"><mat-icon>{{ item.job.errorRows ? 'error' : 'check_circle' }}</mat-icon>{{ item.job.errorRows ? item.job.errorRows + ' blocking rows' : 'Validated' }}</span>
            <button mat-stroked-button *ngIf="canEdit" (click)="openRecords(item)"><mat-icon>edit</mat-icon>Edit records</button>
          </header>

          <section class="validation-errors" *ngIf="item.errorRows.length">
            <div class="validation-errors__title"><mat-icon>error</mat-icon><div><strong>Blocking validation errors</strong><span>Correct these records before submitting this change set.</span></div></div>
            <article *ngFor="let errorRow of item.errorRows">
              <div class="validation-error-record"><strong>{{ recordLabel(errorRow) }}</strong><span>Row {{ errorRow.rowNumber }}</span></div>
              <div class="validation-error-message" *ngFor="let message of errorRow.validationMessages" [attr.data-severity]="message.severity">
                <mat-icon>{{ message.severity === 'Error' ? 'cancel' : message.severity === 'Warning' ? 'warning' : 'info' }}</mat-icon>
                <span><strong>{{ message.field || 'Record' }}</strong>{{ message.message }}</span>
              </div>
            </article>
          </section>

          <div class="record-editor" *ngIf="editingJobId === item.job.id">
            <div class="record-editor__toolbar">
              <div><strong>{{ item.job.entityTypeLabel }} records</strong><span>Changes stay inside this maintenance request.</span></div>
              <button mat-flat-button class="submit" (click)="startAdd(item)"><mat-icon>add</mat-icon>Add record</button>
            </div>
            <div class="record-editor__row" *ngFor="let row of editableRows">
              <div><strong>{{ recordLabel(row) }}</strong><span class="inline-row-error" *ngFor="let message of row.validationMessages"><b>{{ message.field || 'Record' }}:</b> {{ message.message }}</span></div>
              <button mat-icon-button title="Edit record" (click)="startEdit(item, row)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button title="Deactivate record" (click)="deactivateRow(item, row)"><mat-icon>delete_outline</mat-icon></button>
            </div>
            <div class="record-editor__removed" *ngIf="removedRows.length">
              <strong>Deactivated records</strong>
              <div *ngFor="let row of removedRows"><span>{{ recordLabel(row) }}</span><button mat-stroked-button (click)="restoreRow(item, row)"><mat-icon>restore</mat-icon>Restore</button></div>
            </div>
          </div>

          <div class="change-section" *ngIf="changedRows(item.comparison).length">
            <h3>Added and modified records</h3>
            <article class="record-change" *ngFor="let row of changedRows(item.comparison)">
              <div class="record-change__head"><strong>{{ row.key }}</strong><span [attr.data-kind]="row.comparisonStatus">{{ row.comparisonStatus }}</span></div>
              <div class="record-validation" *ngFor="let message of validationMessagesFor(item, row.rowId)" [attr.data-severity]="message.severity">
                <mat-icon>{{ message.severity === 'Error' ? 'error' : 'warning' }}</mat-icon><span><strong>{{ message.field || 'Record' }}</strong>{{ message.message }}</span>
              </div>
              <div class="field-change" *ngFor="let field of differentFields(row.changes)">
                <span>{{ field.field }}</span>
                <del>{{ field.baselineValue || 'Not set' }}</del>
                <mat-icon>arrow_forward</mat-icon>
                <ins>{{ field.currentValue || 'Not set' }}</ins>
              </div>
            </article>
          </div>

          <div class="change-section removed" *ngIf="item.comparison.missingRows.length">
            <h3>Records to deactivate</h3>
            <article class="removed-row" *ngFor="let row of item.comparison.missingRows">
              <mat-icon>block</mat-icon><strong>{{ row.key }}</strong><span>Removed from the projected published state</span>
            </article>
          </div>

          <div class="unchanged-note" *ngIf="changeCount(item.comparison) === 0">
            <mat-icon>shield</mat-icon><span><strong>Dependency snapshot</strong>This dataset has no direct edits but is included to prove that the coordinated published state remains complete.</span>
          </div>
        </section>

        <section class="decision-panel" *ngIf="showDecision">
          <div class="decision-dialog">
            <header><mat-icon>assignment_return</mat-icon><div><span>Return for correction</span><h2>Explain what must change</h2></div></header>
            <textarea [(ngModel)]="decisionReason" maxlength="2000" placeholder="Give the request owner a precise, actionable reason"></textarea>
            <footer><button mat-button (click)="showDecision = false">Cancel</button><button mat-flat-button color="warn" [disabled]="!decisionReason.trim() || acting" (click)="returnForCorrection()">Return request</button></footer>
          </div>
        </section>

        <section class="decision-panel" *ngIf="editItem">
          <div class="decision-dialog record-dialog">
            <header><mat-icon>{{ editRow ? 'edit' : 'add_circle' }}</mat-icon><div><span>{{ editItem.job.entityTypeLabel }}</span><h2>{{ editRow ? 'Edit record' : 'Add record' }}</h2></div></header>
            <label *ngFor="let column of editRequirement?.columns">
              <span>{{ column.name }}<em *ngIf="column.required">Required</em></span>
              <input [(ngModel)]="editFields[column.name]" [class.input-error]="editFieldMessages(column.name).length" [placeholder]="column.example || column.description" />
              <small class="field-server-error" *ngFor="let message of editFieldMessages(column.name)"><mat-icon>error</mat-icon>{{ message }}</small>
            </label>
            <div class="record-server-errors" *ngIf="editGeneralMessages.length"><strong>Record validation</strong><span *ngFor="let message of editGeneralMessages"><mat-icon>error</mat-icon>{{ message }}</span></div>
            <footer><button mat-button (click)="closeRecordDialog()">Cancel</button><button mat-flat-button class="submit" [disabled]="acting" (click)="saveRecord()"><mat-icon>save</mat-icon>Save and validate</button></footer>
          </div>
        </section>

        <section class="decision-panel" *ngIf="showDiscard">
          <div class="decision-dialog discard-dialog">
            <header><mat-icon>delete_forever</mat-icon><div><span>Discard change set</span><h2>Permanently delete this private work?</h2></div></header>
            <p>This removes the change set and all of its staged record changes. This action cannot be undone.</p>
            <footer><button mat-button [disabled]="acting" (click)="showDiscard = false">Keep change set</button><button mat-flat-button color="warn" [disabled]="acting" (click)="discard()"><mat-icon>delete_forever</mat-icon>{{ acting ? 'Discarding…' : 'Discard permanently' }}</button></footer>
          </div>
        </section>
      </ng-container>
    </section>
  `,
  styles: [`
    :host{display:block;color:var(--app-text)}.request-page{display:grid;gap:18px}.request-hero{display:flex;justify-content:space-between;gap:28px;padding:28px 32px;border:1px solid color-mix(in srgb,#0f8f87 24%,var(--app-border));border-radius:22px;background:linear-gradient(125deg,color-mix(in srgb,var(--app-surface) 96%,#0f766e),color-mix(in srgb,var(--app-surface) 90%,#dbeafe));box-shadow:var(--app-shadow-soft)}.request-hero>div:first-child{display:grid;gap:7px}.request-hero a{display:inline-flex;align-items:center;gap:5px;width:max-content;color:var(--app-text-muted);font-size:11px;font-weight:750;text-decoration:none}.request-hero a mat-icon{width:16px;height:16px;font-size:16px}.eyebrow{display:flex;align-items:center;gap:6px;color:#0f8f87;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.eyebrow mat-icon{width:17px;height:17px;font-size:17px}h1{margin:0;font-size:34px;letter-spacing:-.035em}p{max-width:760px;margin:0;color:var(--app-text-muted);font-size:13px;line-height:1.5}.hero-status{align-self:center;display:grid;min-width:210px;gap:5px;padding:16px;border:1px solid var(--app-border);border-radius:12px;background:var(--app-surface)}.hero-status>span{display:flex;align-items:center;gap:7px;color:#b45309;font-size:12px;font-weight:850}.hero-status i{width:7px;height:7px;border-radius:50%;background:currentColor}.hero-status small,.hero-status em{color:var(--app-text-muted);font-size:10px;font-style:normal}.decision-bar{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:15px 18px;border:1px solid var(--app-border);border-radius:14px;background:var(--app-surface)}.lifecycle{display:flex;align-items:center;min-width:420px}.lifecycle span{display:grid;place-items:center;gap:4px;color:var(--app-text-muted)}.lifecycle i{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:var(--app-soft-surface);font-size:10px;font-style:normal;font-weight:900}.lifecycle span.done i{color:#fff;background:#0f8f87}.lifecycle span.done small{color:var(--app-text)}.lifecycle small{font-size:8px;font-weight:800}.lifecycle b{flex:1;height:2px;background:var(--app-border)}.actions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}.actions .approve,.actions .submit{color:#fff;background:#0f8f87}.actions .publish{color:#fff;background:#2563eb}.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.summary-grid article{display:flex;align-items:center;gap:12px;padding:16px;border:1px solid var(--app-border);border-radius:13px;background:var(--app-surface)}.summary-grid mat-icon{color:#0f8f87}.summary-grid div{display:grid}.summary-grid strong{font-size:20px}.summary-grid span{color:var(--app-text-muted);font-size:9px;text-transform:uppercase}.summary-grid article.blocked mat-icon,.summary-grid article.blocked strong{color:#dc2626}.validation-alert{display:flex;align-items:center;gap:11px;padding:14px 16px;border-left:4px solid #10b981;border-radius:0 10px 10px 0;color:#047857;background:color-mix(in srgb,#10b981 9%,var(--app-surface))}.validation-alert--error{border-color:#ef4444;color:#b91c1c;background:color-mix(in srgb,#ef4444 9%,var(--app-surface))}.validation-alert div{display:grid;gap:2px}.validation-alert strong{font-size:12px}.validation-alert span{color:var(--app-text-muted);font-size:10px}.dataset-change{overflow:hidden;border:1px solid var(--app-border);border-radius:16px;background:var(--app-surface);box-shadow:var(--app-shadow-soft)}.dataset-change>header{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:17px 20px;border-bottom:1px solid var(--app-border);background:var(--app-soft-surface)}.dataset-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;color:#0f766e;background:#ccfbf1}.dataset-change header div{display:grid}.dataset-change header div span{color:#0f8f87;font-size:9px;font-weight:850;text-transform:uppercase}.dataset-change h2{margin:2px 0 0;font-size:17px}.validation-chip{display:flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;color:#047857;background:#ecfdf5;font-size:9px;font-weight:850}.validation-chip mat-icon{width:14px;height:14px;font-size:14px}.validation-chip--error{color:#b91c1c;background:#fef2f2}.change-section{display:grid;gap:9px;padding:17px 20px}.change-section+.change-section{border-top:1px solid var(--app-border)}.change-section h3{margin:0 0 3px;font-size:11px;text-transform:uppercase;color:var(--app-text-muted)}.record-change{overflow:hidden;border:1px solid var(--app-border);border-radius:9px}.record-change__head{display:flex;justify-content:space-between;padding:9px 12px;background:var(--app-soft-surface)}.record-change__head strong{font-size:11px}.record-change__head span{color:#2563eb;font-size:9px;font-weight:850;text-transform:uppercase}.record-change__head span[data-kind="New"]{color:#047857}.field-change{display:grid;grid-template-columns:150px 1fr 20px 1fr;align-items:center;gap:9px;padding:8px 12px;border-top:1px solid var(--app-border);font-size:10px}.field-change>span{font-weight:800}.field-change del{color:#b91c1c;text-decoration:none}.field-change ins{color:#047857;text-decoration:none;font-weight:750}.field-change mat-icon{width:15px;height:15px;color:var(--app-text-muted);font-size:15px}.removed-row{display:grid;grid-template-columns:auto 180px 1fr;align-items:center;gap:9px;padding:10px 12px;border:1px solid #fecaca;border-radius:8px;background:color-mix(in srgb,#ef4444 5%,var(--app-surface));font-size:10px}.removed-row mat-icon{color:#dc2626}.removed-row span{color:var(--app-text-muted)}.unchanged-note{display:flex;gap:10px;padding:16px 20px}.unchanged-note mat-icon{color:#0f8f87}.unchanged-note span{display:grid;color:var(--app-text-muted);font-size:10px}.unchanged-note strong{color:var(--app-text);font-size:11px}.loading,.error{display:flex;justify-content:center;align-items:center;gap:10px;padding:70px;border:1px solid var(--app-border);border-radius:15px;background:var(--app-surface)}.loading mat-icon{animation:spin 1s linear infinite}.error{color:#b91c1c}.error span{display:grid}.decision-panel{position:fixed;inset:0;z-index:250;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.48)}.decision-dialog{width:min(560px,100%);padding:20px;border-radius:13px;background:var(--app-surface);box-shadow:0 25px 70px rgba(15,23,42,.3)}.decision-dialog header{display:flex;gap:10px}.decision-dialog header div{display:grid}.decision-dialog header span{color:#b91c1c;font-size:9px;font-weight:850;text-transform:uppercase}.decision-dialog h2{margin:2px 0;font-size:19px}.decision-dialog textarea{box-sizing:border-box;width:100%;min-height:120px;margin:16px 0;padding:10px;border:1px solid var(--app-border);border-radius:8px;resize:vertical;color:var(--app-text);background:var(--app-surface);font:inherit}.decision-dialog footer{display:flex;justify-content:flex-end;gap:8px}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:850px){.request-hero,.decision-bar{align-items:stretch;flex-direction:column}.hero-status{min-width:0}.summary-grid{grid-template-columns:1fr 1fr}.lifecycle{min-width:0}.field-change{grid-template-columns:1fr}.field-change mat-icon{transform:rotate(90deg)}.dataset-change>header{grid-template-columns:auto 1fr}.validation-chip{grid-column:1/-1;width:max-content}.actions{justify-content:stretch}.actions button{flex:1}}@media(max-width:520px){.request-hero{padding:20px}.summary-grid{grid-template-columns:1fr}.lifecycle small{display:none}}
  `, `
    .record-editor{display:grid;gap:8px;margin:0 18px 18px;padding:14px;border:1px solid var(--app-border);border-radius:10px;background:var(--app-soft-surface)}
    .record-editor__toolbar,.record-editor__row,.record-editor__removed>div{display:flex;align-items:center;gap:10px}
    .record-editor__toolbar{justify-content:space-between;padding-bottom:6px}.record-editor__toolbar>div,.record-editor__row>div{display:grid;flex:1;gap:2px}.record-editor__toolbar span,.record-editor__row span{color:var(--app-text-muted);font-size:11px}
    .record-editor__row .inline-row-error{color:#b91c1c}.inline-row-error b{font-size:9px;text-transform:uppercase}
    .record-editor__row{min-height:48px;padding:7px 10px;border:1px solid var(--app-border);border-radius:8px;background:var(--app-surface)}
    .record-editor__removed{display:grid;gap:6px;margin-top:6px;padding-top:12px;border-top:1px solid var(--app-border)}.record-editor__removed>div{justify-content:space-between}
    .validation-errors{display:grid;gap:10px;margin:0 18px 18px;padding:14px;border:1px solid #fecaca;border-radius:10px;background:#fff7f7}.validation-errors__title{display:flex;align-items:center;gap:9px;color:#b91c1c}.validation-errors__title>mat-icon{width:22px;height:22px;font-size:22px}.validation-errors__title>div{display:grid;gap:2px}.validation-errors__title strong{font-size:12px}.validation-errors__title span{color:#7f1d1d;font-size:10px}.validation-errors article{display:grid;grid-template-columns:minmax(130px,220px) 1fr;gap:8px 14px;padding:10px;border:1px solid #fecaca;border-radius:8px;background:var(--app-surface)}.validation-error-record{display:grid;align-content:start;gap:2px}.validation-error-record strong{font-size:11px}.validation-error-record span{color:var(--app-text-muted);font-size:9px}.validation-error-message,.record-validation{display:flex;align-items:flex-start;gap:7px;color:#b91c1c}.validation-error-message>mat-icon,.record-validation>mat-icon{flex:none;width:16px;height:16px;font-size:16px}.validation-error-message>span,.record-validation>span{display:grid;gap:2px;font-size:10px;line-height:1.4}.validation-error-message strong,.record-validation strong{font-size:9px;text-transform:uppercase}.validation-error-message[data-severity="Warning"],.record-validation[data-severity="Warning"]{color:#b45309}.record-validation{margin:8px 12px;padding:9px;border-left:3px solid currentColor;background:color-mix(in srgb,currentColor 7%,var(--app-surface))}
    :host-context(html.theme-dark) .validation-errors{border-color:rgba(248,113,113,.42);background:rgba(127,29,29,.18)}:host-context(html.theme-dark) .validation-errors article{border-color:rgba(248,113,113,.35)}:host-context(html.theme-dark) .validation-errors__title,:host-context(html.theme-dark) .validation-error-message,:host-context(html.theme-dark) .record-validation{color:#fca5a5}:host-context(html.theme-dark) .validation-errors__title span{color:#fecaca}
    .record-dialog{max-height:min(760px,90vh);overflow:auto}.record-dialog>label{display:grid;gap:5px}.record-dialog>label>span{display:flex;justify-content:space-between;font-size:11px;font-weight:800}.record-dialog label em{color:#b45309;font-size:9px;font-style:normal;text-transform:uppercase}
    .record-dialog input{box-sizing:border-box;width:100%;min-height:42px;padding:9px 11px;border:1px solid var(--app-border);border-radius:7px;background:var(--app-surface);color:var(--app-text);font:inherit}
    .record-dialog input.input-error{border-color:#ef4444;box-shadow:0 0 0 2px rgba(239,68,68,.1)}.field-server-error,.record-server-errors span{display:flex;align-items:flex-start;gap:5px;color:#b91c1c;font-size:10px;line-height:1.4}.field-server-error mat-icon,.record-server-errors mat-icon{flex:none;width:14px;height:14px;font-size:14px}.record-server-errors{display:grid;gap:6px;padding:10px;border-left:3px solid #dc2626;background:#fff7f7}.record-server-errors>strong{color:#991b1b;font-size:10px;text-transform:uppercase}
    @media(max-width:800px){.record-editor__toolbar{align-items:flex-start;flex-direction:column}.record-editor__row{align-items:flex-start;flex-wrap:wrap}.record-editor__row>div{flex-basis:100%}.validation-errors article{grid-template-columns:1fr}}
  `]
})
export class MaintenanceRequestComponent implements OnInit {
  readonly auth = inject(AuthFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly imports = inject(ImportService);
  private readonly toast = inject(ToastService);

  package: ReleasePackage | null = null;
  items: MaintenanceRequestItem[] = [];
  loading = true;
  loadError = false;
  acting = false;
  showDecision = false;
  showDiscard = false;
  decisionReason = '';
  editingJobId: string | null = null;
  editableRows: StagingRow[] = [];
  removedRows: StagingRow[] = [];
  editItem: MaintenanceRequestItem | null = null;
  editRow: StagingRow | null = null;
  editRequirement: DatasetRequirement | null = null;
  editFields: Record<string, string | null> = {};

  get kind(): 'package' | 'job' { return this.route.snapshot.paramMap.get('kind') === 'package' ? 'package' : 'job'; }
  get id(): string { return this.route.snapshot.paramMap.get('id') ?? ''; }
  get requestName(): string { return this.package?.name ?? this.items[0]?.job.originalFileName ?? 'Maintenance request'; }
  get ownerName(): string { return this.package?.createdByDisplayName ?? this.items[0]?.job.createdByDisplayName ?? ''; }
  get createdAt(): string | null { return this.package?.createdAt ?? this.items[0]?.job.createdAt ?? null; }
  get isOwner(): boolean { return (this.package?.createdBy ?? this.items[0]?.job.createdBy) === this.auth.userId; }
  get isCoordinated(): boolean { return !!this.package; }
  get blockingErrors(): number { return this.items.reduce((total, item) => total + item.job.errorRows, 0); }
  get totalChanges(): number { return this.items.reduce((total, item) => total + this.changeCount(item.comparison), 0); }
  get packageStatus(): number { return this.package?.status ?? -1; }
  get jobStage(): string { return this.items[0]?.job.workflowStageLabel ?? 'Private'; }
  get correctionReason(): string | null { return this.package?.rejectionReason ?? this.items[0]?.job.rejectionReason ?? null; }
  get correctionActor(): string { return this.package?.rejectedByDisplayName ?? this.items[0]?.job.rejectedBy ?? 'Reviewer'; }
  get statusLabel(): string {
    if (this.package) {
      if (this.package.status === 0 && this.correctionReason) return 'Correction requested';
      return ['Private draft', 'Awaiting approval', 'Approved', 'Publishing', 'Published', 'Publication failed', 'Rejected'][this.package.status] ?? 'Unknown';
    }
    if (this.jobStage === 'Private' && this.correctionReason) return 'Correction requested';
    return this.jobStage === 'Private' ? 'Private draft' : this.jobStage === 'Submitted' ? 'Awaiting approval' : this.jobStage;
  }
  get stage(): number {
    if (this.statusLabel === 'Published') return 3;
    if (this.statusLabel === 'Approved' || this.statusLabel === 'Publication failed') return 2;
    if (this.statusLabel === 'Awaiting approval') return 1;
    return 0;
  }
  get canSubmit(): boolean { return this.isOwner && ['Private draft', 'Correction requested'].includes(this.statusLabel); }
  get canDiscard(): boolean { return this.canSubmit && this.auth.hasCapability('imports.correct_own'); }
  get canEdit(): boolean { return this.canSubmit && this.auth.hasCapability('imports.correct_own'); }
  get canWithdraw(): boolean { return this.isOwner && this.statusLabel === 'Awaiting approval' && this.auth.hasCapability('imports.withdraw_own'); }
  get canDecide(): boolean { return !this.isOwner && this.statusLabel === 'Awaiting approval' && this.auth.hasCapability('imports.approve'); }
  get canPublish(): boolean { return this.statusLabel === 'Approved' && this.auth.hasCapability('imports.publish'); }

  ngOnInit(): void { this.load(); }

  changedRows(comparison: ImportComparison) { return comparison.rows.filter(row => row.comparisonStatus !== 'Unchanged'); }
  differentFields(changes: ImportComparison['rows'][number]['changes']) { return changes.filter(field => field.isDifferent); }
  validationMessagesFor(item: MaintenanceRequestItem, rowId: string) {
    return item.errorRows.find(row => row.id === rowId)?.validationMessages ?? [];
  }
  editFieldMessages(field: string): string[] {
    return this.editRow?.validationMessages
      .filter(message => message.severity === 'Error' && message.field.toLowerCase() === field.toLowerCase())
      .map(message => message.message) ?? [];
  }
  get editGeneralMessages(): string[] {
    const fieldNames = new Set(this.editRequirement?.columns.map(column => column.name.toLowerCase()) ?? []);
    return this.editRow?.validationMessages
      .filter(message => message.severity === 'Error' && !fieldNames.has(message.field.toLowerCase()))
      .map(message => message.message) ?? [];
  }
  changeCount(comparison: ImportComparison): number { return comparison.newRows + comparison.modifiedRows + comparison.missingBaselineRows; }
  datasetIcon(type: number): string { return type === 1 ? 'inventory_2' : type === 2 ? 'payments' : type === 3 ? 'translate' : 'currency_exchange'; }
  recordLabel(row: StagingRow): string { return Object.values(row.fields).find(value => value !== null && value !== '') ?? `Row ${row.rowNumber}`; }

  openRecords(item: MaintenanceRequestItem): void {
    if (this.editingJobId === item.job.id) {
      this.editingJobId = null;
      return;
    }
    this.acting = true;
    forkJoin({ active: this.imports.getRows(item.job.id, 1, 200), removed: this.imports.getRemovedRows(item.job.id) })
      .pipe(finalize(() => this.acting = false))
      .subscribe({
        next: result => {
          const errorIds = new Set(item.errorRows.map(row => row.id));
          this.editingJobId = item.job.id;
          this.editableRows = [...item.errorRows, ...result.active.items.filter(row => !errorIds.has(row.id))];
          this.removedRows = result.removed;
        },
        error: error => this.toast.error(error?.error?.error ?? 'The maintenance records could not be loaded.')
      });
  }

  startAdd(item: MaintenanceRequestItem): void { this.openRecordDialog(item, null); }
  startEdit(item: MaintenanceRequestItem, row: StagingRow): void { this.openRecordDialog(item, row); }
  closeRecordDialog(): void { this.editItem = null; this.editRow = null; this.editRequirement = null; this.editFields = {}; }

  saveRecord(): void {
    if (!this.editItem) return;
    const action = this.editRow
      ? this.imports.updateRow(this.editItem.job.id, this.editRow.id, this.editFields)
      : this.imports.addRow(this.editItem.job.id, this.editFields);
    this.mutateRecords(action, 'Record saved and validated.');
  }

  deactivateRow(item: MaintenanceRequestItem, row: StagingRow): void {
    this.editItem = item;
    this.mutateRecords(this.imports.deleteRows(item.job.id, [row.id]), 'Record deactivated from this change set.');
  }

  restoreRow(item: MaintenanceRequestItem, row: StagingRow): void {
    this.editItem = item;
    this.mutateRecords(this.imports.restoreRows(item.job.id, [row.id]), 'Record restored to this change set.');
  }

  private openRecordDialog(item: MaintenanceRequestItem, row: StagingRow | null): void {
    this.imports.getDatasetRequirement(item.job.entityType).subscribe({
      next: requirement => {
        this.editItem = item;
        this.editRow = row;
        this.editRequirement = requirement;
        this.editFields = requirement.columns.reduce((fields, column) => {
          fields[column.name] = row?.fields[column.name] ?? null;
          return fields;
        }, {} as Record<string, string | null>);
      },
      error: () => this.toast.error('The dataset field definitions could not be loaded.')
    });
  }

  private mutateRecords(action: Observable<ImportJob>, success: string): void {
    const item = this.editItem;
    this.acting = true;
    action.pipe(finalize(() => this.acting = false)).subscribe({
      next: () => {
        this.closeRecordDialog();
        this.toast.success(success);
        this.editingJobId = null;
        this.load();
        if (item) this.openRecords(item);
      },
      error: error => this.toast.error(error?.error?.error ?? 'The record change could not be saved.')
    });
  }

  load(): void {
    this.loading = true;
    this.loadError = false;
    const source: Observable<ImportJob | ReleasePackage> = this.kind === 'package'
      ? this.imports.getReleasePackage(this.id)
      : this.imports.getJob(this.id);
    source.subscribe({
      next: value => {
        this.package = this.kind === 'package' ? value as ReleasePackage : null;
        const jobIds = this.package ? this.package.items.map(item => item.jobId) : [(value as ImportJob).id];
        forkJoin(jobIds.map(jobId => forkJoin({
          job: this.imports.getJob(jobId),
          comparison: this.imports.getComparison(jobId),
          errors: this.imports.getRows(jobId, 1, 200, null, 'Error')
        })))
          .pipe(finalize(() => this.loading = false))
          .subscribe({
            next: items => this.items = items.map(item => ({ job: item.job, comparison: item.comparison, errorRows: item.errors.items })),
            error: () => this.loadError = true
          });
      },
      error: () => { this.loading = false; this.loadError = true; }
    });
  }

  submit(): void { this.run(this.package ? this.imports.submitReleasePackage(this.id) : this.imports.submitForReview(this.id), 'Change set submitted for approval.'); }
  withdraw(): void { this.run(this.package ? this.imports.withdrawReleasePackage(this.id) : this.imports.withdrawFromReview(this.id), 'Change set returned to your private workspace.'); }
  approve(): void { this.run(this.package ? this.imports.approveReleasePackage(this.id) : this.imports.approve(this.id), 'Maintenance request approved.'); }
  publish(): void { this.run(this.package ? this.imports.publishReleasePackage(this.id) : this.imports.publish(this.id), 'Maintenance changes published.'); }
  returnForCorrection(): void {
    const action = this.package
      ? this.imports.returnReleasePackageForCorrection(this.id, this.decisionReason.trim())
      : this.imports.returnForCorrection(this.id, this.decisionReason.trim());
    this.run(action, 'Maintenance request returned with correction guidance.');
  }

  discard(): void {
    const action = this.package
      ? this.imports.discardReleasePackage(this.id)
      : this.imports.deletePrivateDraft(this.id);
    this.acting = true;
    action.pipe(finalize(() => this.acting = false)).subscribe({
      next: () => {
        this.toast.success('Maintenance change set discarded.');
        void this.router.navigate(['/maintenance/requests']);
      },
      error: error => this.toast.error(error?.error?.error ?? 'The change set could not be discarded.')
    });
  }

  private run(action: Observable<unknown>, success: string): void {
    this.acting = true;
    action.pipe(finalize(() => this.acting = false)).subscribe({
      next: () => { this.showDecision = false; this.decisionReason = ''; this.toast.success(success); this.load(); },
      error: error => this.toast.error(error?.error?.error ?? 'The workflow action could not be completed.')
    });
  }
}
