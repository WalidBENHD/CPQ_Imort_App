import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Observable, concatMap, finalize, forkJoin, from, map, switchMap, throwError, toArray } from 'rxjs';
import { AuthFacade } from '../../core/auth/auth.facade';
import { ComparisonRow, ImportJob, MaintenanceDraft, StagingRow } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';
import { LocalMaintenanceChange, LocalMaintenanceDraft, MaintenanceDraftDatasetKey, MaintenanceLocalDraftService } from '../../core/services/maintenance-local-draft.service';
import { ToastService } from '../../core/services/toast.service';

type RequestSpace = 'mine' | 'approval' | 'approved' | 'history';
type RequestViewMode = 'detailed' | 'compact';

interface MaintenanceRequestCard {
  id: string;
  kind: 'package' | 'job';
  name: string;
  ownerId: string;
  owner: string;
  createdAt: string;
  jobs: ImportJob[];
  status: string;
  totalChanges: number;
  errors: number;
}

@Component({
  selector: 'app-maintenance-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatIconModule],
  template: `
    <section class="requests-page">
      <header class="requests-hero">
        <div><span class="eyebrow"><mat-icon>fact_check</mat-icon> Data maintenance</span><h1>Maintenance requests</h1><p>Create record changes, see validation errors before submission, and follow approvals and publication from one place.</p></div>
        <a *ngIf="canCreateMaintenance" mat-flat-button routerLink="/maintenance/new"><mat-icon>{{ localDraft ? 'edit' : 'add' }}</mat-icon>{{ localDraft ? 'Continue draft' : 'Add request' }}</a>
      </header>

      <nav class="spaces" aria-label="Maintenance request views">
        <button *ngFor="let space of spaces" type="button" class="space-card" [attr.data-space]="space.key" [class.active]="activeSpace === space.key" (click)="selectSpace(space.key)">
          <span class="space-icon"><mat-icon>{{ space.icon }}</mat-icon></span>
          <span class="space-copy"><small>{{ space.eyebrow }}</small><strong>{{ space.label }}</strong><em>{{ space.description }}</em></span>
          <b>{{ count(space.key) }}</b>
        </button>
      </nav>

      <section class="request-centre">
        <header class="centre-head">
          <div><span>{{ activeDefinition.eyebrow }}</span><h2>{{ activeDefinition.title }}</h2><p>{{ activeSpaceDefinition.description }}</p></div>
          <label><mat-icon>search</mat-icon><input [(ngModel)]="search" placeholder="Search name, owner or dataset" /></label>
        </header>

        <div class="view-toolbar" role="group" aria-label="Maintenance request list view">
          <div class="view-switch">
            <button type="button" [class.active]="viewMode === 'detailed'" (click)="setViewMode('detailed')"><mat-icon>view_agenda</mat-icon><span>Detailed</span></button>
            <button type="button" [class.active]="viewMode === 'compact'" (click)="setViewMode('compact')"><mat-icon>view_list</mat-icon><span>Compact</span></button>
          </div>
        </div>

        <div class="loading" *ngIf="loading"><mat-icon>sync</mat-icon>Loading maintenance requests…</div>
        <div class="empty" *ngIf="!loading && !filteredRequests.length && !showLocalDraft"><mat-icon>inbox</mat-icon><strong>No maintenance requests here</strong><span>{{ activeDefinition.empty }}</span></div>

        <div class="request-list" *ngIf="!loading && (filteredRequests.length || showLocalDraft) && viewMode === 'detailed'">
          <article class="request-card local-draft" *ngIf="showLocalDraft">
            <span class="request-mark"><mat-icon>edit_note</mat-icon></span>
            <div class="request-main">
              <div class="request-title-row"><strong>{{ localDraft?.name || 'Untitled maintenance request' }}</strong><span class="request-status" data-status="Private draft"><i></i>Private draft</span><span class="readiness-pill" *ngIf="localDraftReady"><mat-icon>check_circle</mat-icon>Ready to submit</span></div>
              <div class="request-details"><span><mat-icon>lock_person</mat-icon>Private working copy</span><span><mat-icon>schedule</mat-icon>Saved {{ localDraft?.updatedAt | date:'dd MMM yyyy, HH:mm' }}</span><span><mat-icon>difference</mat-icon>{{ localDraft?.changes?.length }} staged changes</span></div>
              <div class="datasets"><span *ngFor="let dataset of localDraftDatasetNames"><mat-icon>{{ datasetIconByName(dataset) }}</mat-icon>{{ dataset }}</span></div>
              <p class="item-note" *ngIf="localDraftReady"><mat-icon>check_circle</mat-icon>No blocking issues. Continue to validate and push for approval.</p>
              <p class="item-note item-note--blocked" *ngIf="localDraftReadinessKnown && !localDraftReady"><mat-icon>error_outline</mat-icon>{{ localDraftIssueCount }} blocking check{{ localDraftIssueCount === 1 ? '' : 's' }} remain. Continue to resolve {{ localDraftIssueCount === 1 ? 'it' : 'them' }}.</p>
              <p class="item-note item-note--blocked" *ngIf="!localDraftReadinessKnown"><mat-icon>pending</mat-icon>Continue to check this draft before submission.</p>
            </div>
            <div class="item-actions"><button *ngIf="localDraftReady && auth.hasCapability('imports.submit')" mat-raised-button color="primary" [disabled]="pushingLocalDraft" (click)="pushLocalDraft()"><mat-icon>send</mat-icon>{{ pushingLocalDraft ? 'Validating...' : 'Push for approval' }}</button><a mat-stroked-button routerLink="/maintenance/new"><mat-icon>arrow_forward</mat-icon>Continue</a><button *ngIf="auth.hasCapability('imports.correct_own')" mat-stroked-button color="warn" (click)="discardLocalDraftPending = true"><mat-icon>delete_outline</mat-icon>Discard</button></div>
          </article>
          <article class="request-card" *ngFor="let request of filteredRequests">
            <span class="request-mark" [class.request-mark--published]="request.status === 'Published'"><mat-icon>{{ request.status === 'Published' ? 'verified' : request.kind === 'package' ? 'account_tree' : 'edit_note' }}</mat-icon></span>
            <div class="request-main">
              <div class="request-title-row"><strong>{{ request.name }}</strong><span class="request-status" [attr.data-status]="request.status"><i></i>{{ request.status }}</span></div>
              <div class="request-details"><span><mat-icon>{{ request.kind === 'package' ? 'hub' : 'dataset' }}</mat-icon>{{ request.kind === 'package' ? 'Coordinated change set' : 'Dataset change set' }}</span><span><mat-icon>person</mat-icon>{{ request.owner }}</span><span><mat-icon>schedule</mat-icon>{{ request.createdAt | date:'dd MMM yyyy, HH:mm' }}</span><span><mat-icon>difference</mat-icon>{{ request.totalChanges }} record changes</span></div>
              <div class="datasets"><span *ngFor="let job of request.jobs"><mat-icon>{{ datasetIcon(job.entityType) }}</mat-icon>{{ job.entityTypeLabel }}</span></div>
              <p class="item-note item-note--error" *ngIf="request.errors"><mat-icon>error</mat-icon>{{ request.errors }} blocking validation row{{ request.errors === 1 ? '' : 's' }}</p>
            </div>
            <div class="item-actions" (click)="$event.stopPropagation()">
              <a *ngIf="canReview(request)" mat-raised-button color="primary" [routerLink]="['/maintenance', request.kind, request.id]"><mat-icon>fact_check</mat-icon>Review and decide</a>
              <button *ngIf="canWithdraw(request)" mat-stroked-button [disabled]="actingRequestId === request.id" (click)="withdraw(request, $event)"><mat-icon>undo</mat-icon>{{ request.kind === 'package' ? 'Withdraw release' : 'Withdraw' }}</button>
              <button *ngIf="canDiscard(request)" mat-stroked-button color="warn" (click)="discardCandidate = request"><mat-icon>delete_outline</mat-icon>Discard</button>
              <button *ngIf="canPublish(request)" mat-raised-button color="primary" [disabled]="actingRequestId === request.id" (click)="publish(request, $event)"><mat-icon>rocket_launch</mat-icon>{{ actingRequestId === request.id ? 'Publishing…' : 'Publish changes' }}</button>
              <a mat-stroked-button [routerLink]="['/maintenance', request.kind, request.id]"><mat-icon>{{ request.status === 'Published' || request.status === 'Returned' ? 'history_edu' : 'visibility' }}</mat-icon>{{ request.status === 'Published' || request.status === 'Returned' ? 'Open evidence' : 'Open' }}</a>
            </div>
          </article>
        </div>

        <div class="compact-list" *ngIf="!loading && (filteredRequests.length || showLocalDraft) && viewMode === 'compact'">
          <article class="compact-row compact-row--local" *ngIf="showLocalDraft">
            <span class="compact-led"></span>
            <span class="compact-name"><strong>{{ localDraft?.name || 'Untitled maintenance request' }}</strong><small><mat-icon>lock_person</mat-icon>Private working copy</small></span>
            <span class="compact-datasets">{{ localDraftDatasetNames.join(' · ') }}</span>
            <span class="compact-changes">{{ localDraft?.changes?.length }} changes</span>
            <span class="compact-owner">{{ auth.userName }}</span>
            <span class="compact-date">{{ localDraft?.updatedAt | date:'dd MMM, HH:mm' }}</span>
            <span class="compact-status" [attr.data-status]="localDraftReady ? 'Ready to submit' : 'Private draft'">{{ localDraftReady ? 'Ready to submit' : 'Private draft' }}</span>
            <div class="compact-actions"><button *ngIf="localDraftReady && auth.hasCapability('imports.submit')" mat-icon-button [disabled]="pushingLocalDraft" title="Push for approval" aria-label="Push local maintenance draft for approval" (click)="pushLocalDraft()"><mat-icon>send</mat-icon></button><a mat-icon-button routerLink="/maintenance/new" title="Continue" aria-label="Continue local maintenance draft"><mat-icon>arrow_forward</mat-icon></a><button *ngIf="auth.hasCapability('imports.correct_own')" mat-icon-button color="warn" title="Discard" aria-label="Discard local maintenance draft" (click)="discardLocalDraftPending = true"><mat-icon>delete_outline</mat-icon></button></div>
          </article>
          <article class="compact-row" *ngFor="let request of filteredRequests">
            <span class="compact-led" [class.compact-led--published]="request.status === 'Published'" [class.compact-led--error]="request.errors > 0"></span>
            <span class="compact-name"><strong>{{ request.name }}</strong><small><mat-icon>{{ request.kind === 'package' ? 'hub' : 'dataset' }}</mat-icon>{{ request.kind === 'package' ? 'Coordinated change set' : 'Dataset change set' }}</small></span>
            <span class="compact-datasets">{{ requestDatasetNames(request) }}</span>
            <span class="compact-changes">{{ request.totalChanges }} changes</span>
            <span class="compact-owner">{{ request.owner }}</span>
            <span class="compact-date">{{ request.createdAt | date:'dd MMM, HH:mm' }}</span>
            <span class="compact-status" [attr.data-status]="request.status">{{ request.status }}</span>
            <div class="compact-actions">
              <a *ngIf="canReview(request)" mat-icon-button [routerLink]="['/maintenance', request.kind, request.id]" title="Review and decide" [attr.aria-label]="'Review and decide ' + request.name"><mat-icon>fact_check</mat-icon></a>
              <button *ngIf="canWithdraw(request)" mat-icon-button [disabled]="actingRequestId === request.id" title="Withdraw" [attr.aria-label]="'Withdraw ' + request.name" (click)="withdraw(request, $event)"><mat-icon>undo</mat-icon></button>
              <button *ngIf="canDiscard(request)" mat-icon-button color="warn" title="Discard" [attr.aria-label]="'Discard ' + request.name" (click)="discardCandidate = request"><mat-icon>delete_outline</mat-icon></button>
              <button *ngIf="canPublish(request)" mat-icon-button [disabled]="actingRequestId === request.id" title="Publish changes" [attr.aria-label]="'Publish ' + request.name" (click)="publish(request, $event)"><mat-icon>rocket_launch</mat-icon></button>
              <a mat-icon-button [routerLink]="['/maintenance', request.kind, request.id]" [title]="request.status === 'Published' || request.status === 'Returned' ? 'Open evidence' : 'Open request'" [attr.aria-label]="'Open ' + request.name"><mat-icon>{{ request.status === 'Published' || request.status === 'Returned' ? 'history_edu' : 'visibility' }}</mat-icon></a>
            </div>
          </article>
        </div>
      </section>

      <div class="discard-backdrop" *ngIf="discardCandidate || discardLocalDraftPending" (click)="closeDiscard()"></div>
      <section class="discard-dialog" *ngIf="discardCandidate || discardLocalDraftPending" role="dialog" aria-modal="true" aria-labelledby="discard-title">
        <header><mat-icon>delete_forever</mat-icon><div><span>Discard change set</span><h2 id="discard-title">Permanently delete {{ discardCandidate?.name || localDraft?.name || 'this maintenance draft' }}?</h2></div></header>
        <p>This removes the private change set and all of its staged record changes. This action cannot be undone.</p>
        <footer><button mat-button [disabled]="discarding" (click)="closeDiscard()">Keep change set</button><button mat-flat-button color="warn" [disabled]="discarding" (click)="discard()"><mat-icon>delete_forever</mat-icon>{{ discarding ? 'Discarding…' : 'Discard permanently' }}</button></footer>
      </section>
    </section>
  `,
  styles: [`
    :host{display:block;color:var(--app-text)}.requests-page{display:grid;gap:18px}.requests-hero{display:flex;justify-content:space-between;align-items:end;gap:24px;padding:29px 32px;border:1px solid color-mix(in srgb,#0f8f87 24%,var(--app-border));border-radius:22px;background:linear-gradient(125deg,color-mix(in srgb,var(--app-surface) 96%,#0f766e),color-mix(in srgb,var(--app-surface) 90%,#dbeafe));box-shadow:var(--app-shadow-soft)}.requests-hero>div{display:grid;gap:6px}.eyebrow{display:flex;align-items:center;gap:6px;color:#0f8f87;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.eyebrow mat-icon{width:17px;height:17px;font-size:17px}h1{margin:0;font-size:36px;letter-spacing:-.04em}.requests-hero p{max-width:720px;margin:0;color:var(--app-text-muted);font-size:13px;line-height:1.5}.requests-hero a{color:#fff;background:#0f8f87}.spaces{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.spaces button{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;min-height:70px;padding:12px;border:1px solid var(--app-border);border-radius:12px;color:var(--app-text);background:var(--app-surface);text-align:left;cursor:pointer}.spaces button>mat-icon{color:var(--app-text-muted)}.spaces button span{display:grid;gap:2px}.spaces strong{font-size:11px}.spaces small{color:var(--app-text-muted);font-size:8px}.spaces b{display:grid;place-items:center;min-width:25px;height:25px;border-radius:7px;background:var(--app-soft-surface);font-size:10px}.spaces button.active{border-color:#5eead4;background:color-mix(in srgb,#14b8a6 7%,var(--app-surface))}.spaces button.active>mat-icon{color:#0f8f87}.spaces button.active b{color:#fff;background:#0f8f87}.request-centre{overflow:hidden;border:1px solid var(--app-border);border-radius:16px;background:var(--app-surface);box-shadow:var(--app-shadow-soft)}.centre-head{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:18px 20px;border-bottom:1px solid var(--app-border)}.centre-head>div{display:grid}.centre-head>div span{color:#0f8f87;font-size:9px;font-weight:850;text-transform:uppercase}.centre-head h2{margin:2px 0;font-size:19px}.centre-head label{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:7px;width:min(340px,45%);min-height:38px;padding:0 10px;border:1px solid var(--app-border);border-radius:8px}.centre-head label mat-icon{width:17px;height:17px;color:var(--app-text-muted);font-size:17px}.centre-head input{min-width:0;border:0;outline:0;color:var(--app-text);background:transparent;font:inherit;font-size:11px}.request-list{display:grid}.request-card{display:grid;grid-template-columns:auto minmax(0,1fr) 105px 125px auto;align-items:center;gap:14px;min-height:104px;padding:14px 20px;border-bottom:1px solid var(--app-border);color:var(--app-text);text-decoration:none}.request-card:last-child{border-bottom:0}.request-card:hover{background:var(--app-soft-surface)}.request-mark{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;color:#0f766e;background:#ccfbf1}.request-main{display:grid;gap:3px}.request-meta{color:#0f8f87;font-size:8px;font-weight:850;text-transform:uppercase}.request-main>strong{font-size:13px}.request-main>small{color:var(--app-text-muted);font-size:9px}.datasets{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px}.datasets span{display:flex;align-items:center;gap:3px;padding:3px 6px;border:1px solid var(--app-border);border-radius:5px;color:var(--app-text-muted);font-size:8px}.datasets mat-icon{width:12px;height:12px;font-size:12px}.request-impact{display:grid}.request-impact strong{font-size:18px}.request-impact span{color:var(--app-text-muted);font-size:8px;text-transform:uppercase}.request-impact em{display:flex;align-items:center;gap:3px;margin-top:3px;color:#dc2626;font-size:8px;font-style:normal}.request-impact em mat-icon{width:12px;height:12px;font-size:12px}.request-status{display:flex;align-items:center;gap:6px;width:max-content;padding:5px 8px;border-radius:999px;color:#b45309;background:#fffbeb;font-size:9px;font-weight:850}.request-status i{width:5px;height:5px;border-radius:50%;background:currentColor}.request-status[data-status="Private draft"]{color:#2563eb;background:#eff6ff}.request-status[data-status="Approved"]{color:#047857;background:#ecfdf5}.request-status[data-status="Published"]{color:#475569;background:#f1f5f9}.request-status[data-status="Returned"]{color:#b91c1c;background:#fef2f2}.chevron{color:var(--app-text-muted)}.loading,.empty{display:grid;place-items:center;gap:6px;padding:70px 20px;color:var(--app-text-muted)}.loading{display:flex}.loading mat-icon{animation:spin 1s linear infinite}.empty mat-icon{width:34px;height:34px;font-size:34px}.empty strong{color:var(--app-text)}.empty span{font-size:10px}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:900px){.spaces{grid-template-columns:1fr 1fr}.request-card{grid-template-columns:auto 1fr auto}.request-impact,.request-status{grid-column:2}.chevron{grid-column:3;grid-row:1/4}.centre-head{align-items:stretch;flex-direction:column}.centre-head label{width:auto}}@media(max-width:560px){.requests-hero{align-items:stretch;flex-direction:column;padding:21px}.requests-hero a{width:100%}.spaces{grid-template-columns:1fr}.request-card{padding:13px}.request-mark{display:none}}
  `, `
    .request-card{grid-template-columns:auto minmax(0,1fr) 105px 125px auto auto}.request-card.local-draft{grid-template-columns:auto minmax(0,1fr) 105px 125px auto;background:color-mix(in srgb,#14b8a6 4%,var(--app-surface))}.request-card__link{display:contents;color:inherit;text-decoration:none}.card-discard{color:#b91c1c}.card-discard:hover{background:#fef2f2}
    .discard-backdrop{position:fixed;inset:0;z-index:240;background:rgba(15,23,42,.48);backdrop-filter:blur(2px)}.discard-dialog{position:fixed;z-index:250;top:50%;left:50%;display:grid;width:min(470px,calc(100vw - 32px));gap:16px;padding:22px;transform:translate(-50%,-50%);border:1px solid var(--app-border);border-radius:10px;background:var(--app-surface);box-shadow:0 24px 70px rgba(15,23,42,.28)}.discard-dialog header{display:flex;align-items:center;gap:12px}.discard-dialog header>mat-icon{display:grid;place-items:center;width:42px;height:42px;color:#b91c1c;font-size:26px}.discard-dialog header div{display:grid;gap:2px}.discard-dialog header span{color:#b91c1c;font-size:9px;font-weight:900;text-transform:uppercase}.discard-dialog h2{margin:0;font-size:19px}.discard-dialog p{margin:0;color:var(--app-text-muted);font-size:12px;line-height:1.55}.discard-dialog footer{display:flex;justify-content:flex-end;gap:8px}
    @media(max-width:900px){.request-card.local-draft{grid-template-columns:auto 1fr auto}.request-card.local-draft .request-impact,.request-card.local-draft .request-status{grid-column:2}.request-card.local-draft .chevron{grid-column:3;grid-row:1/4}}
  `, `
    .requests-hero{padding:32px 36px;border-radius:25px;background:linear-gradient(125deg,color-mix(in srgb,var(--app-surface) 96%,#0f766e),color-mix(in srgb,var(--app-surface) 89%,#ccfbf1))}.requests-hero h1{font-size:clamp(33px,4.1vw,52px)}.requests-hero a{min-height:45px;border-radius:13px;font-weight:850}
    .spaces{gap:11px}.space-card{--space-color:#0f8f87;position:relative;grid-template-columns:49px minmax(0,1fr) auto!important;align-items:start!important;gap:13px!important;min-height:0!important;padding:18px!important;border-radius:19px!important;background:var(--app-surface-elevated)!important;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.space-card[data-space="approval"]{--space-color:#2563eb}.space-card[data-space="approved"]{--space-color:#15803d}.space-card[data-space="history"]{--space-color:#b45309}.space-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--space-color) 42%,var(--app-border))}.space-card.active{border-color:var(--space-color)!important;box-shadow:0 12px 28px color-mix(in srgb,var(--space-color) 14%,transparent)}.space-card.active:after{content:'';position:absolute;inset:auto 18px -1px;height:3px;border-radius:3px 3px 0 0;background:var(--space-color)}.space-icon{display:grid!important;place-items:center;width:49px;height:49px;color:var(--space-color);border-radius:15px;background:color-mix(in srgb,var(--space-color) 12%,transparent)}.space-icon mat-icon{width:27px;height:27px;font-size:27px}.space-copy{display:grid!important;min-width:0;gap:3px}.space-copy small{color:var(--space-color)!important;font-size:10px!important;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.space-copy strong{font-size:17px}.space-copy em{margin-top:2px;color:var(--app-text-muted);font-size:11px;font-style:normal;line-height:1.4}.space-card b{min-width:35px!important;height:35px!important;padding:0 7px;color:var(--space-color)!important;border-radius:11px!important;background:color-mix(in srgb,var(--space-color) 10%,transparent)!important;font-weight:900}
    .request-centre{border-radius:23px;background:var(--app-surface-elevated)}.centre-head{padding:24px 26px 19px}.centre-head h2{margin:7px 0 3px;font-size:27px;letter-spacing:-.03em}.centre-head p{margin:0;color:var(--app-text-muted);font-size:12px}.centre-head label{min-height:44px;border-radius:12px;background:var(--app-surface)}.request-list{gap:10px;padding:13px 16px 17px}.request-card,.request-card.local-draft{grid-template-columns:52px minmax(0,1fr) auto;align-items:center;gap:14px;min-height:0;padding:17px 12px;border:1px solid transparent;border-bottom:1px solid var(--app-border);border-radius:15px;background:transparent}.request-card:hover{background:color-mix(in srgb,var(--app-accent) 5%,transparent)}.request-card.local-draft{border-color:color-mix(in srgb,#0f8f87 27%,var(--app-border));background:color-mix(in srgb,#14b8a6 3%,var(--app-surface))}.request-mark{width:52px;height:52px;color:#2563eb;border-radius:15px;background:color-mix(in srgb,#3b82f6 12%,transparent)}.request-mark mat-icon{width:28px;height:28px;font-size:28px}.request-mark--published{color:#15803d;background:color-mix(in srgb,#22c55e 12%,transparent)}.request-main{min-width:0;gap:0}.request-title-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.request-title-row>strong{overflow:hidden;max-width:600px;text-overflow:ellipsis;white-space:nowrap;font-size:15px}.request-details{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:7px;color:var(--app-text-muted);font-size:11px}.request-details span{display:inline-flex;align-items:center;gap:4px}.request-details mat-icon{width:14px;height:14px;font-size:14px}.datasets{gap:6px;margin-top:8px}.datasets span{padding:4px 7px;border-radius:7px;font-size:9px;font-weight:800}.request-status{padding:4px 8px;font-size:9px;text-transform:uppercase}.readiness-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;color:#047857;border-radius:999px;background:color-mix(in srgb,#22c55e 13%,transparent);font-size:9px;font-weight:900;text-transform:uppercase}.readiness-pill mat-icon{width:13px;height:13px;font-size:13px}.item-note{display:flex;align-items:center;gap:4px;margin:8px 0 0;color:#047857;font-size:11px;font-weight:700}.item-note--blocked{color:#b45309}.item-note--error{color:#b91c1c}.item-note mat-icon{width:15px;height:15px;font-size:15px}.item-actions{display:flex;max-width:560px;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:6px}.item-actions a,.item-actions button{min-height:38px;border-radius:10px;font-size:11px;font-weight:850}.item-actions button[color="primary"]{background:#0f8f87}.request-status[data-status="Awaiting approval"]{color:#b45309;background:color-mix(in srgb,#f59e0b 13%,transparent)}
    .view-toolbar{display:flex;align-items:center;padding:0 24px 13px;border-bottom:1px solid var(--app-border)}.view-switch{display:flex;padding:3px;border:1px solid var(--app-border);border-radius:11px;background:var(--app-surface)}.view-switch button{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 10px;color:var(--app-text-muted);border:0;border-radius:8px;background:transparent;cursor:pointer;font-size:11px;font-weight:850}.view-switch button mat-icon{width:17px;height:17px;font-size:17px}.view-switch button.active{color:var(--app-accent);background:color-mix(in srgb,var(--app-accent) 11%,var(--app-surface-elevated));box-shadow:0 2px 7px rgba(2,6,23,.08)}
    .compact-list{display:grid;padding:9px 16px 15px}.compact-row{display:grid;grid-template-columns:12px minmax(220px,1.5fr) minmax(135px,.8fr) 82px minmax(90px,.55fr) 105px minmax(105px,auto) auto;align-items:center;gap:10px;min-height:57px;padding:7px 10px;border-bottom:1px solid var(--app-border);transition:background .16s ease}.compact-row:last-child{border-bottom:0}.compact-row:hover{background:color-mix(in srgb,var(--app-accent) 5%,transparent)}.compact-row--local{border-radius:12px;background:color-mix(in srgb,#14b8a6 3%,var(--app-surface))}.compact-led{width:8px;height:8px;border-radius:50%;background:#2563eb;box-shadow:0 0 0 4px color-mix(in srgb,#2563eb 12%,transparent)}.compact-led--published{background:#22c55e;box-shadow:0 0 0 4px color-mix(in srgb,#22c55e 14%,transparent)}.compact-led--error{background:#ef4444;box-shadow:0 0 0 4px color-mix(in srgb,#ef4444 12%,transparent)}.compact-name{display:grid;min-width:0;gap:2px}.compact-name strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.compact-name small{display:flex;align-items:center;gap:3px;overflow:hidden;color:#0f8f87;text-overflow:ellipsis;white-space:nowrap;font-size:8px;font-weight:800}.compact-name small mat-icon{width:12px;height:12px;font-size:12px}.compact-datasets,.compact-changes,.compact-owner,.compact-date{overflow:hidden;color:var(--app-text-muted);text-overflow:ellipsis;white-space:nowrap;font-size:9px}.compact-datasets{font-size:10px}.compact-status{justify-self:start;padding:5px 8px;color:#075985;border-radius:999px;background:color-mix(in srgb,#38bdf8 13%,transparent);font-size:8px;font-weight:900;text-transform:uppercase}.compact-status[data-status="Ready to submit"],.compact-status[data-status="Approved"]{color:#047857;background:color-mix(in srgb,#22c55e 13%,transparent)}.compact-status[data-status="Awaiting approval"]{color:#b45309;background:color-mix(in srgb,#f59e0b 13%,transparent)}.compact-status[data-status="Published"]{color:#475569;background:color-mix(in srgb,#94a3b8 14%,transparent)}.compact-status[data-status="Returned"]{color:#b91c1c;background:color-mix(in srgb,#ef4444 12%,transparent)}.compact-actions{display:flex;justify-content:flex-end}.compact-actions a,.compact-actions button{color:var(--app-accent)}.compact-actions mat-icon{width:18px;height:18px;font-size:18px}
    :host-context(.theme-dark) .space-card[data-space="approval"] .space-copy small{color:#93c5fd!important}:host-context(.theme-dark) .space-card[data-space="history"] .space-copy small{color:#fbbf24!important}:host-context(.theme-dark) .item-note{color:#5eead4}:host-context(.theme-dark) .item-note--blocked{color:#fbbf24}:host-context(.theme-dark) .item-note--error{color:#fca5a5}
    @media(max-width:1120px){.request-card,.request-card.local-draft{grid-template-columns:45px minmax(0,1fr)}.request-mark{width:45px;height:45px}.item-actions{grid-column:2;justify-content:flex-start;max-width:none}.compact-row{grid-template-columns:12px minmax(210px,1.5fr) minmax(130px,.8fr) 82px 105px minmax(105px,auto) auto}.compact-owner{display:none}}
    @media(max-width:820px){.spaces{grid-template-columns:1fr 1fr}.centre-head{align-items:stretch;flex-direction:column}.centre-head label{width:auto}}
    @media(max-width:560px){.requests-hero{padding:23px 18px 18px;border-radius:21px}.requests-hero h1{font-size:34px}.spaces{display:flex;gap:7px;overflow-x:auto;padding-bottom:3px;scrollbar-width:none}.spaces::-webkit-scrollbar{display:none}.space-card{flex:0 0 78%;grid-template-columns:39px minmax(0,1fr) auto!important;padding:13px!important}.space-icon{width:39px;height:39px}.space-icon mat-icon{width:22px;height:22px;font-size:22px}.space-copy em{display:none}.space-copy strong{font-size:14px}.request-centre{border-radius:19px}.centre-head{padding:18px 16px 15px}.centre-head h2{font-size:22px}.centre-head p{display:none}.view-toolbar{padding:0 12px 11px}.view-switch{width:100%}.view-switch button{flex:1;justify-content:center}.request-list{padding:9px 8px 12px}.request-card,.request-card.local-draft{grid-template-columns:38px minmax(0,1fr);align-items:start;gap:10px;padding:13px 8px}.request-mark{display:grid;width:38px;height:38px;border-radius:12px}.request-mark mat-icon{width:21px;height:21px;font-size:21px}.request-title-row>strong{max-width:100%;white-space:normal;overflow-wrap:anywhere;font-size:13px}.request-details{flex-direction:column;gap:4px;font-size:10px}.item-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}.item-actions a,.item-actions button{width:100%}.item-actions>*:first-child:last-child{grid-column:1/-1}.compact-list{padding:7px 8px 11px}.compact-row{grid-template-columns:11px minmax(0,1fr) auto;min-height:63px;padding:8px}.compact-datasets{grid-column:2;grid-row:2}.compact-changes,.compact-owner,.compact-date{display:none}.compact-status{grid-column:2;grid-row:3}.compact-actions{grid-column:3;grid-row:1/4;align-self:center;max-width:82px;flex-wrap:wrap}.compact-name strong{white-space:normal;overflow-wrap:anywhere}}
  `]
})
export class MaintenanceRequestsComponent implements OnInit {
  private static readonly viewPreferenceKey = 'cpq.maintenance.requests.view';
  readonly auth = inject(AuthFacade);
  private readonly imports = inject(ImportService);
  private readonly localDrafts = inject(MaintenanceLocalDraftService);
  private readonly toast = inject(ToastService);

