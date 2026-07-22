import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Observable, concatMap, finalize, from, map, switchMap, throwError, toArray } from 'rxjs';
import { ImportJob, MaintenanceDraft, StagingRow } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';
import { ToastService } from '../../core/services/toast.service';

type DatasetKey = 'Article' | 'PriceList' | 'Description' | 'CurrencyRate';
type ChangeAction = 'Add' | 'Modify' | 'Deactivate';

interface FieldDefinition {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select';
  required?: boolean;
  options?: string[];
  hint?: string;
}

interface DatasetDefinition {
  key: DatasetKey;
  name: string;
  description: string;
  icon: string;
  keyField: string;
  keyLabel: string;
  fields: FieldDefinition[];
}

interface MaintenanceRecord {
  id: string;
  dataset: DatasetKey;
  status: 'Active' | 'Inactive';
  values: Record<string, string>;
}

interface DraftChange {
  id: string;
  dataset: DatasetKey;
  datasetName: string;
  recordKey: string;
  identity: string;
  label: string;
  action: ChangeAction;
  values: Record<string, string>;
  valid: boolean;
}

const DATASETS: DatasetDefinition[] = [
  {
    key: 'Article',
    name: 'Article Master',
    description: 'Identity, classification and unit of measure',
    icon: 'inventory_2',
    keyField: 'ArticleNumber',
    keyLabel: 'Article number',
    fields: [
      { key: 'ArticleNumber', label: 'Article number', required: true, hint: 'No spaces allowed' },
      { key: 'Name', label: 'Article name', required: true },
      { key: 'Category', label: 'Category', required: true },
      { key: 'Unit', label: 'Unit', type: 'select', required: true, options: ['PC', 'SET', 'M'] }
    ]
  },
  {
    key: 'PriceList',
    name: 'Basis Price',
    description: 'Price, currency and period of validity',
    icon: 'payments',
    keyField: 'ArticleNumber',
    keyLabel: 'Article number',
    fields: [
      { key: 'ArticleNumber', label: 'Article number', required: true, hint: 'Must exist in Article Master' },
      { key: 'UnitPrice', label: 'Unit price', type: 'number', required: true },
      { key: 'Currency', label: 'Currency', type: 'select', required: true, options: ['EUR', 'CHF', 'USD'] },
      { key: 'ValidFrom', label: 'Valid from', type: 'date', required: true },
      { key: 'ValidTo', label: 'Valid to', type: 'date' }
    ]
  },
  {
    key: 'Description',
    name: 'Descriptions',
    description: 'Localized commercial descriptions',
    icon: 'translate',
    keyField: 'ArticleNumber',
    keyLabel: 'Article number',
    fields: [
      { key: 'ArticleNumber', label: 'Article number', required: true, hint: 'Must exist in Article Master' },
      { key: 'LanguageCode', label: 'Language', type: 'select', required: true, options: ['FR', 'EN', 'DE'] },
      { key: 'ShortDescription', label: 'Short description', required: true },
      { key: 'LongDescription', label: 'Long description' }
    ]
  },
  {
    key: 'CurrencyRate',
    name: 'Financial Rates',
    description: 'Currency conversion rates and effective periods',
    icon: 'currency_exchange',
    keyField: 'FromCurrency',
    keyLabel: 'Currency pair',
    fields: [
      { key: 'FromCurrency', label: 'From currency', required: true, hint: 'Three-letter ISO code' },
      { key: 'ToCurrency', label: 'To currency', required: true, hint: 'Three-letter ISO code' },
      { key: 'Rate', label: 'Rate', type: 'number', required: true },
      { key: 'ValidFrom', label: 'Valid from', type: 'date', required: true }
    ]
  }
];