  readonly spaces = [
    { key: 'mine' as const, eyebrow: 'Private preparation', label: 'My requests', description: 'Validate and refine changes before sharing.', icon: 'lock_person' },
    { key: 'approval' as const, eyebrow: 'Shared workflow', label: 'Needs approval', description: 'Submitted requests waiting for a decision.', icon: 'groups' },
    { key: 'approved' as const, eyebrow: 'Publication gate', label: 'Ready to publish', description: 'Approved changes ready for release.', icon: 'rocket_launch' },
    { key: 'history' as const, eyebrow: 'Governed evidence', label: 'History', description: 'Published and returned requests retained.', icon: 'history' }
  ];
  readonly definitions: Record<RequestSpace, { eyebrow: string; title: string; empty: string }> = {
    mine: { eyebrow: 'My private workspace', title: 'Maintenance drafts in progress', empty: 'Use Add request to prepare, validate and submit maintenance changes.' },
    approval: { eyebrow: 'Separation of duties', title: 'Maintenance approvals', empty: 'No business change sets are waiting for your decision.' },
    approved: { eyebrow: 'Controlled publication', title: 'Approved maintenance requests', empty: 'No approved changes are waiting for publication.' },
    history: { eyebrow: 'Governed evidence', title: 'Maintenance history', empty: 'Published and returned requests will appear here.' }
  };

  jobs: ImportJob[] = [];
  activeSpace: RequestSpace = 'mine';
  search = '';
  loading = false;
  discarding = false;
  discardCandidate: MaintenanceRequestCard | null = null;
  discardLocalDraftPending = false;
  localDraft: LocalMaintenanceDraft | null = null;
  actingRequestId: string | null = null;
  pushingLocalDraft = false;
  viewMode: RequestViewMode = this.readViewPreference();

  get canCreateMaintenance(): boolean {
    return this.auth.hasCapability('imports.upload')
      && this.auth.hasCapability('imports.correct_own')
      && this.auth.hasCapability('imports.submit');
  }

  get requests(): MaintenanceRequestCard[] {
    const groups = new Map<string, ImportJob[]>();
    for (const job of this.jobs) {
      const key = job.releasePackageId ? `package:${job.releasePackageId}` : `job:${job.id}`;
      groups.set(key, [...(groups.get(key) ?? []), job]);
    }
    return [...groups.entries()].map(([key, jobs]) => {
      const first = jobs[0];
      return {
        id: first.releasePackageId ?? first.id,
        kind: first.releasePackageId ? 'package' : 'job',
        name: first.releasePackageName ?? first.originalFileName.replace(/\.hmi$/i, ''),
        ownerId: first.createdBy,
        owner: first.createdByDisplayName,
        createdAt: first.createdAt,
        jobs,
        status: this.status(jobs),
        totalChanges: jobs.reduce((sum, job) => sum + job.draftAddedRows + job.draftModifiedRows + job.draftRemovedRows, 0),
        errors: jobs.reduce((sum, job) => sum + job.errorRows, 0)
      } as MaintenanceRequestCard;
    }).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }

  get filteredRequests(): MaintenanceRequestCard[] {
    const term = this.search.trim().toLowerCase();
    return this.requests.filter(request => this.inSpace(request, this.activeSpace)
      && (!term || request.name.toLowerCase().includes(term) || request.owner.toLowerCase().includes(term)
        || request.jobs.some(job => job.entityTypeLabel.toLowerCase().includes(term))));
  }
  get activeDefinition() { return this.definitions[this.activeSpace]; }
  get activeSpaceDefinition() { return this.spaces.find(space => space.key === this.activeSpace) ?? this.spaces[0]; }
  get localDraftDatasetNames(): string[] { return [...new Set(this.localDraft?.changes.map(change => change.datasetName) ?? [])]; }
  get localDraftReadinessKnown(): boolean { return Array.isArray(this.localDraft?.blockingIssues); }
  get localDraftReady(): boolean { return this.localDraftReadinessKnown && this.localDraft!.blockingIssues!.length === 0; }
  get localDraftIssueCount(): number { return this.localDraft?.blockingIssues?.length ?? 0; }
  get showLocalDraft(): boolean {
    if (this.activeSpace !== 'mine' || !this.localDraft?.changes.length) return false;
    const term = this.search.trim().toLowerCase();
    return !term || (this.localDraft.name || 'Untitled maintenance request').toLowerCase().includes(term)
      || this.localDraftDatasetNames.some(dataset => dataset.toLowerCase().includes(term));
  }