@Component({
  selector: 'app-data-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule],
  template: `
    <section class="maintenance-page">
      <header class="maintenance-hero">
        <div class="maintenance-hero__copy">
          <span class="eyebrow"><mat-icon>edit_note</mat-icon> Governed record maintenance</span>
          <h1>Change one record.<br><span>Keep the whole portfolio safe.</span></h1>
          <p>Prepare precise business changes without rebuilding a complete list. Every record still follows the same validation, approval and publication controls.</p>
        </div>

        <aside class="scope-card">
          <span class="scope-card__signal"><i></i> Active pilot scope</span>
          <strong>Saint-Marcellin</strong>
          <span>PDU · Governed commercial data</span>
          <small><mat-icon>lock</mat-icon> Changes never cross scope boundaries</small>
        </aside>
      </header>

      <section class="operating-model" aria-label="Governed maintenance workflow">
        <header>
          <div>
            <span class="section-kicker">One governance model</span>
            <h2>A second way to prepare the same governed release</h2>
            <p>Record maintenance follows its own preparation, review and publication experience. Roles, dependencies and evidence remain unchanged.</p>
          </div>
          <span class="prototype-pill"><mat-icon>admin_panel_settings</mat-icon> Admin-only pilot</span>
        </header>

        <div class="maintenance-path">
          <div><span><mat-icon>edit_note</mat-icon></span><p><small>Prepare</small><strong>Individual records</strong><em>Add, modify or deactivate</em></p></div>
          <mat-icon>arrow_forward</mat-icon>
          <div><span><mat-icon>account_tree</mat-icon></span><p><small>Protect</small><strong>Validate dependencies</strong><em>Connected data travels together</em></p></div>
          <mat-icon>arrow_forward</mat-icon>
          <div><span><mat-icon>approval</mat-icon></span><p><small>Govern</small><strong>Existing roles apply</strong><em>Submit, approve and publish</em></p></div>
          <mat-icon>arrow_forward</mat-icon>
          <div><span><mat-icon>verified</mat-icon></span><p><small>Retain</small><strong>Publication evidence</strong><em>One defensible business history</em></p></div>
        </div>

        <div class="prototype-notice">
          <mat-icon>verified_user</mat-icon>
          <div><strong>Production governance is active</strong><span>Changes remain private while authoritative validation, approval and publication controls protect the portfolio.</span></div>
        </div>
      </section>

      <div class="workspace">
        <aside class="dataset-rail" aria-label="Datasets">
          <div class="rail-heading"><span>Maintain</span><strong>Choose a dataset</strong></div>
          <button
            *ngFor="let dataset of datasets"
            type="button"
            class="dataset-option"
            [class.dataset-option--active]="dataset.key === selectedDataset.key"
            (click)="selectDataset(dataset)">
            <span class="dataset-icon"><mat-icon>{{ dataset.icon }}</mat-icon></span>
            <span><strong>{{ dataset.name }}</strong><small>{{ dataset.description }}</small></span>
            <mat-icon class="dataset-chevron">chevron_right</mat-icon>
          </button>
          <div class="governance-note">
            <mat-icon>shield</mat-icon>
            <div><strong>Same governed path</strong><span>Prepare → validate → submit → approve → publish</span></div>
          </div>
        </aside>

        <main class="record-workspace">
          <div class="record-heading">
            <div class="record-title">
              <span class="record-icon"><mat-icon>{{ selectedDataset.icon }}</mat-icon></span>
              <div><span class="section-kicker">{{ selectedDataset.name }}</span><h2>Find and maintain records</h2></div>
            </div>
            <button mat-flat-button type="button" class="primary-action" (click)="startAdd()"><mat-icon>add</mat-icon> New record</button>
          </div>

          <div class="search-row">
            <label class="search-box">
              <mat-icon>search</mat-icon>
              <input [(ngModel)]="searchTerm" [placeholder]="'Search by ' + selectedDataset.keyLabel.toLowerCase() + ' or value'" />
              <button *ngIf="searchTerm" type="button" aria-label="Clear search" (click)="searchTerm = ''"><mat-icon>close</mat-icon></button>
            </label>
            <span class="record-count">{{ loadingRecords ? 'Loading…' : filteredRecords.length + ' records' }}</span>
          </div>

          <div class="record-table" *ngIf="filteredRecords.length; else noRecords">
            <div class="record-table-head">
              <span>{{ selectedDataset.keyLabel }}</span><span>Record details</span><span>Status</span><span>Actions</span>
            </div>
            <div class="record-row" *ngFor="let record of filteredRecords">
              <strong class="record-key">{{ record.values[selectedDataset.keyField] }}</strong>
              <div class="record-summary">
                <span *ngFor="let field of summaryFields(record)"><small>{{ field.label }}</small>{{ field.value }}</span>
              </div>
              <span class="status-pill" [class.status-pill--inactive]="record.status === 'Inactive'"><i></i>{{ record.status }}</span>
              <div class="row-actions">
                <button type="button" aria-label="Edit record" title="Edit record" (click)="startEdit(record)"><mat-icon>edit</mat-icon></button>
                <button type="button" aria-label="Deactivate record" title="Deactivate record" [disabled]="record.status === 'Inactive'" (click)="stageDeactivation(record)"><mat-icon>block</mat-icon></button>
              </div>
            </div>
          </div>
          <ng-template #noRecords><div class="empty-state"><mat-icon>search_off</mat-icon><strong>No matching records</strong><span>Try a different key or value.</span></div></ng-template>
        </main>

        <aside class="change-basket">
          <div class="basket-heading">
            <div><span class="section-kicker">Private working copy</span><h2>Change basket</h2></div>
            <span class="basket-count">{{ changes.length }}</span>
          </div>

          <div class="basket-empty" *ngIf="!changes.length">
            <mat-icon>playlist_add</mat-icon><strong>No changes yet</strong><span>Add, edit or deactivate a record. Changes stay private until deliberately submitted.</span>
          </div>

          <div class="change-list" *ngIf="changes.length">
            <article class="change-item" *ngFor="let change of changes">
              <span class="change-icon" [attr.data-action]="change.action"><mat-icon>{{ changeIcon(change.action) }}</mat-icon></span>
              <div><span>{{ change.datasetName }}</span><strong>{{ change.recordKey }}</strong><small>{{ change.action }} · {{ change.label }}</small></div>
              <button type="button" aria-label="Remove change" (click)="removeChange(change.id)"><mat-icon>close</mat-icon></button>
            </article>
          </div>

          <div class="basket-validation" *ngIf="changes.length">
            <div><mat-icon>check_circle</mat-icon><span><strong>Ready for validation</strong><small>{{ changes.length }} staged change{{ changes.length === 1 ? '' : 's' }}</small></span></div>
            <div><mat-icon>account_tree</mat-icon><span><strong>Dependencies enforced</strong><small>Article and price candidates are always paired</small></span></div>
          </div>

          <button mat-flat-button type="button" class="review-button" [disabled]="!changes.length" (click)="openReview()"><mat-icon>fact_check</mat-icon> Review draft release</button>
          <p class="basket-caption">The draft remains private until you submit it from its Maintenance request.</p>
        </aside>
      </div>
    </section>

    <div class="drawer-backdrop" *ngIf="editorOpen" (click)="closeEditor()"></div>
    <aside class="editor-drawer" *ngIf="editorOpen" aria-label="Record editor">
      <header class="drawer-header">
        <div><span class="section-kicker">{{ editorMode === 'add' ? 'New' : 'Modify' }} {{ selectedDataset.name }}</span><h2>{{ editorMode === 'add' ? 'Create a governed record' : editorValues[selectedDataset.keyField] }}</h2></div>
        <button type="button" aria-label="Close editor" (click)="closeEditor()"><mat-icon>close</mat-icon></button>
      </header>

      <div class="drawer-body">
        <div class="scope-context"><mat-icon>location_on</mat-icon><div><strong>Saint-Marcellin · PDU</strong><span>This record and its validation context remain inside the selected business scope.</span></div></div>

        <div class="field-grid">
          <label *ngFor="let field of selectedDataset.fields" [class.field-wide]="field.key === 'LongDescription'">
            <span>{{ field.label }} <i *ngIf="field.required">Required</i></span>
            <select *ngIf="field.type === 'select'; else inputField" [(ngModel)]="editorValues[field.key]" (ngModelChange)="validateEditor()">
              <option value="">Select {{ field.label.toLowerCase() }}</option>
              <option *ngFor="let option of field.options" [value]="option">{{ option }}</option>
            </select>
            <ng-template #inputField><input [type]="field.type ?? 'text'" [(ngModel)]="editorValues[field.key]" (ngModelChange)="validateEditor()" /></ng-template>
            <small *ngIf="field.hint">{{ field.hint }}</small>
            <em *ngIf="fieldError(field.key)">{{ fieldError(field.key) }}</em>
          </label>
        </div>

        <div class="dependency-alert" *ngIf="counterpartWarning">
          <mat-icon>account_tree</mat-icon>
          <div><strong>Matching {{ counterpartWarning }} required</strong><span>{{ counterpartWarning }} data for {{ editorValues['ArticleNumber'] }} must be included in this same coordinated release before it can be submitted.</span></div>
        </div>

        <section class="rule-panel">
          <div><mat-icon>verified_user</mat-icon><span><strong>Governed validation</strong><small>Authoritative dataset and dependency rules run before submission.</small></span></div>
          <ul>
            <li><mat-icon>check</mat-icon> Required fields and formats</li>
            <li><mat-icon>check</mat-icon> Duplicate business keys</li>
            <li><mat-icon>check</mat-icon> Cross-dataset dependencies</li>
            <li><mat-icon>check</mat-icon> Scope and role authorization</li>
          </ul>
        </section>
      </div>

      <footer class="drawer-footer">
        <button mat-button type="button" (click)="closeEditor()">Cancel</button>
        <button mat-flat-button type="button" class="primary-action" [disabled]="!editorValid" (click)="stageEditorChange()"><mat-icon>playlist_add</mat-icon> Add to change basket</button>
      </footer>
    </aside>

    <div class="review-backdrop" *ngIf="showReview" (click)="showReview = false">
      <section class="review-dialog" (click)="$event.stopPropagation()">
        <header><span class="review-icon"><mat-icon>fact_check</mat-icon></span><div><span class="section-kicker">Draft release review</span><h2>Changes are ready to validate</h2></div><button type="button" aria-label="Close review" (click)="showReview = false"><mat-icon>close</mat-icon></button></header>
        <div class="review-flow"><span class="active">1 <small>Prepare</small></span><i></i><span>2 <small>Validate</small></span><i></i><span>3 <small>Submit</small></span><i></i><span>4 <small>Approve</small></span><i></i><span>5 <small>Publish</small></span></div>
        <div class="review-summary"><div><strong>{{ changes.length }}</strong><span>Record changes</span></div><div><strong>{{ affectedDatasets }}</strong><span>Affected datasets</span></div><div><strong>Pending</strong><span>Server validation</span></div></div>
        <label class="draft-name"><span>Release name</span><input [(ngModel)]="draftName" maxlength="140" /></label>
        <div class="review-callout"><mat-icon>info</mat-icon><span><strong>Your Maintenance request is created next.</strong><small>The server creates full working snapshots, applies these record changes, and runs authoritative validation. You review and submit the request as a separate deliberate action.</small></span></div>
        <footer><button mat-stroked-button type="button" [disabled]="savingDraft" (click)="showReview = false">Back to draft</button><button mat-flat-button type="button" class="primary-action" [disabled]="savingDraft || !draftName.trim()" (click)="createGovernedDraft()"><mat-icon>play_arrow</mat-icon> {{ savingDraft ? 'Creating draft…' : 'Create governed draft' }}</button></footer>
      </section>
    </div>
  `,
  styles: [`
    :host { display:block; color:var(--app-text); }
    .maintenance-page { display:grid; gap:20px; width:100%; }
    .maintenance-hero { position:relative; overflow:hidden; display:flex; justify-content:space-between; align-items:flex-end; gap:36px; padding:30px 34px; border:1px solid color-mix(in srgb,#0f8f87 24%,var(--app-border)); border-radius:24px; background:linear-gradient(125deg,color-mix(in srgb,var(--app-surface) 96%,#0f766e),color-mix(in srgb,var(--app-surface) 90%,#dbeafe)); box-shadow:var(--app-shadow-soft); }
    .maintenance-hero::after { content:''; position:absolute; width:330px; height:330px; right:22%; top:-245px; border:70px solid rgba(20,184,166,.08); border-radius:50%; pointer-events:none; }
    .maintenance-hero__copy { position:relative; z-index:1; max-width:780px; }
    .eyebrow,.section-kicker { display:inline-flex; align-items:center; gap:6px; color:#0f8f87; font-size:11px; line-height:1.2; font-weight:850; letter-spacing:.1em; text-transform:uppercase; }
    .eyebrow mat-icon { width:18px; height:18px; font-size:18px; }
    h1 { margin:10px 0; color:var(--app-text); font-size:clamp(29px,3.1vw,48px); line-height:1.04; letter-spacing:-.045em; } h1 span { color:#0f8f87; }
    h2 { margin:3px 0 0; color:var(--app-text); font-size:20px; }
    .maintenance-hero__copy p { max-width:710px; margin:0; color:var(--app-text-muted); font-size:16px; line-height:1.55; }
    .scope-card { position:relative; z-index:1; min-width:285px; padding:18px 20px; display:grid; gap:5px; border:1px solid rgba(15,143,135,.28); border-radius:18px; background:color-mix(in srgb,var(--app-surface) 92%,#ccfbf1); }
    .scope-card__signal { display:flex; align-items:center; gap:7px; margin-bottom:5px; color:#0f766e; font-size:10px; font-weight:850; letter-spacing:.08em; text-transform:uppercase; }
    .scope-card__signal i { width:8px; height:8px; border-radius:50%; background:#14b8a6; box-shadow:0 0 0 5px rgba(20,184,166,.12); }
    .scope-card > strong { font-size:18px; } .scope-card > span:not(.scope-card__signal) { color:var(--app-text-muted); font-size:13px; }
    .scope-card small { display:flex; align-items:center; gap:5px; margin-top:8px; padding-top:10px; border-top:1px solid rgba(15,143,135,.16); color:#0f766e; font-weight:700; }
    .scope-card small mat-icon { width:15px; height:15px; font-size:15px; }
    .operating-model { padding:24px; border:1px solid var(--app-border); border-radius:22px; background:var(--app-surface); box-shadow:var(--app-shadow-soft); }
    .operating-model > header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; }
    .operating-model h2 { margin:5px 0 4px; font-size:21px; letter-spacing:-.025em; } .operating-model header p { margin:0; color:var(--app-text-muted); font-size:13px; line-height:1.45; }
    .prototype-pill { display:inline-flex; flex:none; align-items:center; gap:6px; padding:7px 10px; border:1px dashed color-mix(in srgb,#0f8f87 55%,transparent); border-radius:999px; color:#0f766e; background:color-mix(in srgb,#0f8f87 7%,transparent); white-space:nowrap; font-size:11px; font-weight:800; }
    .prototype-pill mat-icon { width:16px; height:16px; font-size:16px; }
    .maintenance-path { display:grid; grid-template-columns:1fr 24px 1fr; align-items:center; gap:8px; margin-top:20px; }
    .maintenance-path > div { display:grid; grid-template-columns:44px minmax(0,1fr); align-items:center; gap:10px; min-width:0; padding:13px; border:1px solid var(--app-border); border-radius:15px; background:var(--app-soft-surface); }
    .maintenance-path > div > span { display:grid; place-items:center; width:44px; height:44px; border-radius:13px; color:#0f8f87; background:color-mix(in srgb,#14b8a6 12%,transparent); }
    .maintenance-path > div:nth-of-type(2) > span { color:#2563eb; background:color-mix(in srgb,#2563eb 11%,transparent); }
    .maintenance-path > div:nth-of-type(3) > span { color:#b45309; background:color-mix(in srgb,#f59e0b 12%,transparent); }
    .maintenance-path > div:nth-of-type(4) > span { color:#15803d; background:color-mix(in srgb,#16a34a 12%,transparent); }
    .maintenance-path p { display:grid; min-width:0; gap:1px; margin:0; } .maintenance-path small { color:var(--app-text-muted); font-size:8px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
    .maintenance-path strong,.maintenance-path em { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .maintenance-path strong { font-size:12px; } .maintenance-path em { color:var(--app-text-muted); font-size:9px; font-style:normal; }
    .maintenance-path > mat-icon { justify-self:center; color:var(--app-text-muted); }
    .maintenance-path > mat-icon:nth-of-type(2) { display:none; }
    .prototype-notice { display:grid; grid-template-columns:auto 1fr; align-items:center; gap:9px; margin-top:18px; padding:11px 13px; border-left:4px solid #0f8f87; border-radius:0 10px 10px 0; color:#0f766e; background:color-mix(in srgb,#0f8f87 7%,transparent); }
    .prototype-notice > mat-icon { width:18px; height:18px; font-size:18px; } .prototype-notice div { display:grid; gap:1px; } .prototype-notice strong { font-size:11px; } .prototype-notice span { color:var(--app-text-muted); font-size:10px; }
    .workspace { display:grid; grid-template-columns:250px minmax(520px,1fr) 300px; align-items:start; gap:14px; padding-bottom:48px; }
    .dataset-rail,.record-workspace,.change-basket { border:1px solid var(--app-border); border-radius:20px; background:var(--app-surface); box-shadow:var(--app-shadow-soft); }
    .dataset-rail { position:sticky; top:74px; overflow:hidden; padding:14px; }
    .rail-heading { display:grid; gap:2px; padding:5px 7px 10px; } .rail-heading span { color:var(--app-text-muted); font-size:10px; font-weight:800; text-transform:uppercase; } .rail-heading strong { color:var(--app-text); font-size:15px; }
    .dataset-option { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:9px; width:100%; min-height:64px; margin:2px 0; padding:9px; border:1px solid transparent; border-radius:13px; color:var(--app-text); background:transparent; text-align:left; cursor:pointer; }
    .dataset-option:hover { background:var(--app-soft-surface); } .dataset-option--active { border-color:#99f6e4; background:#f0fdfa; }
    .dataset-icon { display:grid; place-items:center; width:38px; height:38px; border-radius:11px; color:#475569; background:#e2e8f0; }
    .dataset-option--active .dataset-icon { color:#0f766e; background:#ccfbf1; } .dataset-icon mat-icon { width:19px; height:19px; font-size:19px; }
    .dataset-option > span:nth-child(2) { display:grid; min-width:0; gap:2px; } .dataset-option strong { font-size:12px; } .dataset-option small { overflow:hidden; color:var(--app-text-muted); font-size:10px; line-height:1.25; text-overflow:ellipsis; }
    .dataset-chevron { width:17px; height:17px; color:#94a3b8; font-size:17px; }
    .governance-note { display:flex; gap:8px; margin-top:12px; padding:10px; border-top:1px solid var(--app-border); color:var(--app-text-muted); }
    .governance-note > mat-icon { width:18px; height:18px; color:#0f766e; font-size:18px; } .governance-note div { display:grid; gap:2px; } .governance-note strong { color:var(--app-text); font-size:11px; } .governance-note span { font-size:9px; line-height:1.4; }
    .record-workspace { position:sticky; top:74px; display:flex; flex-direction:column; height:calc(100dvh - 90px); min-height:0; overflow:hidden; }
    .record-heading { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:20px 22px 16px; border-bottom:1px solid var(--app-border); }
    .record-title { display:flex; align-items:center; gap:12px; } .record-icon { display:grid; place-items:center; width:46px; height:46px; border-radius:14px; color:#0f766e; background:#ccfbf1; }
    .primary-action { min-height:42px; color:#fff !important; background:linear-gradient(135deg,#0f8f87,#08776f) !important; border-radius:12px !important; font-weight:800; box-shadow:0 8px 18px rgba(15,143,135,.2); }
    .search-row { display:flex; align-items:center; gap:12px; padding:13px 18px; border-bottom:1px solid var(--app-border); background:var(--app-soft-surface); }
    .search-box { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:8px; flex:1; min-height:42px; padding:0 12px; border:1px solid var(--app-border); border-radius:12px; background:var(--app-surface); }
    .search-box:focus-within { border-color:#2dd4bf; box-shadow:0 0 0 3px rgba(45,212,191,.12); } .search-box > mat-icon { color:#64748b; }
    .search-box input { min-width:0; border:0; outline:0; color:var(--app-text); background:transparent; font:inherit; font-size:12px; }
    .search-box button,.row-actions button,.change-item button,.drawer-header button,.review-dialog header > button { display:grid; place-items:center; padding:0; border:0; color:var(--app-text-muted); background:transparent; cursor:pointer; }
    .search-box button mat-icon { width:17px; height:17px; font-size:17px; } .record-count { color:var(--app-text-muted); font-size:11px; font-weight:750; white-space:nowrap; }
    .record-table-head,.record-row { display:grid; grid-template-columns:1.05fr 2fr 82px 68px; align-items:center; gap:12px; padding:0 18px; }
    .record-table { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; scrollbar-gutter:stable; }
    .record-table-head { position:sticky; z-index:2; top:0; min-height:34px; color:var(--app-text-muted); background:var(--app-soft-surface); font-size:9px; font-weight:900; text-transform:uppercase; }
    .record-row { min-height:67px; border-top:1px solid var(--app-border); } .record-row:hover { background:color-mix(in srgb,var(--app-accent) 3%,transparent); }
    .record-key { color:var(--app-text); font-size:12px; } .record-summary { display:flex; min-width:0; gap:18px; }
    .record-summary span { display:grid; min-width:0; color:var(--app-text); font-size:11px; overflow-wrap:anywhere; } .record-summary small { margin-bottom:2px; color:var(--app-text-muted); font-size:8px; font-weight:800; text-transform:uppercase; }
    .status-pill { display:inline-flex; align-items:center; gap:5px; width:max-content; padding:4px 7px; border-radius:999px; color:#047857; background:#ecfdf5; font-size:9px; font-weight:850; }
    .status-pill i { width:5px; height:5px; border-radius:50%; background:#10b981; } .status-pill--inactive { color:#64748b; background:#f1f5f9; } .status-pill--inactive i { background:#94a3b8; }
    .row-actions { display:flex; gap:4px; } .row-actions button { width:28px; height:28px; border:1px solid var(--app-border); border-radius:6px; } .row-actions button:hover { color:#0f766e; border-color:#5eead4; background:#f0fdfa; } .row-actions button:disabled { opacity:.35; cursor:not-allowed; }
    .row-actions mat-icon { width:15px; height:15px; font-size:15px; }
    .empty-state { display:grid; place-items:center; gap:5px; padding:70px 20px; color:var(--app-text-muted); } .empty-state mat-icon { width:34px; height:34px; font-size:34px; } .empty-state strong { color:var(--app-text); }
    .change-basket { position:sticky; top:74px; overflow:hidden; }
    .basket-heading { display:flex; align-items:center; justify-content:space-between; padding:20px 18px 16px; border-bottom:1px solid var(--app-border); } .basket-heading h2 { font-size:18px; }
    .basket-count { display:grid; place-items:center; width:25px; height:25px; border-radius:7px; color:#fff; background:#0f766e; font-size:11px; font-weight:900; }
    .basket-empty { display:grid; place-items:center; gap:5px; padding:48px 22px; text-align:center; } .basket-empty mat-icon { width:32px; height:32px; color:#94a3b8; font-size:32px; } .basket-empty strong { color:var(--app-text); font-size:13px; } .basket-empty span { color:var(--app-text-muted); font-size:10px; line-height:1.45; }
    .change-list { max-height:280px; overflow:auto; padding:7px 11px; }
    .change-item { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:8px; padding:9px 3px; border-bottom:1px solid var(--app-border); } .change-item:last-child { border-bottom:0; }
    .change-icon { display:grid; place-items:center; width:30px; height:30px; border-radius:7px; color:#047857; background:#d1fae5; } .change-icon[data-action="Modify"] { color:#1d4ed8; background:#dbeafe; } .change-icon[data-action="Deactivate"] { color:#b91c1c; background:#fee2e2; }
    .change-icon mat-icon { width:16px; height:16px; font-size:16px; } .change-item > div { display:grid; gap:1px; min-width:0; } .change-item span { color:var(--app-text-muted); font-size:8px; text-transform:uppercase; } .change-item strong { color:var(--app-text); font-size:11px; } .change-item small { color:var(--app-text-muted); font-size:9px; }
    .change-item button mat-icon { width:15px; height:15px; font-size:15px; }
    .basket-validation { display:grid; gap:8px; padding:12px 15px; border-top:1px solid var(--app-border); background:var(--app-soft-surface); } .basket-validation > div { display:flex; align-items:center; gap:8px; } .basket-validation mat-icon { width:17px; height:17px; color:#0f766e; font-size:17px; } .basket-validation span { display:grid; } .basket-validation strong { color:var(--app-text); font-size:10px; } .basket-validation small { color:var(--app-text-muted); font-size:9px; }
    .review-button { width:calc(100% - 30px); margin:14px 15px 4px; color:#fff !important; background:#1d4ed8 !important; border-radius:7px !important; } .review-button:disabled { background:#94a3b8 !important; }
    .basket-caption { margin:3px 15px 13px; color:var(--app-text-muted); font-size:8px; text-align:center; }
    .drawer-backdrop,.review-backdrop { position:fixed; inset:58px 0 0; z-index:190; background:rgba(15,23,42,.42); backdrop-filter:blur(2px); }
    .editor-drawer { position:fixed; z-index:200; top:58px; right:0; bottom:0; display:flex; flex-direction:column; width:min(590px,100vw); border-left:1px solid var(--app-border); background:var(--app-surface); box-shadow:-18px 0 50px rgba(15,23,42,.18); animation:drawer-in 220ms ease-out; }
    .drawer-header { display:flex; align-items:center; justify-content:space-between; gap:15px; padding:18px 20px; border-bottom:1px solid var(--app-border); } .drawer-header h2 { font-size:22px; } .drawer-header button { width:34px; height:34px; border:1px solid var(--app-border); border-radius:7px; }
    .drawer-body { flex:1; overflow:auto; padding:18px 20px; }
    .scope-context { display:flex; gap:10px; padding:11px; border:1px solid #bfdbfe; border-radius:8px; color:#1e40af; background:#eff6ff; } .scope-context > mat-icon { width:19px; height:19px; font-size:19px; } .scope-context div { display:grid; gap:1px; } .scope-context strong { font-size:11px; } .scope-context span { font-size:9px; line-height:1.4; }
    .field-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin-top:18px; } .field-grid label { display:grid; align-content:start; gap:5px; } .field-grid .field-wide { grid-column:1/-1; }
    .field-grid label > span { color:var(--app-text); font-size:11px; font-weight:800; } .field-grid label i { margin-left:4px; color:#dc2626; font-size:8px; font-style:normal; text-transform:uppercase; }
    .field-grid input,.field-grid select { width:100%; min-height:40px; padding:0 10px; border:1px solid var(--app-border); border-radius:7px; outline:0; color:var(--app-text); background:var(--app-surface); font:inherit; font-size:12px; }
    .field-grid input:focus,.field-grid select:focus { border-color:#2dd4bf; box-shadow:0 0 0 3px rgba(45,212,191,.12); } .field-grid label > small { color:var(--app-text-muted); font-size:9px; } .field-grid em { color:#dc2626; font-size:9px; font-style:normal; }
    .dependency-alert { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:10px; margin-top:16px; padding:12px; border:1px solid #fbbf24; border-radius:8px; color:#92400e; background:#fffbeb; } .dependency-alert > mat-icon { color:#d97706; } .dependency-alert div { display:grid; gap:2px; } .dependency-alert strong { font-size:11px; } .dependency-alert span { font-size:9px; line-height:1.4; }
    .rule-panel { margin-top:18px; padding:14px; border:1px solid var(--app-border); border-radius:8px; background:var(--app-soft-surface); } .rule-panel > div { display:flex; gap:9px; } .rule-panel > div > mat-icon { color:#0f766e; } .rule-panel span { display:grid; } .rule-panel strong { color:var(--app-text); font-size:12px; } .rule-panel small { color:var(--app-text-muted); font-size:9px; }
    .rule-panel ul { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:12px 0 0; padding:0; list-style:none; } .rule-panel li { display:flex; align-items:center; gap:5px; color:var(--app-text-muted); font-size:10px; } .rule-panel li mat-icon { width:15px; height:15px; color:#059669; font-size:15px; }
    .drawer-footer { display:flex; justify-content:flex-end; gap:7px; padding:14px 20px; border-top:1px solid var(--app-border); background:var(--app-soft-surface); }
    .review-backdrop { inset:0; display:grid; place-items:center; z-index:230; padding:20px; }
    .review-dialog { width:min(680px,100%); overflow:hidden; border:1px solid var(--app-border); border-radius:10px; background:var(--app-surface); box-shadow:0 24px 70px rgba(15,23,42,.25); }
    .review-dialog header { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:12px; padding:18px; border-bottom:1px solid var(--app-border); } .review-icon { display:grid; place-items:center; width:42px; height:42px; border-radius:8px; color:#1d4ed8; background:#dbeafe; }
    .review-dialog header > button { width:31px; height:31px; border:1px solid var(--app-border); border-radius:7px; }
    .review-flow { display:flex; align-items:center; padding:20px 24px 14px; } .review-flow > span { display:grid; place-items:center; width:31px; height:31px; border-radius:50%; color:#64748b; background:#e2e8f0; font-size:10px; font-weight:900; } .review-flow > span.active { color:#fff; background:#0f766e; } .review-flow small { position:absolute; margin-top:50px; color:var(--app-text-muted); font-size:8px; font-weight:700; } .review-flow i { flex:1; height:2px; background:#e2e8f0; }
    .review-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin:28px 18px 0; } .review-summary div { display:grid; gap:3px; padding:12px; border:1px solid var(--app-border); border-radius:8px; background:var(--app-soft-surface); } .review-summary strong { color:var(--app-text); font-size:22px; } .review-summary span { color:var(--app-text-muted); font-size:9px; text-transform:uppercase; }
    .review-callout { display:flex; gap:10px; margin:14px 18px; padding:12px; border-left:4px solid #0f766e; border-radius:6px; color:#0f766e; background:#f0fdfa; } .review-callout span { display:grid; gap:2px; } .review-callout strong { font-size:11px; } .review-callout small { font-size:9px; line-height:1.45; }
    .draft-name { display:grid; gap:6px; margin:16px 18px 0; color:var(--app-text); font-size:11px; font-weight:800; } .draft-name input { min-height:40px; padding:0 10px; border:1px solid var(--app-border); border-radius:7px; outline:0; color:var(--app-text); background:var(--app-surface); font:inherit; } .draft-name input:focus { border-color:#2dd4bf; box-shadow:0 0 0 3px rgba(45,212,191,.12); }
    .review-dialog footer { display:flex; justify-content:flex-end; gap:8px; padding:14px 18px; border-top:1px solid var(--app-border); }
    :host-context(html.theme-dark) .eyebrow,
    :host-context(html.theme-dark) .section-kicker,
    :host-context(html.theme-dark) h1 span,
    :host-context(html.theme-dark) .scope-card__signal,
    :host-context(html.theme-dark) .scope-card small { color:#5eead4; }
    :host-context(html.theme-dark) .scope-card { background:color-mix(in srgb,var(--app-surface) 90%,#0f766e); }
    :host-context(html.theme-dark) .prototype-pill { border-color:rgba(45,212,191,.42); color:#5eead4; background:rgba(15,118,110,.18); }
    :host-context(html.theme-dark) .prototype-notice { border-left-color:#2dd4bf; color:#99f6e4; background:rgba(15,118,110,.18); }
    :host-context(html.theme-dark) .maintenance-path > div:nth-of-type(1) > span { color:#5eead4; }
    :host-context(html.theme-dark) .maintenance-path > div:nth-of-type(2) > span { color:#93c5fd; }
    :host-context(html.theme-dark) .maintenance-path > div:nth-of-type(3) > span { color:#fcd34d; }
    :host-context(html.theme-dark) .maintenance-path > div:nth-of-type(4) > span { color:#86efac; }
    :host-context(html.theme-dark) .dataset-option--active { border-color:rgba(45,212,191,.42); background:rgba(15,118,110,.2); }
    :host-context(html.theme-dark) .dataset-icon { color:#cbd5e1; background:rgba(71,85,105,.48); }
    :host-context(html.theme-dark) .dataset-option--active .dataset-icon,
    :host-context(html.theme-dark) .record-icon { color:#5eead4; background:rgba(13,148,136,.24); }
    :host-context(html.theme-dark) .dataset-chevron { color:#94a3b8; }
    :host-context(html.theme-dark) .governance-note > mat-icon,
    :host-context(html.theme-dark) .basket-validation mat-icon,
    :host-context(html.theme-dark) .rule-panel > div > mat-icon { color:#5eead4; }
    :host-context(html.theme-dark) .search-box:focus-within { border-color:#2dd4bf; box-shadow:0 0 0 3px rgba(45,212,191,.16); }
    :host-context(html.theme-dark) .search-box > mat-icon { color:#94a3b8; }
    :host-context(html.theme-dark) .status-pill { color:#6ee7b7; background:rgba(5,150,105,.2); }
    :host-context(html.theme-dark) .status-pill--inactive { color:#cbd5e1; background:rgba(71,85,105,.42); }
    :host-context(html.theme-dark) .row-actions button:hover { color:#5eead4; border-color:rgba(45,212,191,.55); background:rgba(15,118,110,.2); }
    :host-context(html.theme-dark) .change-icon { color:#6ee7b7; background:rgba(5,150,105,.22); }
    :host-context(html.theme-dark) .change-icon[data-action="Modify"] { color:#93c5fd; background:rgba(37,99,235,.24); }
    :host-context(html.theme-dark) .change-icon[data-action="Deactivate"] { color:#fca5a5; background:rgba(185,28,28,.24); }
    :host-context(html.theme-dark) .review-button:disabled { color:#cbd5e1 !important; background:#334155 !important; }
    :host-context(html.theme-dark) .scope-context { border-color:rgba(96,165,250,.38); color:#bfdbfe; background:rgba(30,64,175,.24); }
    :host-context(html.theme-dark) .field-grid label i,
    :host-context(html.theme-dark) .field-grid em { color:#fca5a5; }
    :host-context(html.theme-dark) .dependency-alert { border-color:rgba(251,191,36,.45); color:#fcd34d; background:rgba(146,64,14,.25); }
    :host-context(html.theme-dark) .dependency-alert > mat-icon { color:#fbbf24; }
    :host-context(html.theme-dark) .rule-panel li mat-icon { color:#34d399; }
    :host-context(html.theme-dark) .review-icon { color:#93c5fd; background:rgba(37,99,235,.24); }
    :host-context(html.theme-dark) .review-flow > span { color:#cbd5e1; background:#334155; }
    :host-context(html.theme-dark) .review-flow > span.active { color:#ecfeff; background:#0f766e; }
    :host-context(html.theme-dark) .review-flow i { background:#334155; }
    :host-context(html.theme-dark) .review-callout { border-left-color:#2dd4bf; color:#99f6e4; background:rgba(15,118,110,.2); }
    @keyframes drawer-in { from { transform:translateX(100%); } to { transform:translateX(0); } }
    @media (max-width:1200px) { .workspace { grid-template-columns:220px minmax(480px,1fr); } .change-basket { position:static; grid-column:1/-1; } }
    @media (max-width:820px) { .maintenance-hero { align-items:stretch; flex-direction:column; gap:24px; padding:25px 20px 20px; border-radius:21px; } .maintenance-hero h1 { font-size:35px; } .maintenance-hero__copy p { font-size:14px; } .scope-card { min-width:0; } .operating-model { padding:20px 16px; border-radius:19px; } .operating-model > header { align-items:flex-start; flex-direction:column; gap:12px; } .maintenance-path { grid-template-columns:1fr; gap:8px; } .maintenance-path > mat-icon,.maintenance-path > mat-icon:nth-of-type(2) { display:block; justify-self:center; transform:rotate(90deg); } .workspace { grid-template-columns:1fr; padding-bottom:0; } .dataset-rail { position:static; display:flex; gap:7px; overflow-x:auto; padding:8px; border-radius:16px; } .rail-heading,.governance-note { display:none; } .dataset-option { flex:0 0 175px; margin:0; } .record-workspace { position:static; height:auto; min-height:0; border-radius:18px; } .record-heading { align-items:stretch; flex-direction:column; } .record-heading .primary-action { width:100%; white-space:nowrap; } .change-basket { border-radius:18px; } .record-table { overflow:visible; } .record-table-head { display:none; } .record-row { grid-template-columns:1fr auto; gap:8px; padding:12px; } .record-summary { grid-column:1/-1; grid-row:2; } .status-pill { grid-column:2; grid-row:1; } .row-actions { grid-column:2; grid-row:2; } .field-grid { grid-template-columns:1fr; } .field-grid .field-wide { grid-column:auto; } .dependency-alert { grid-template-columns:auto 1fr; } .dependency-alert button { grid-column:1/-1; } }
  `]
})
export class DataMaintenanceComponent implements OnInit {
  private readonly imports = inject(ImportService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly datasets = DATASETS;
  records: MaintenanceRecord[] = [];
  selectedDataset = DATASETS[0];
  searchTerm = '';
  changes: DraftChange[] = [];
  editorOpen = false;
  editorMode: 'add' | 'edit' = 'add';
  editorValues: Record<string, string> = {};
  editorErrors: Record<string, string> = {};
  editingRecord: MaintenanceRecord | null = null;
  editorValid = false;
  showReview = false;
  loadingRecords = false;
  savingDraft = false;
  draftName = '';

  ngOnInit(): void {
    this.loadActiveRecords();
  }

  get filteredRecords(): MaintenanceRecord[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.records.filter(record => record.dataset === this.selectedDataset.key
      && (!term || Object.values(record.values).some(value => value.toLowerCase().includes(term))));
  }

  get counterpartWarning(): 'Article Master' | 'Basis Price' | null {
    if (!['Article', 'PriceList', 'Description'].includes(this.selectedDataset.key)) return null;
    const articleNumber = this.editorValues['ArticleNumber']?.trim();
    if (!articleNumber) return null;
    const requiredDataset: DatasetKey = this.selectedDataset.key === 'Article' ? 'PriceList' : 'Article';
    const exists = this.records.some(record => record.dataset === requiredDataset && record.status === 'Active'
      && record.values['ArticleNumber']?.toLowerCase() === articleNumber.toLowerCase());
    const staged = this.changes.some(change => change.dataset === requiredDataset && change.action !== 'Deactivate'
      && change.values['ArticleNumber']?.toLowerCase() === articleNumber.toLowerCase());
    return exists || staged ? null : requiredDataset === 'Article' ? 'Article Master' : 'Basis Price';
  }

  get affectedDatasets(): number {
    return new Set(this.changes.map(change => change.dataset)).size;
  }

  selectDataset(dataset: DatasetDefinition): void {
    if (this.changes.length && !this.datasetsShareRelease(this.changes[0].dataset, dataset.key)) {
      this.toast.warning('Finish or remove the current change basket before starting a different dataset release.');
      return;
    }
    this.selectedDataset = dataset;
    this.searchTerm = '';
    this.closeEditor();
    this.loadActiveRecords();
  }

  summaryFields(record: MaintenanceRecord): { label: string; value: string }[] {
    return this.selectedDataset.fields
      .filter(field => field.key !== this.selectedDataset.keyField && record.values[field.key])
      .slice(0, 2)
      .map(field => ({ label: field.label, value: record.values[field.key] }));
  }

  startAdd(): void {
    this.editorMode = 'add';
    this.editingRecord = null;
    this.editorValues = Object.fromEntries(this.selectedDataset.fields.map(field => [field.key, '']));
    this.editorErrors = {};
    this.editorValid = false;
    this.editorOpen = true;
  }

  startEdit(record: MaintenanceRecord): void {
    this.editorMode = 'edit';
    this.editingRecord = record;
    this.editorValues = { ...record.values };
    this.editorOpen = true;
    this.validateEditor();
  }

  closeEditor(): void {
    this.editorOpen = false;
    this.editingRecord = null;
  }

  validateEditor(): void {
    const errors: Record<string, string> = {};
    for (const field of this.selectedDataset.fields) {
      const value = this.editorValues[field.key]?.trim();
      if (field.required && !value) errors[field.key] = `${field.label} is required.`;
    }
    const keyValue = this.editorValues[this.selectedDataset.keyField]?.trim() ?? '';
    if (this.selectedDataset.key === 'Article' && /\s/.test(keyValue)) errors['ArticleNumber'] = 'Article number must not contain spaces.';
    for (const currencyField of ['Currency', 'FromCurrency', 'ToCurrency']) {
      const currency = this.editorValues[currencyField]?.trim();
      if (currency && !/^[A-Za-z]{3}$/.test(currency)) errors[currencyField] = 'Use a three-letter ISO currency code.';
    }
    if (this.selectedDataset.key === 'CurrencyRate' && this.editorValues['Rate'] && Number(this.editorValues['Rate']) <= 0) errors['Rate'] = 'Rate must be greater than zero.';
    if (this.editorValues['ValidFrom'] && this.editorValues['ValidTo'] && this.editorValues['ValidFrom'] > this.editorValues['ValidTo']) errors['ValidTo'] = 'Valid to must be after valid from.';
    this.editorErrors = errors;
    this.editorValid = Object.keys(errors).length === 0;
  }

  fieldError(key: string): string {
    return this.editorErrors[key] ?? '';
  }

  stageEditorChange(): void {
    this.validateEditor();
    if (!this.editorValid) return;
    const key = this.displayKey(this.selectedDataset.key, this.editorValues);
    const action: ChangeAction = this.editorMode === 'add' ? 'Add' : 'Modify';
    this.upsertChange({
      id: `change-${Date.now()}`,
      dataset: this.selectedDataset.key,
      datasetName: this.selectedDataset.name,
      recordKey: key,
      identity: this.identity(this.selectedDataset.key, this.editorValues),
      label: action === 'Add' ? 'New governed record' : 'Field values updated',
      action,
      values: { ...this.editorValues },
      valid: true
    });
    this.closeEditor();
  }

  stageDeactivation(record: MaintenanceRecord): void {
    this.upsertChange({
      id: `change-${Date.now()}`,
      dataset: this.selectedDataset.key,
      datasetName: this.selectedDataset.name,
      recordKey: this.displayKey(this.selectedDataset.key, record.values),
      identity: this.identity(this.selectedDataset.key, record.values),
      label: 'Retained in governed history',
      action: 'Deactivate',
      values: { ...record.values },
      valid: true
    });
  }

  removeChange(id: string): void {
    this.changes = this.changes.filter(change => change.id !== id);
  }

  changeIcon(action: ChangeAction): string {
    return action === 'Add' ? 'add' : action === 'Modify' ? 'edit' : 'block';
  }

  openReview(): void {
    this.draftName = `${this.changes[0]?.datasetName ?? 'Data'} maintenance ${new Date().toISOString().slice(0, 10)}`;
    this.showReview = true;
  }

  createGovernedDraft(): void {
    if (!this.changes.length || !this.draftName.trim() || this.savingDraft) return;
    this.savingDraft = true;
    const entryDataset: DatasetKey = this.changes.some(change => change.dataset === 'Article' || change.dataset === 'PriceList')
      ? 'Article'
      : this.changes[0].dataset;
    this.imports.createMaintenanceDraft(entryDataset, this.draftName.trim()).pipe(
      switchMap(draft => from(this.changes).pipe(
        concatMap(change => this.applyChange(draft, change)),
        toArray(),
        switchMap(() => from(draft.jobs).pipe(
          concatMap(job => this.imports.refreshValidation(job.id)),
          toArray()
        )),
        map(() => draft)
      )),
      finalize(() => this.savingDraft = false)
    ).subscribe({
      next: draft => {
        this.toast.success('Private governed draft created and validated.');
        const preferred = this.jobForDataset(draft, this.changes[0].dataset) ?? draft.jobs[0];
        const kind = draft.releasePackage ? 'package' : 'job';
        const requestId = draft.releasePackage?.id ?? preferred.id;
        this.router.navigate(['/maintenance/requests', kind, requestId]);
      },
      error: error => this.toast.error(error?.error?.error ?? error?.message ?? 'The governed draft could not be created.')
    });
  }

  private applyChange(draft: MaintenanceDraft, change: DraftChange): Observable<unknown> {
    const job = this.jobForDataset(draft, change.dataset);
    if (!job) return throwError(() => new Error(`No ${change.datasetName} candidate exists in this draft.`));
    if (change.action === 'Add') return this.imports.addRow(job.id, change.values);
    return this.imports.getRows(job.id, 1, 20, this.lookupKey(change)).pipe(
      switchMap(result => {
        const row = result.items.find(item => this.identity(change.dataset, item.fields) === change.identity);
        if (!row) return throwError(() => new Error(`${change.datasetName} record ${change.recordKey} was not found in the draft snapshot.`));
        return change.action === 'Modify'
          ? this.imports.updateRow(job.id, row.id, change.values)
          : this.imports.deleteRows(job.id, [row.id]);
      })
    );
  }

  private loadActiveRecords(): void {
    const dataset = this.selectedDataset.key;
    if (this.records.some(record => record.dataset === dataset)) return;
    this.loadingRecords = true;
    this.imports.getJobs(1, 20, null, 'Committed', dataset).pipe(
      switchMap(result => {
        const baseline = result.items.find(job => job.isActiveBaseline) ?? result.items[0];
        return baseline ? this.imports.getRows(baseline.id, 1, 200) : from([null]);
      }),
      finalize(() => this.loadingRecords = false)
    ).subscribe({
      next: result => {
        if (!result) return;
        this.records = [...this.records, ...result.items.map((row: StagingRow) => ({
          id: row.id,
          dataset,
          status: 'Active' as const,
          values: Object.fromEntries(Object.entries(row.fields).map(([key, value]) => [key, value ?? '']))
        }))];
      },
      error: () => this.toast.error(`Could not load the active ${this.selectedDataset.name} baseline.`)
    });
  }

  private jobForDataset(draft: MaintenanceDraft, dataset: DatasetKey): ImportJob | undefined {
    const entityValue: Record<DatasetKey, number> = { Article: 1, PriceList: 2, Description: 3, CurrencyRate: 4 };
    return draft.jobs.find(job => job.entityType === entityValue[dataset]);
  }

  private identity(dataset: DatasetKey, values: Record<string, string | null>): string {
    const fields = dataset === 'Description'
      ? ['ArticleNumber', 'LanguageCode']
      : dataset === 'CurrencyRate'
        ? ['FromCurrency', 'ToCurrency', 'ValidFrom']
        : ['ArticleNumber'];
    return fields.map(field => values[field]?.trim().toLowerCase() ?? '').join('|');
  }

  private displayKey(dataset: DatasetKey, values: Record<string, string | null>): string {
    if (dataset === 'CurrencyRate') return `${values['FromCurrency'] ?? ''}/${values['ToCurrency'] ?? ''}`;
    if (dataset === 'Description') return `${values['ArticleNumber'] ?? ''} · ${values['LanguageCode'] ?? ''}`;
    return values['ArticleNumber'] ?? '';
  }

  private lookupKey(change: DraftChange): string {
    return change.dataset === 'CurrencyRate'
      ? change.values['FromCurrency']
      : change.values['ArticleNumber'];
  }

  private datasetsShareRelease(left: DatasetKey, right: DatasetKey): boolean {
    return left === right || (['Article', 'PriceList'].includes(left) && ['Article', 'PriceList'].includes(right));
  }

  private upsertChange(change: DraftChange): void {
    this.changes = [...this.changes.filter(item => !(item.dataset === change.dataset && item.identity === change.identity)), change];
  }
}