  ngOnInit(): void { this.localDraft = this.localDrafts.load(); this.load(); }
  selectSpace(space: RequestSpace): void { this.activeSpace = space; this.search = ''; }
  setViewMode(mode: RequestViewMode): void {
    this.viewMode = mode;
    try { localStorage.setItem(MaintenanceRequestsComponent.viewPreferenceKey, mode); } catch { /* Preference storage is optional. */ }
  }
  count(space: RequestSpace): number { return this.requests.filter(request => this.inSpace(request, space)).length + (space === 'mine' && this.localDraft?.changes.length ? 1 : 0); }
  datasetIcon(type: number): string { return type === 1 ? 'inventory_2' : type === 2 ? 'payments' : type === 3 ? 'translate' : 'currency_exchange'; }
  datasetIconByName(name: string): string { return name === 'Article Master' ? 'inventory_2' : name === 'Basis Price' ? 'payments' : name === 'Descriptions' ? 'translate' : 'currency_exchange'; }
  requestDatasetNames(request: MaintenanceRequestCard): string { return [...new Set(request.jobs.map(job => job.entityTypeLabel))].join(' · '); }
  canReview(request: MaintenanceRequestCard): boolean {
    return request.status === 'Awaiting approval'
      && request.ownerId !== this.auth.userId
      && this.auth.hasCapability('imports.approve');
  }
  canWithdraw(request: MaintenanceRequestCard): boolean {
    return request.status === 'Awaiting approval'
      && request.ownerId === this.auth.userId
      && this.auth.hasCapability('imports.withdraw_own');
  }
  canPublish(request: MaintenanceRequestCard): boolean {
    return request.status === 'Approved' && this.auth.hasCapability('imports.publish');
  }

  withdraw(request: MaintenanceRequestCard, event: Event): void {
    event.stopPropagation();
    if (this.actingRequestId) return;
    this.actingRequestId = request.id;
    const action: Observable<unknown> = request.kind === 'package'
      ? this.imports.withdrawReleasePackage(request.id)
      : this.imports.withdrawFromReview(request.id);
    action.pipe(
      switchMap(() => this.restoreWithdrawnChanges(request)),
      switchMap(changes => {
        const draft = this.localDrafts.save({
          name: request.name,
          selectedDataset: changes[0].dataset,
          changes
        });
        if (!draft) return throwError(() => new Error('The withdrawn changes could not be saved in the private workspace.'));
        this.localDraft = draft;
        return this.discardServerDraft(request);
      }),
      finalize(() => this.actingRequestId = null)
    ).subscribe({
      next: () => {
        this.activeSpace = 'mine';
        this.search = '';
        this.toast.success('Maintenance request withdrawn with its changes restored to your private workspace.');
        this.load();
      },
      error: (error: any) => {
        this.activeSpace = 'mine';
        this.search = '';
        this.toast.error(error?.error?.error ?? error?.message ?? 'The maintenance request could not be withdrawn.');
        this.load();
      }
    });
  }

  publish(request: MaintenanceRequestCard, event: Event): void {
    event.stopPropagation();
    const action = request.kind === 'package'
      ? this.imports.publishReleasePackage(request.id)
      : this.imports.publish(request.id);
    this.runRequestAction(request, action, 'Maintenance changes published.');
  }

  pushLocalDraft(): void {
    const localDraft = this.localDraft;
    if (!localDraft?.changes.length || !this.localDraftReady || this.pushingLocalDraft) return;
    this.pushingLocalDraft = true;
    let generatedDraft: MaintenanceDraft | null = null;
    const entryDataset = localDraft.changes.some(change => change.dataset === 'Article' || change.dataset === 'PriceList')
      ? 'Article'
      : localDraft.changes[0].dataset;

    this.imports.createMaintenanceDraft(entryDataset, localDraft.name.trim()).pipe(
      map(draft => { generatedDraft = draft; return draft; }),
      switchMap(draft => from(localDraft.changes).pipe(
        concatMap(change => this.applyLocalChange(draft, change)),
        toArray(),
        switchMap(() => from(draft.jobs).pipe(
          concatMap(job => this.imports.refreshValidation(job.id)),
          toArray(),
          map(jobs => ({ ...draft, jobs }))
        ))
      )),
      switchMap(draft => {
        const errorRows = draft.jobs.reduce((sum, job) => sum + job.errorRows, 0);
        if (errorRows) {
          return this.discardGeneratedDraft(draft).pipe(map(() => ({ submitted: false, errorRows })));
        }
        return this.submitGeneratedDraft(draft).pipe(map(() => ({ submitted: true, errorRows: 0 })));
      }),
      finalize(() => this.pushingLocalDraft = false)
    ).subscribe({
      next: result => {
        generatedDraft = null;
        if (!result.submitted) {
          this.toast.error(`Server validation found ${result.errorRows} blocking row${result.errorRows === 1 ? '' : 's'}. Continue to correct the draft.`);
          return;
        }
        this.localDrafts.clear();
        this.localDraft = null;
        this.activeSpace = 'approval';
        this.toast.success('Maintenance request pushed for approval.');
        this.load();
      },
      error: error => {
        if (generatedDraft) this.discardGeneratedDraft(generatedDraft).subscribe({ error: () => undefined });
        this.toast.error(error?.error?.error ?? error?.message ?? 'The request could not be pushed for approval.');
      }
    });
  }

  canDiscard(request: MaintenanceRequestCard): boolean {
    return request.ownerId === this.auth.userId
      && request.status === 'Private draft'
      && this.auth.hasCapability('imports.correct_own');
  }

  closeDiscard(): void {
    if (this.discarding) return;
    this.discardCandidate = null;
    this.discardLocalDraftPending = false;
  }

  discard(): void {
    if (this.discardLocalDraftPending) {
      this.localDrafts.clear();
      this.localDraft = null;
      this.discardLocalDraftPending = false;
      this.toast.success('Private maintenance draft discarded.');
      return;
    }
    const request = this.discardCandidate;
    if (!request || this.discarding) return;
    this.discarding = true;
    const action = request.kind === 'package'
      ? this.imports.discardReleasePackage(request.id)
      : this.imports.deletePrivateDraft(request.id);
    action.pipe(finalize(() => this.discarding = false)).subscribe({
      next: () => {
        this.discardCandidate = null;
        this.toast.success('Maintenance change set discarded.');
        this.load();
      },
      error: error => this.toast.error(error?.error?.error ?? 'The change set could not be discarded.')
    });
  }

  private load(): void {
    this.loading = true;
    this.imports.getMaintenanceRequests().pipe(finalize(() => this.loading = false)).subscribe({
      next: jobs => this.jobs = jobs,
      error: error => {
        this.jobs = [];
        this.toast.error(error?.error?.error ?? 'Maintenance requests could not be loaded.');
      }
    });
  }

  private restoreWithdrawnChanges(request: MaintenanceRequestCard): Observable<LocalMaintenanceChange[]> {
    return forkJoin(request.jobs.map(job => forkJoin({
      active: this.loadAllRows(job.id),
      removed: this.imports.getRemovedRows(job.id),
      comparison: this.imports.getComparison(job.id)
    }).pipe(map(rows => this.toLocalChanges(job, rows.active, rows.removed, rows.comparison.rows))))).pipe(
      map(groups => groups.flat()),
      switchMap(changes => changes.length
        ? from([changes])
        : throwError(() => new Error('The withdrawn request did not contain any staged changes to restore.')))
    );
  }

  private loadAllRows(jobId: string): Observable<StagingRow[]> {
    const pageSize = 200;
    return this.imports.getRows(jobId, 1, pageSize).pipe(
      switchMap(firstPage => {
        const pageCount = Math.ceil(firstPage.total / firstPage.pageSize);
        if (pageCount <= 1) return from([firstPage.items]);
        const remainingPages = Array.from({ length: pageCount - 1 }, (_, index) => index + 2);
        return forkJoin(remainingPages.map(page => this.imports.getRows(jobId, page, firstPage.pageSize))).pipe(
          map(pages => [firstPage.items, ...pages.map(result => result.items)].flat())
        );
      })
    );
  }

  private toLocalChanges(job: ImportJob, activeRows: StagingRow[], removedRows: StagingRow[], comparisonRows: ComparisonRow[]): LocalMaintenanceChange[] {
    const dataset = this.datasetKey(job.entityType);
    const activeChanges = activeRows
      .filter(row => row.isUserAdded || row.isUserModified)
      .map(row => this.toLocalChange(job, dataset, row, row.isUserAdded ? 'Add' : 'Modify', comparisonRows.find(item => item.rowId === row.id)));
    const removedChanges = removedRows
      .filter(row => !row.isUserAdded)
      .map(row => this.toLocalChange(job, dataset, row, 'Deactivate'));
    return [...activeChanges, ...removedChanges];
  }

  private toLocalChange(
    job: ImportJob,
    dataset: MaintenanceDraftDatasetKey,
    row: StagingRow,
    action: LocalMaintenanceChange['action'],
    comparison?: ComparisonRow
  ): LocalMaintenanceChange {
    const values = Object.fromEntries(Object.entries(row.fields).map(([key, value]) => [key, value ?? '']));
    const originalValues = action === 'Modify'
      ? comparison?.changes.reduce<Record<string, string>>((result, field) => {
          result[field.field] = field.baselineValue ?? '';
          return result;
        }, { ...values })
      : undefined;
    const identity = this.localIdentity(dataset, values);
    const recordKey = dataset === 'CurrencyRate'
      ? `${values['FromCurrency'] ?? ''}/${values['ToCurrency'] ?? ''}`
      : dataset === 'Description'
        ? `${values['ArticleNumber'] ?? ''} / ${values['LanguageCode'] ?? ''}`
        : values['ArticleNumber'] ?? '';
    const label = action === 'Add' ? 'New governed record' : action === 'Modify' ? 'Field values updated' : 'Removed from projected release';
    return {
      id: `withdrawn-${job.id}-${row.id}-${action}`,
      dataset,
      datasetName: job.entityTypeLabel,
      recordKey,
      identity,
      label,
      action,
      values,
      originalValues,
      valid: true
    };
  }

  private datasetKey(entityType: number): MaintenanceDraftDatasetKey {
    if (entityType === 1) return 'Article';
    if (entityType === 2) return 'PriceList';
    if (entityType === 3) return 'Description';
    return 'CurrencyRate';
  }

  private discardServerDraft(request: MaintenanceRequestCard): Observable<unknown> {
    return request.kind === 'package'
      ? this.imports.discardReleasePackage(request.id)
      : this.imports.deletePrivateDraft(request.id);
  }

  private runRequestAction(request: MaintenanceRequestCard, action: Observable<unknown>, success: string, destination?: RequestSpace): void {
    if (this.actingRequestId) return;
    this.actingRequestId = request.id;
    action.pipe(finalize(() => this.actingRequestId = null)).subscribe({
      next: () => {
        if (destination) {
          this.activeSpace = destination;
          this.search = '';
        }
        this.toast.success(success);
        this.load();
      },
      error: error => this.toast.error(error?.error?.error ?? 'The maintenance workflow action could not be completed.')
    });
  }

  private applyLocalChange(draft: MaintenanceDraft, change: LocalMaintenanceDraft['changes'][number]): Observable<unknown> {
    const entityValue: Record<LocalMaintenanceDraft['selectedDataset'], number> = { Article: 1, PriceList: 2, Description: 3, CurrencyRate: 4 };
    const job = draft.jobs.find(item => item.entityType === entityValue[change.dataset]);
    if (!job) return throwError(() => new Error(`No ${change.datasetName} candidate exists in this draft.`));
    if (change.action === 'Add') return this.imports.addRow(job.id, change.values);
    const lookupKey = change.dataset === 'CurrencyRate' ? change.values['FromCurrency'] : change.values['ArticleNumber'];
    return this.imports.getRows(job.id, 1, 20, lookupKey).pipe(
      switchMap(result => {
        const row = result.items.find(item => this.localIdentity(change.dataset, item.fields) === change.identity);
        if (!row) return throwError(() => new Error(`${change.datasetName} record ${change.recordKey} was not found in the draft snapshot.`));
        return change.action === 'Modify'
          ? this.imports.updateRow(job.id, row.id, change.values)
          : this.imports.deleteRows(job.id, [row.id]);
      })
    );
  }

  private localIdentity(dataset: LocalMaintenanceDraft['selectedDataset'], values: Record<string, string | null>): string {
    const fields = dataset === 'Description'
      ? ['ArticleNumber', 'LanguageCode']
      : dataset === 'CurrencyRate'
        ? ['FromCurrency', 'ToCurrency', 'ValidFrom']
        : ['ArticleNumber'];
    return fields.map(field => values[field]?.trim().toLowerCase() ?? '').join('|');
  }

  private submitGeneratedDraft(draft: MaintenanceDraft): Observable<unknown> {
    return draft.releasePackage
      ? this.imports.submitReleasePackage(draft.releasePackage.id)
      : this.imports.submitForReview(draft.jobs[0].id);
  }

  private discardGeneratedDraft(draft: MaintenanceDraft): Observable<unknown> {
    return draft.releasePackage
      ? this.imports.discardReleasePackage(draft.releasePackage.id)
      : this.imports.deletePrivateDraft(draft.jobs[0].id);
  }

  private readViewPreference(): RequestViewMode {
    try { return localStorage.getItem(MaintenanceRequestsComponent.viewPreferenceKey) === 'compact' ? 'compact' : 'detailed'; }
    catch { return 'detailed'; }
  }

  private status(jobs: ImportJob[]): string {
    if (jobs.every(job => job.workflowStageLabel === 'Published')) return 'Published';
    if (jobs.some(job => job.workflowStageLabel === 'Rejected')) return 'Returned';
    if (jobs.every(job => job.workflowStageLabel === 'Approved')) return 'Approved';
    if (jobs.every(job => job.workflowStageLabel === 'Submitted')) return 'Awaiting approval';
    return 'Private draft';
  }

  private inSpace(request: MaintenanceRequestCard, space: RequestSpace): boolean {
    if (space === 'mine') return request.ownerId === this.auth.userId && request.status === 'Private draft';
    if (space === 'approval') return request.status === 'Awaiting approval';
    if (space === 'approved') return request.status === 'Approved';
    return ['Published', 'Returned'].includes(request.status);
  }
}
