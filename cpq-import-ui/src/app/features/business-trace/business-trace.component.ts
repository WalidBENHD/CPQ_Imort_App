import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthFacade } from '../../core/auth/auth.facade';
import { BusinessTraceActor, BusinessTraceEvent, BusinessTraceField, BusinessTraceResult, BusinessTraceSuggestion, PILOT_SCOPE } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';
import { ToastService } from '../../core/services/toast.service';
import { DownloadActionComponent } from '../../shared/download-action/download-action.component';

type TraceFilter = 'all' | 'changes' | 'decisions';
type TraceObjectType = 'Article' | 'Basis price';
type TraceHistory = Record<TraceObjectType, BusinessTraceSuggestion[]>;

const TRACE_STATE_KEY_PREFIX = 'cpq.business-trace.state';
const TRACE_HISTORY_KEY_PREFIX = 'cpq.business-trace.history';
const EMPTY_TRACE_HISTORY: TraceHistory = { Article: [], 'Basis price': [] };

@Component({
  selector: 'app-business-trace',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, RouterLink, DownloadActionComponent],
  template: `
    <main class="trace-page">
      <header class="trace-hero">
        <div class="trace-hero__copy">
          <span class="eyebrow"><mat-icon>verified_user</mat-icon> Governed business memory</span>
          <h1>Find the current truth.<br><span>Follow every decision.</span></h1>
          <p>Search a business object inside a defined scope to see its live CPQ values and the evidence behind every published change.</p>
        </div>

        <div class="scope-card">
          <span class="scope-card__signal"><i></i> Active pilot scope</span>
          <strong>{{ pilotScope.site }}</strong>
          <span>{{ pilotScope.productFamily }} · {{ pilotScope.category }} · {{ pilotScope.currency }}</span>
          <small><mat-icon>lock</mat-icon> Results never cross scope boundaries</small>
        </div>
      </header>

      <section class="search-studio" aria-label="Business trace search">
        <div class="search-studio__topline">
          <div>
            <span class="section-kicker">Trace an object</span>
            <h2>What are you looking for?</h2>
          </div>
          <span class="prototype-badge"><mat-icon>verified</mat-icon> Live publication evidence</span>
        </div>

        <div class="search-grid">
          <label class="field field--scope">
            <span>Scope</span>
            <div class="field__control field__control--locked">
              <mat-icon>location_on</mat-icon>
              <strong>{{ pilotScope.site }} · {{ pilotScope.productFamily }}</strong>
              <mat-icon class="lock-icon">lock</mat-icon>
            </div>
          </label>

          <label class="field">
            <span>Object type</span>
            <div class="field__control">
              <mat-icon>{{ objectType === 'Article' ? 'inventory_2' : 'payments' }}</mat-icon>
              <select [(ngModel)]="objectType" (change)="selectObjectType()" aria-label="Object type">
                <option>Article</option>
                <option>Basis price</option>
                <option disabled>Description (next)</option>
                <option disabled>Conversion rate (future)</option>
                <option disabled>Coefficient (future)</option>
              </select>
              <mat-icon>expand_more</mat-icon>
            </div>
          </label>

          <label class="field field--identifier">
            <span>{{ objectType }} identifier</span>
            <div class="field__control field__control--input">
              <mat-icon>search</mat-icon>
              <input [(ngModel)]="query" (keyup.enter)="search()" placeholder="e.g. 1_D001951AA" aria-label="Object identifier">
              <button *ngIf="query" type="button" (click)="query = ''" aria-label="Clear identifier"><mat-icon>close</mat-icon></button>
            </div>
          </label>

          <button mat-flat-button type="button" class="search-button" [class.search-button--loading]="isLoading" (click)="search()" [disabled]="isLoading || !query.trim()" [attr.aria-busy]="isLoading">
            <mat-icon>{{ isLoading ? 'autorenew' : 'manage_search' }}</mat-icon> {{ isLoading ? 'Tracing...' : 'Search trace' }}
          </button>
        </div>

        <div class="recent-searches">
          <span>Try a recent search</span>
          <button type="button" *ngFor="let item of suggestions" (click)="useSuggestion(item)">
            <mat-icon>{{ resultIcon }}</mat-icon>{{ item.identifier }}
          </button>
          <small *ngIf="!suggestions.length">No recent {{ objectType.toLowerCase() }} searches yet.</small>
        </div>

        <div class="history-scan" *ngIf="isLoading" role="status" aria-live="polite">
          <div class="history-scan__copy">
            <span class="history-scan__radar"><mat-icon>manage_search</mat-icon></span>
            <span><strong>Reconstructing the publication chain</strong><small>Following retained evidence from origin to current truth</small></span>
          </div>
          <div class="scan-route" aria-hidden="true">
            <span class="scan-track"><i></i></span>
            <span class="scan-node scan-node--source"><mat-icon>inventory_2</mat-icon><small>Introduced</small></span>
            <span class="scan-node scan-node--review"><mat-icon>fact_check</mat-icon><small>Reviewed</small></span>
            <span class="scan-node scan-node--approval"><mat-icon>verified</mat-icon><small>Approved</small></span>
            <span class="scan-node scan-node--truth"><mat-icon>published_with_changes</mat-icon><small>Current truth</small></span>
          </div>
        </div>
      </section>

      <ng-container *ngIf="trace as result">
        <section class="result-heading result-heading--resolved">
          <div class="result-identity">
            <span class="result-icon"><mat-icon>{{ resultIcon }}</mat-icon></span>
            <div>
              <span class="section-kicker">{{ result.objectTypeLabel }} · Current CPQ record</span>
              <h2>{{ result.identifier }}</h2>
              <p>{{ result.displayName || resultDescription }}</p>
            </div>
          </div>
          <div class="result-actions">
            <button mat-flat-button type="button" class="report-button" (click)="generateReport()" [disabled]="isGeneratingReport" [attr.aria-busy]="isGeneratingReport">
              <app-download-action [loading]="isGeneratingReport" icon="picture_as_pdf" label="Generate report"></app-download-action>
            </button>
            <div class="result-status result-status--resolved" [class.result-status--inactive]="!result.isActive"><i></i><span><strong>{{ result.statusLabel }}</strong><small *ngIf="result.lastPublishedAt">Last published {{ formatDate(result.lastPublishedAt) }}</small></span></div>
          </div>
        </section>

        <section class="current-layout">
          <article class="truth-card">
            <header>
              <div>
                <span class="section-kicker">Current truth</span>
                <h3>Values used by CPQ today</h3>
              </div>
              <span class="truth-card__version"><mat-icon>verified</mat-icon> {{ evidenceLabel }}</span>
            </header>

            <div class="truth-grid">
              <div class="truth-value" *ngFor="let field of result.currentFields; let first = first" [class.truth-value--wide]="first && field.kind !== 'price'" [class.truth-value--price]="field.kind === 'price'">
                <span>{{ field.label }}</span><strong>{{ formatFieldValue(field) }}</strong><small>{{ field.hint || field.domain }}</small>
              </div>
              <div class="truth-value truth-value--empty" *ngIf="!result.currentFields.length"><span>Current state</span><strong>No active values</strong><small>The object remains available in publication history.</small></div>
            </div>

            <footer>
              <span *ngFor="let source of result.sources"><mat-icon>{{ sourceIcon(source.dataset) }}</mat-icon><span><small>{{ source.dataset }} source</small><strong>{{ source.fileName }}</strong></span></span>
              <a mat-stroked-button *ngIf="primarySource" [routerLink]="['/import', primarySource.jobId]"><mat-icon>open_in_new</mat-icon> View publication</a>
            </footer>
          </article>

          <aside class="proof-card">
            <span class="section-kicker">Evidence at a glance</span>
            <h3>A complete chain of responsibility</h3>
            <div class="proof-chain">
              <div *ngFor="let actor of responsibilityActors"><span>{{ initials(actor.displayName) }}</span><p><small>{{ actor.role }}</small><strong>{{ actor.displayName }}</strong><em>{{ formatDateTime(actor.occurredAt) }}</em></p></div>
            </div>
            <div class="proof-seal" *ngIf="result.responsibility.approvalEvidencePreserved"><mat-icon>workspace_premium</mat-icon><span><strong>Approval evidence preserved</strong><small>The accepted comparison remains unchanged in history.</small></span></div>
          </aside>
        </section>

        <section class="history-section">
          <header class="history-header">
            <div>
              <span class="section-kicker">Business history</span>
              <h2>How this {{ historySubject }} became what it is today</h2>
              <p>Published changes and the people who reviewed each decision.</p>
            </div>
            <div class="history-filters" role="group" aria-label="Filter history">
              <button type="button" [class.active]="filter === 'all'" (click)="filter = 'all'">All events</button>
              <button type="button" [class.active]="filter === 'changes'" (click)="filter = 'changes'">Value changes</button>
              <button type="button" [class.active]="filter === 'decisions'" (click)="filter = 'decisions'">Decisions</button>
            </div>
          </header>

          <div class="timeline">
            <article class="timeline-event" *ngFor="let event of visibleEvents; let last = last" [class.timeline-event--last]="last">
              <div class="timeline-date"><strong>{{ formatDate(event.occurredAt) }}</strong><span>{{ formatTime(event.occurredAt) }}</span></div>
              <div class="timeline-rail"><span [class]="'timeline-dot timeline-dot--' + event.kind"><mat-icon>{{ iconFor(event.kind) }}</mat-icon></span></div>
              <div class="event-card">
                <header>
                  <div><span [class]="'event-kind event-kind--' + event.kind">{{ labelFor(event.kind) }}</span><h3>{{ event.title }}</h3></div>
                  <button type="button" aria-label="More options"><mat-icon>more_horiz</mat-icon></button>
                </header>
                <p>{{ event.summary }}</p>

                <div class="change-set" *ngIf="event.changes?.length">
                  <div *ngFor="let change of event.changes">
                    <span>{{ change.field }} <small>{{ change.domain }}</small></span>
                    <del>{{ change.before || 'Not in CPQ' }}</del>
                    <mat-icon>arrow_forward</mat-icon>
                    <strong>{{ change.after || 'Removed' }}</strong>
                  </div>
                </div>

                <blockquote *ngIf="event.decision"><mat-icon>format_quote</mat-icon>{{ event.decision }}</blockquote>

                <footer>
                  <span><mat-icon>person</mat-icon><small>{{ event.actorLabel }}</small><strong>{{ event.actor }}</strong></span>
                  <span><mat-icon>description</mat-icon><small>Source</small><strong>{{ event.sourceName }}</strong></span>
                  <span><mat-icon>inventory_2</mat-icon><small>Release</small><strong>{{ event.releaseName || 'Individual publication' }}</strong></span>
                  <button mat-button *ngIf="event.sourceJobId" (click)="openEvidence(event)"><mat-icon>fact_check</mat-icon> Open evidence</button>
                </footer>
              </div>
            </article>
          </div>

          <div class="history-origin"><span><mat-icon>flag</mat-icon></span><div><strong>Beginning of recorded history</strong><small *ngIf="result.introducedAt">This {{ historySubject }} first entered the governed CPQ portfolio on {{ formatLongDate(result.introducedAt) }}.</small><small *ngIf="!result.introducedAt">The earliest retained publication is shown above.</small></div></div>
        </section>
      </ng-container>

      <section class="empty-result" *ngIf="showEmpty && !isLoading">
        <span><mat-icon>search_off</mat-icon></span>
        <h2>No matching object in this scope</h2>
        <p>{{ searchError || ('Check the identifier or choose another object type. Results are limited to ' + pilotScope.site + ' · ' + pilotScope.productFamily + '.') }}</p>
      </section>
    </main>
  `,
  styles: [`
    :host { display: block; color: var(--app-text); }
    .trace-page { width: 100%; margin: 0; display: grid; gap: 20px; }
    .trace-hero { position: relative; overflow: hidden; display: flex; justify-content: space-between; align-items: flex-end; gap: 36px; padding: 30px 34px; border: 1px solid var(--app-border); border-radius: 24px; background: linear-gradient(125deg, color-mix(in srgb, var(--app-surface) 96%, #0f766e), color-mix(in srgb, var(--app-surface) 90%, #dbeafe)); box-shadow: var(--app-shadow-soft); }
    .trace-hero::after { content: ''; position: absolute; width: 330px; height: 330px; right: 22%; top: -245px; border: 70px solid rgba(20, 184, 166, .08); border-radius: 50%; pointer-events: none; }
    .trace-hero__copy { position: relative; z-index: 1; max-width: 780px; }
    .eyebrow, .section-kicker { display: inline-flex; align-items: center; gap: 6px; color: #0f8f87; font-size: 11px; line-height: 1.2; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    .eyebrow mat-icon { width: 18px; height: 18px; font-size: 18px; }
    h1 { margin: 10px 0 10px; color: var(--app-text); font-size: clamp(29px, 3.1vw, 48px); line-height: 1.04; letter-spacing: -.045em; }
    h1 span { color: #0f8f87; }
    .trace-hero__copy p { max-width: 710px; margin: 0; color: var(--app-text-muted); font-size: 16px; line-height: 1.55; }
    .scope-card { position: relative; z-index: 1; min-width: 285px; padding: 18px 20px; display: grid; gap: 5px; border: 1px solid rgba(15, 143, 135, .28); border-radius: 18px; background: color-mix(in srgb, var(--app-surface) 92%, #ccfbf1); }
    .scope-card__signal { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; color: #0f766e; font-size: 10px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
    .scope-card__signal i { width: 8px; height: 8px; border-radius: 50%; background: #14b8a6; box-shadow: 0 0 0 5px rgba(20, 184, 166, .12); }
    .scope-card strong { font-size: 18px; }
    .scope-card > span:not(.scope-card__signal) { color: var(--app-text-muted); font-size: 13px; }
    .scope-card small { display: flex; align-items: center; gap: 5px; margin-top: 8px; padding-top: 10px; border-top: 1px solid rgba(15, 143, 135, .16); color: #0f766e; font-weight: 700; }
    .scope-card small mat-icon { width: 15px; height: 15px; font-size: 15px; }

    .search-studio { padding: 24px; border: 1px solid var(--app-border); border-radius: 22px; background: var(--app-surface); box-shadow: var(--app-shadow-soft); }
    .search-studio__topline, .history-header, .truth-card > header, .result-heading { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
    .search-studio h2, .history-header h2, .result-heading h2 { margin: 4px 0 0; font-size: 22px; letter-spacing: -.025em; }
    .prototype-badge { display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border: 1px dashed color-mix(in srgb, var(--app-accent) 55%, transparent); border-radius: 999px; color: var(--app-accent); background: color-mix(in srgb, var(--app-accent) 7%, transparent); font-size: 11px; font-weight: 800; white-space: nowrap; }
    .prototype-badge mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .search-grid { display: grid; grid-template-columns: 1.15fr .75fr 1.35fr auto; gap: 12px; margin-top: 20px; align-items: end; }
    .field { display: grid; gap: 7px; min-width: 0; }
    .field > span { color: var(--app-text-muted); font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    .field__control { height: 48px; display: flex; align-items: center; gap: 9px; padding: 0 13px; overflow: hidden; border: 1px solid var(--app-border); border-radius: 12px; background: var(--app-soft-surface); }
    .field__control:focus-within { border-color: var(--app-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-accent) 12%, transparent); }
    .field__control > mat-icon { flex: 0 0 auto; width: 19px; height: 19px; color: var(--app-accent); font-size: 19px; }
    .field__control .lock-icon { margin-left: auto; color: var(--app-text-muted); font-size: 16px; }
    .field__control strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
    .field__control select, .field__control input { width: 100%; min-width: 0; height: 100%; border: 0; outline: 0; color: var(--app-text); background: transparent; font: inherit; font-size: 14px; }
    .field__control select { appearance: none; cursor: pointer; }
    .field__control option { color: #0f172a; background: #fff; }
    .field__control--input button { display: grid; place-items: center; padding: 0; border: 0; color: var(--app-text-muted); background: transparent; cursor: pointer; }
    .field__control--input button mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .search-button { height: 48px; padding: 0 20px; border-radius: 12px; color: #fff !important; background: linear-gradient(135deg, #0f8f87, #08776f) !important; font-weight: 800; box-shadow: 0 8px 18px rgba(15, 143, 135, .22); }
    .search-button[disabled] { opacity: .58; box-shadow: none; }
    .search-button mat-icon { animation: none; }
    .search-button--loading mat-icon { animation: trace-spin 1.1s linear infinite; }
    .recent-searches { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
    .recent-searches > span { margin-right: 3px; color: var(--app-text-muted); font-size: 11px; font-weight: 750; }
    .recent-searches button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 9px; border: 1px solid var(--app-border); border-radius: 999px; color: var(--app-text-muted); background: transparent; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
    .recent-searches button:hover { color: var(--app-accent); border-color: color-mix(in srgb, var(--app-accent) 45%, var(--app-border)); background: color-mix(in srgb, var(--app-accent) 6%, transparent); }
    .recent-searches mat-icon { width: 14px; height: 14px; font-size: 14px; }
    .recent-searches > small { color: var(--app-text-muted); font-size: 11px; }

    .history-scan { display: grid; grid-template-columns: minmax(250px, .7fr) minmax(420px, 1.3fr); align-items: center; gap: 24px; margin-top: 16px; padding: 15px 17px 10px; overflow: hidden; border-top: 1px solid var(--app-border); background: linear-gradient(90deg, color-mix(in srgb, #0f8f87 5%, transparent), transparent 35%); }
    .history-scan__copy { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .history-scan__copy > span:last-child { display: grid; gap: 2px; min-width: 0; }
    .history-scan__copy strong { font-size: 12px; }
    .history-scan__copy small { overflow: hidden; color: var(--app-text-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
    .history-scan__radar { position: relative; display: grid; place-items: center; flex: 0 0 auto; width: 36px; height: 36px; color: #0f8f87; border: 1px solid color-mix(in srgb, #14b8a6 35%, var(--app-border)); border-radius: 50%; background: color-mix(in srgb, #14b8a6 9%, var(--app-surface)); }
    .history-scan__radar::before, .history-scan__radar::after { content: ''; position: absolute; inset: 5px; border: 1px solid color-mix(in srgb, #14b8a6 35%, transparent); border-radius: 50%; animation: radar-ring 1.6s ease-out infinite; }
    .history-scan__radar::after { animation-delay: .8s; }
    .history-scan__radar mat-icon { width: 18px; height: 18px; font-size: 18px; animation: radar-sweep 1.35s ease-in-out infinite; }
    .scan-route { position: relative; display: grid; grid-template-columns: repeat(4, minmax(70px, 1fr)); align-items: start; min-height: 48px; }
    .scan-track { position: absolute; top: 13px; right: 12.5%; left: 12.5%; height: 2px; overflow: hidden; background: color-mix(in srgb, #0f8f87 22%, var(--app-border)); }
    .scan-track i { position: absolute; inset: 0 auto 0 0; width: 28%; background: linear-gradient(90deg, transparent, #2dd4bf 48%, #2563eb 82%, transparent); filter: drop-shadow(0 0 5px rgba(45, 212, 191, .65)); animation: history-beam 1.8s cubic-bezier(.45,0,.3,1) infinite; }
    .scan-node { position: relative; z-index: 1; display: grid; justify-items: center; gap: 4px; color: var(--app-text-muted); }
    .scan-node mat-icon { display: grid; place-items: center; width: 27px; height: 27px; box-sizing: border-box; padding: 5px; border: 1px solid var(--app-border); border-radius: 50%; background: var(--app-surface); font-size: 15px; animation: evidence-node 1.8s ease-out infinite; }
    .scan-node small { font-size: 8px; font-weight: 850; letter-spacing: .04em; text-transform: uppercase; animation: evidence-label 1.8s ease-out infinite; }
    .scan-node--review mat-icon, .scan-node--review small { animation-delay: .38s; }
    .scan-node--approval mat-icon, .scan-node--approval small { animation-delay: .76s; }
    .scan-node--truth mat-icon, .scan-node--truth small { animation-delay: 1.14s; }

    .result-heading { padding: 4px 5px; }
    .result-heading--resolved { animation: result-arrival .46s cubic-bezier(.2,.8,.2,1) both; }
    .result-identity { display: flex; align-items: center; gap: 14px; }
    .result-icon { width: 50px; height: 50px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 15px; color: #0f766e; background: linear-gradient(145deg, #ccfbf1, #f0fdfa); border: 1px solid #99f6e4; }
    .result-heading h2 { font-size: 25px; }
    .result-heading p { margin: 3px 0 0; color: var(--app-text-muted); font-size: 13px; }
    .result-actions { display: flex; align-items: center; gap: 10px; }
    .report-button { min-height: 43px; padding-inline: 16px !important; border-radius: 14px !important; color: #fff !important; background: linear-gradient(135deg, #10233f, #087f78) !important; box-shadow: 0 8px 20px rgba(16, 35, 63, .16); font-weight: 800; }
    .report-button:hover:not(:disabled) { box-shadow: 0 10px 24px rgba(8, 127, 120, .24); transform: translateY(-1px); }
    .report-button:disabled { opacity: .72; }
    .result-status { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid rgba(22, 163, 74, .22); border-radius: 14px; background: color-mix(in srgb, var(--app-surface) 88%, #dcfce7); }
    .result-status i { width: 10px; height: 10px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 0 5px rgba(22, 163, 74, .12); }
    .result-status--resolved { animation: truth-lock .7s .18s ease-out both; }
    .result-status--resolved i { animation: truth-pulse 1.05s .28s ease-out; }
    .result-status span { display: grid; }
    .result-status strong { color: #15803d; font-size: 12px; }
    .result-status small { color: var(--app-text-muted); font-size: 10px; }
    .result-status--inactive { border-color: rgba(220, 38, 38, .22); background: color-mix(in srgb, var(--app-surface) 88%, #fee2e2); }
    .result-status--inactive i { background: #dc2626; box-shadow: 0 0 0 5px rgba(220, 38, 38, .11); }
    .result-status--inactive strong { color: #b91c1c; }

    .current-layout { display: grid; grid-template-columns: minmax(0, 2.15fr) minmax(300px, .85fr); gap: 16px; }
    .truth-card, .proof-card, .history-section { border: 1px solid var(--app-border); border-radius: 22px; background: var(--app-surface); box-shadow: var(--app-shadow-soft); }
    .truth-card { overflow: hidden; }
    .truth-card > header { padding: 20px 22px 16px; }
    .truth-card h3, .proof-card h3 { margin: 5px 0 0; font-size: 18px; }
    .truth-card__version { display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 999px; color: #0f766e; background: color-mix(in srgb, var(--app-surface) 84%, #ccfbf1); border: 1px solid rgba(15, 118, 110, .22); font-size: 11px; font-weight: 800; }
    .truth-card__version mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .truth-grid { display: grid; grid-template-columns: 1.7fr .8fr .8fr; gap: 1px; border-block: 1px solid var(--app-border); background: var(--app-border); }
    .truth-value { min-height: 112px; display: flex; flex-direction: column; justify-content: center; padding: 16px 18px; background: var(--app-surface); }
    .truth-value--wide { grid-column: span 2; }
    .truth-value--price { background: color-mix(in srgb, var(--app-surface) 91%, #dcfce7); }
    .truth-value > span { color: var(--app-text-muted); font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    .truth-value strong { margin: 6px 0 4px; font-size: 15px; line-height: 1.35; }
    .truth-value--price strong { color: #15803d; font-size: 27px; letter-spacing: -.03em; }
    .truth-value small { color: var(--app-text-muted); font-size: 11px; }
    .truth-value--empty { grid-column: 1 / -1; min-height: 130px; text-align: center; }
    .truth-card > footer { display: flex; align-items: center; gap: 24px; padding: 15px 20px; }
    .truth-card > footer > span { min-width: 0; display: flex; align-items: center; gap: 9px; }
    .truth-card > footer > span > mat-icon { color: var(--app-accent); }
    .truth-card > footer span span { min-width: 0; display: grid; }
    .truth-card > footer small { color: var(--app-text-muted); font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .truth-card > footer strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
    .truth-card > footer a { margin-left: auto; border-radius: 999px; font-weight: 750; }

    .proof-card { padding: 21px; }
    .proof-chain { position: relative; display: grid; gap: 17px; margin: 20px 0; }
    .proof-chain::before { content: ''; position: absolute; left: 17px; top: 28px; bottom: 28px; width: 1px; background: var(--app-border); }
    .proof-chain > div { position: relative; display: flex; align-items: center; gap: 11px; }
    .proof-chain > div > span { z-index: 1; width: 35px; height: 35px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 11px; color: #0f766e; background: color-mix(in srgb, var(--app-surface) 80%, #ccfbf1); border: 1px solid rgba(15, 118, 110, .22); font-size: 10px; font-weight: 900; }
    .proof-chain p { display: grid; margin: 0; }
    .proof-chain small { color: var(--app-text-muted); font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .proof-chain strong { font-size: 12px; }
    .proof-chain em { color: var(--app-text-muted); font-size: 10px; font-style: normal; }
    .proof-seal { display: flex; gap: 9px; padding: 12px; border-radius: 13px; color: #1d4ed8; background: color-mix(in srgb, var(--app-surface) 86%, #dbeafe); border: 1px solid rgba(37, 99, 235, .18); }
    .proof-seal mat-icon { flex: 0 0 auto; }
    .proof-seal span { display: grid; }
    .proof-seal strong { font-size: 11px; }
    .proof-seal small { color: var(--app-text-muted); font-size: 10px; line-height: 1.4; }

    .history-section { padding: 24px; }
    .history-header { align-items: flex-end; padding-bottom: 20px; border-bottom: 1px solid var(--app-border); }
    .history-header p { margin: 5px 0 0; color: var(--app-text-muted); font-size: 13px; }
    .history-filters { display: inline-flex; padding: 4px; border: 1px solid var(--app-border); border-radius: 11px; background: var(--app-soft-surface); }
    .history-filters button { padding: 7px 10px; border: 0; border-radius: 8px; color: var(--app-text-muted); background: transparent; font: inherit; font-size: 11px; font-weight: 800; cursor: pointer; }
    .history-filters button.active { color: var(--app-text); background: var(--app-surface); box-shadow: 0 2px 8px rgba(15, 23, 42, .08); }
    .timeline { width: min(100%, 1440px); margin: 24px auto 0; }
    .timeline-event { display: grid; grid-template-columns: 105px 40px minmax(0, 1fr); }
    .timeline-date { display: grid; align-content: start; justify-items: end; padding: 8px 13px 0 0; }
    .timeline-date strong { font-size: 12px; }
    .timeline-date span { color: var(--app-text-muted); font-size: 10px; }
    .timeline-rail { position: relative; display: flex; justify-content: center; }
    .timeline-rail::after { content: ''; position: absolute; top: 38px; bottom: 0; width: 2px; background: var(--app-border); }
    .timeline-event--last .timeline-rail::after { background: linear-gradient(var(--app-border), transparent); }
    .timeline-dot { z-index: 1; width: 34px; height: 34px; display: grid; place-items: center; border: 4px solid var(--app-surface); border-radius: 50%; color: #fff; box-shadow: 0 0 0 1px var(--app-border); }
    .timeline-dot mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .timeline-dot--published { background: #0f8f87; }
    .timeline-dot--approved { background: #4053b6; }
    .timeline-dot--submitted { background: #64748b; }
    .timeline-dot--introduced { background: #16a34a; }
    .event-card { margin: 0 0 18px 8px; overflow: hidden; border: 1px solid var(--app-border); border-radius: 16px; background: var(--app-soft-surface); }
    .event-card > header { display: flex; justify-content: space-between; gap: 16px; padding: 15px 17px 0; }
    .event-card h3 { margin: 4px 0 0; font-size: 15px; }
    .event-card > header button { width: 28px; height: 28px; display: grid; place-items: center; padding: 0; border: 0; color: var(--app-text-muted); background: transparent; cursor: pointer; }
    .event-kind { font-size: 9px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .event-kind--published, .event-kind--introduced { color: #0f8f87; }
    .event-kind--approved { color: var(--app-accent); }
    .event-kind--submitted { color: var(--app-text-muted); }
    .event-card > p { margin: 8px 17px 13px; color: var(--app-text-muted); font-size: 12px; line-height: 1.5; }
    .change-set { display: grid; gap: 1px; margin: 0 17px 14px; overflow: hidden; border: 1px solid var(--app-border); border-radius: 10px; background: var(--app-border); }
    .change-set > div { min-height: 39px; display: grid; grid-template-columns: 120px minmax(100px, 1fr) 20px minmax(100px, 1fr); align-items: center; gap: 9px; padding: 8px 11px; background: var(--app-surface); font-size: 11px; }
    .change-set span { color: var(--app-text-muted); font-weight: 800; }
    .change-set span small { display: block; margin-top: 2px; font-size: 8px; font-weight: 700; text-transform: uppercase; }
    .change-set del { color: #b91c1c; text-decoration: none; }
    .change-set del::before { content: '− '; font-weight: 900; }
    .change-set strong { color: #15803d; }
    .change-set strong::before { content: '+ '; font-weight: 900; }
    .change-set mat-icon { width: 15px; height: 15px; color: var(--app-text-muted); font-size: 15px; }
    blockquote { display: flex; align-items: flex-start; gap: 7px; margin: 0 17px 14px; padding: 10px 12px; border-left: 3px solid var(--app-accent); border-radius: 0 9px 9px 0; color: var(--app-text); background: color-mix(in srgb, var(--app-accent) 7%, transparent); font-size: 11px; line-height: 1.5; }
    blockquote mat-icon { width: 15px; height: 15px; flex: 0 0 auto; color: var(--app-accent); font-size: 15px; }
    .event-card > footer { display: grid; grid-template-columns: 1fr 1.35fr 1fr auto; align-items: center; gap: 12px; padding: 11px 16px; border-top: 1px solid var(--app-border); background: var(--app-surface); }
    .event-card > footer > span { min-width: 0; display: grid; grid-template-columns: 20px 1fr; grid-template-rows: auto auto; column-gap: 6px; }
    .event-card > footer mat-icon { grid-row: 1 / 3; align-self: center; width: 17px; height: 17px; color: var(--app-text-muted); font-size: 17px; }
    .event-card > footer small { color: var(--app-text-muted); font-size: 8px; font-weight: 800; text-transform: uppercase; }
    .event-card > footer strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; }
    .event-card > footer button, .event-card > footer a { border-radius: 999px; color: var(--app-accent); font-weight: 750; text-decoration: none; }
    .history-origin { display: flex; align-items: center; gap: 11px; width: min(calc(100% - 113px), 1327px); margin: 0 auto; padding: 13px 16px; box-sizing: border-box; border: 1px dashed var(--app-border); border-radius: 13px; }
    .history-origin > span { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; color: #0f766e; background: color-mix(in srgb, var(--app-surface) 80%, #ccfbf1); }
    .history-origin mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .history-origin div { display: grid; }
    .history-origin strong { font-size: 11px; }
    .history-origin small { color: var(--app-text-muted); font-size: 10px; }

    .empty-result { padding: 55px 20px; text-align: center; border: 1px dashed var(--app-border); border-radius: 22px; background: var(--app-surface); }
    .empty-result > span { width: 58px; height: 58px; display: grid; place-items: center; margin: 0 auto 14px; border-radius: 18px; color: var(--app-text-muted); background: var(--app-soft-surface); }
    .empty-result h2 { margin: 0; font-size: 20px; }
    .empty-result p { max-width: 570px; margin: 8px auto 0; color: var(--app-text-muted); }

    @keyframes trace-spin { to { transform: rotate(360deg); } }
    @keyframes radar-ring { 0% { transform: scale(.55); opacity: 0; } 35% { opacity: .8; } 100% { transform: scale(1.45); opacity: 0; } }
    @keyframes radar-sweep { 0%, 100% { transform: rotate(-12deg) scale(.94); opacity: .7; } 50% { transform: rotate(12deg) scale(1.06); opacity: 1; } }
    @keyframes history-beam { 0% { left: -28%; opacity: 0; } 12% { opacity: 1; } 82% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
    @keyframes evidence-node { 0%, 18%, 100% { color: var(--app-text-muted); border-color: var(--app-border); box-shadow: none; transform: scale(.92); } 30%, 58% { color: #0f8f87; border-color: #2dd4bf; box-shadow: 0 0 0 5px color-mix(in srgb, #2dd4bf 13%, transparent), 0 0 14px color-mix(in srgb, #2dd4bf 28%, transparent); transform: scale(1); } 72% { color: var(--app-text); transform: scale(.96); } }
    @keyframes evidence-label { 0%, 18%, 100% { color: var(--app-text-muted); opacity: .62; } 30%, 65% { color: #0f8f87; opacity: 1; } }
    @keyframes result-arrival { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @keyframes truth-lock { from { border-color: color-mix(in srgb, #14b8a6 70%, var(--app-border)); box-shadow: 0 0 0 8px color-mix(in srgb, #14b8a6 12%, transparent); transform: translateX(5px); } to { box-shadow: none; transform: none; } }
    @keyframes truth-pulse { 0% { box-shadow: 0 0 0 0 rgba(22,163,74,.4); } 65% { box-shadow: 0 0 0 11px rgba(22,163,74,0); } 100% { box-shadow: 0 0 0 5px rgba(22,163,74,.12); } }

    :host-context(.theme-dark) .eyebrow, :host-context(.theme-dark) .section-kicker, :host-context(.theme-dark) h1 span { color: #5eead4; }
    :host-context(.theme-dark) .scope-card__signal, :host-context(.theme-dark) .scope-card small { color: #5eead4; }
    :host-context(.theme-dark) .result-icon, :host-context(.theme-dark) .proof-chain > div > span, :host-context(.theme-dark) .history-origin > span { color: #5eead4; background: rgba(15, 118, 110, .2); border-color: rgba(94, 234, 212, .25); }
    :host-context(.theme-dark) .result-status strong, :host-context(.theme-dark) .truth-value--price strong, :host-context(.theme-dark) .change-set strong { color: #86efac; }
    :host-context(.theme-dark) .change-set del { color: #fca5a5; }
    :host-context(.theme-dark) .scope-card { background: rgba(15, 118, 110, .13); }
    :host-context(.theme-dark) .history-scan__radar, :host-context(.theme-dark) .scan-node mat-icon { background: color-mix(in srgb, var(--app-surface-elevated) 92%, #0f766e); }
    :host-context(.theme-dark) .scan-track { background: color-mix(in srgb, #5eead4 18%, var(--app-border)); }

    @media (max-width: 1080px) {
      .search-grid { grid-template-columns: 1fr 1fr; }
      .search-button { width: 100%; }
      .history-scan { grid-template-columns: 1fr; gap: 12px; }
      .current-layout { grid-template-columns: 1fr; }
      .proof-card { display: grid; grid-template-columns: 1fr 1.4fr; column-gap: 24px; }
      .proof-chain { grid-column: 2; grid-row: 1 / 4; margin: 0; }
      .proof-seal { align-self: end; }
    }

    @media (max-width: 720px) {
      .trace-page { gap: 14px; }
      .trace-hero { align-items: stretch; flex-direction: column; padding: 22px 18px; border-radius: 18px; }
      .trace-hero__copy p { font-size: 14px; }
      .scope-card { min-width: 0; }
      .search-studio, .history-section { padding: 17px; border-radius: 18px; }
      .search-studio__topline { align-items: flex-start; }
      .prototype-badge { padding: 6px; }
      .prototype-badge mat-icon { margin: 0; }
      .search-grid { grid-template-columns: 1fr; }
      .field--scope { order: -1; }
      .recent-searches > span { width: 100%; }
      .history-scan { margin-inline: -3px; padding: 14px 10px 8px; }
      .history-scan__copy { justify-content: center; text-align: left; }
      .scan-route { grid-template-columns: repeat(4, 1fr); }
      .scan-node small { font-size: 7px; }
      .result-heading { align-items: flex-start; flex-wrap: wrap; }
      .result-actions { width: 100%; justify-content: space-between; padding-left: 57px; }
      .result-icon { width: 43px; height: 43px; border-radius: 13px; }
      .result-heading h2 { font-size: 20px; word-break: break-word; }
      .result-status { padding: 8px 10px; }
      .result-status small { display: none; }
      .truth-card > header { align-items: flex-start; padding: 17px; }
      .truth-card__version { padding: 6px 8px; }
      .truth-grid { grid-template-columns: 1fr 1fr; }
      .truth-value--wide { grid-column: 1 / -1; }
      .truth-value { min-height: 98px; padding: 14px; }
      .truth-card > footer { align-items: stretch; flex-direction: column; gap: 12px; padding: 15px 17px; }
      .truth-card > footer a { width: 100%; margin: 0; }
      .proof-card { display: block; padding: 18px; }
      .proof-chain { margin: 18px 0; }
      .history-header { align-items: stretch; flex-direction: column; }
      .history-filters { display: grid; grid-template-columns: repeat(3, 1fr); }
      .history-filters button { padding-inline: 6px; }
      .timeline-event { grid-template-columns: 34px minmax(0, 1fr); }
      .timeline-date { grid-column: 2; grid-row: 1; justify-items: start; display: flex; gap: 5px; padding: 0 0 7px 9px; }
      .timeline-rail { grid-column: 1; grid-row: 1 / 3; }
      .event-card { grid-column: 2; grid-row: 2; margin-left: 9px; }
      .change-set > div { grid-template-columns: 1fr 1fr; gap: 4px 8px; }
      .change-set span { grid-column: 1 / -1; }
      .change-set mat-icon { display: none; }
      .event-card > footer { grid-template-columns: 1fr; }
      .event-card > footer button, .event-card > footer a { width: 100%; justify-content: center; margin-top: 3px; }
      .history-origin { width: calc(100% - 43px); margin-right: 0; margin-left: 43px; }
    }

    @media (max-width: 420px) {
      h1 { font-size: 29px; }
      .trace-hero { padding: 20px 16px; }
      .prototype-badge { font-size: 0; }
      .truth-grid { grid-template-columns: 1fr; }
      .truth-value--wide { grid-column: auto; }
      .result-heading { flex-wrap: wrap; }
      .result-status { margin-left: 57px; }
      .result-actions { padding-left: 57px; flex-wrap: wrap; }
      .result-actions .result-status { margin-left: 0; }
      .report-button { flex: 1 1 170px; }
      .history-section { padding-inline: 13px; }
      .event-card > header, .event-card > p { margin-left: 0; margin-right: 0; }
      .event-card > header { padding-inline: 13px; }
      .event-card > p { padding-inline: 13px; }
      .change-set, blockquote { margin-inline: 13px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .search-button mat-icon, .history-scan__radar::before, .history-scan__radar::after, .history-scan__radar mat-icon,
      .scan-track i, .scan-node mat-icon, .scan-node small, .result-heading--resolved, .result-status--resolved,
      .result-status--resolved i { animation: none !important; }
      .scan-track i { left: 0; width: 100%; opacity: .75; }
      .scan-node mat-icon { color: #0f8f87; border-color: color-mix(in srgb, #14b8a6 42%, var(--app-border)); transform: none; }
    }
  `]
})
export class BusinessTraceComponent implements OnInit {
  private readonly importService = inject(ImportService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthFacade);
  private readonly toast = inject(ToastService);

  readonly pilotScope = PILOT_SCOPE;
  readonly scopeKey = 'saint-marcellin-pdu';
  objectType: TraceObjectType = 'Article';
  query = '';
  trace: BusinessTraceResult | null = null;
  suggestions: BusinessTraceSuggestion[] = [];
  isLoading = false;
  isGeneratingReport = false;
  showEmpty = false;
  searchError = '';
  filter: TraceFilter = 'all';

  ngOnInit(): void {
    this.removeLegacyStorage();
    const identifier = this.route.snapshot.queryParamMap.get('identifier')?.trim();
    if (identifier) {
      this.objectType = 'Article';
      this.query = identifier;
      this.loadHistory();
      this.search();
      return;
    }

    this.restoreState();
    this.loadHistory();
    if (this.query) this.search();
  }

  get visibleEvents(): BusinessTraceEvent[] {
    const events = this.trace?.events ?? [];
    if (this.filter === 'changes') return events.filter(event => event.category === 'changes');
    if (this.filter === 'decisions') return events.filter(event => event.category === 'decisions');
    return events;
  }

  get resultIcon(): string {
    return this.objectType === 'Basis price' ? 'payments' : 'inventory_2';
  }

  get resultDescription(): string {
    return this.objectType === 'Basis price'
      ? 'Current governed price · Standard PDU portfolio'
      : 'Governed article · Standard PDU portfolio';
  }

  get historySubject(): string {
    return this.objectType === 'Basis price' ? 'price record' : 'article';
  }

  get primarySource() {
    return [...(this.trace?.sources ?? [])].sort((left, right) =>
      new Date(right.publishedAt ?? 0).getTime() - new Date(left.publishedAt ?? 0).getTime())[0] ?? null;
  }

  get evidenceLabel(): string {
    return this.primarySource?.releaseName || 'Published evidence';
  }

  get responsibilityActors(): BusinessTraceActor[] {
    const responsibility = this.trace?.responsibility;
    return responsibility
      ? [responsibility.prepared, responsibility.approved, responsibility.published].filter((actor): actor is BusinessTraceActor => !!actor)
      : [];
  }

  openEvidence(event: BusinessTraceEvent): void {
    if (!event.sourceJobId) return;
    if (event.sourceType === 'maintenance') {
      const kind = event.releasePackageId ? 'package' : 'job';
      const evidenceId = event.releasePackageId ?? event.sourceJobId;
      this.router.navigate(['/maintenance', kind, evidenceId]);
      return;
    }

    this.router.navigate(['/import', event.sourceJobId]);
  }

  generateReport(): void {
    const result = this.trace;
    if (!result || this.isGeneratingReport) return;

    this.isGeneratingReport = true;
    this.importService.generateBusinessTraceReport(this.scopeKey, this.apiObjectType, result.identifier)
      .pipe(finalize(() => this.isGeneratingReport = false))
      .subscribe({
        next: blob => {
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          const safeIdentifier = result.identifier.replace(/[^a-zA-Z0-9_-]+/g, '_');
          link.href = url;
          link.download = `PDU_Trace_Evidence_${safeIdentifier}.pdf`;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.toast.success('Evidence report generated.');
        },
        error: () => this.toast.error('The evidence report could not be generated.')
      });
  }

  search(): void {
    const identifier = this.query.trim();
    if (!identifier || this.isLoading) return;

    const requestedObjectType = this.objectType;
    const requestedApiObjectType = this.apiObjectType;
    this.query = identifier;
    this.saveState(identifier);
    this.isLoading = true;
    this.trace = null;
    this.showEmpty = false;
    this.searchError = '';
    this.filter = 'all';
    this.importService.searchBusinessTrace(this.scopeKey, requestedApiObjectType, identifier)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: result => {
          if (this.objectType !== requestedObjectType) return;
          this.trace = result;
          this.query = result.identifier;
          this.rememberSearch(result.identifier, result);
        },
        error: (error: HttpErrorResponse) => {
          if (this.objectType !== requestedObjectType) return;
          this.showEmpty = true;
          this.searchError = error.error?.error || 'The business trace could not be loaded.';
        }
      });
  }

  useSuggestion(item: BusinessTraceSuggestion): void {
    this.query = item.identifier;
    this.search();
  }

  selectObjectType(): void {
    this.trace = null;
    this.showEmpty = false;
    this.searchError = '';
    this.query = this.readState().queries[this.objectType] ?? '';
    this.saveState();
    this.loadHistory();
  }

  iconFor(kind: BusinessTraceEvent['kind']): string {
    return { published: 'rocket_launch', approved: 'verified', submitted: 'send', introduced: 'add', removed: 'remove' }[kind];
  }

  labelFor(kind: BusinessTraceEvent['kind']): string {
    return { published: 'Published change', approved: 'Approval decision', submitted: 'Review started', introduced: 'Introduced', removed: 'Removed' }[kind];
  }

  sourceIcon(dataset: string): string {
    if (dataset.toLowerCase().includes('price')) return 'payments';
    if (dataset.toLowerCase().includes('description')) return 'translate';
    return 'inventory_2';
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  formatFieldValue(field: BusinessTraceField): string {
    if (field.kind !== 'price') return field.value || '—';
    const amount = Number(field.value);
    if (Number.isNaN(amount)) return field.value || '—';
    const currency = this.trace?.scope.currency || 'EUR';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  }

  formatDate(value: string | null): string {
    return value ? new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
  }

  formatLongDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
  }

  formatTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }

  formatDateTime(value: string | null): string {
    return value ? `${this.formatDate(value)} · ${this.formatTime(value)}` : 'Time not recorded';
  }

  private restoreState(): void {
    const state = this.readState();
    this.objectType = state.objectType;
    this.query = state.queries[this.objectType] ?? '';
  }

  private loadHistory(): void {
    this.suggestions = this.readHistory()[this.objectType];
  }

  private rememberSearch(identifier: string, result?: BusinessTraceResult): void {
    const history = this.readHistory();
    const suggestion: BusinessTraceSuggestion = {
      identifier,
      label: result?.displayName || identifier,
      detail: result?.statusLabel ?? null,
      objectType: result?.objectType ?? (this.apiObjectType === 'Article' ? 0 : 1),
      objectTypeLabel: result?.objectTypeLabel ?? this.objectType
    };
    history[this.objectType] = [
      suggestion,
      ...history[this.objectType].filter(item => item.identifier.toLocaleLowerCase() !== identifier.toLocaleLowerCase())
    ].slice(0, 6);
    this.writeStorage(this.historyStorageKey, history);
    this.saveState(identifier);
    this.loadHistory();
  }

  private saveState(identifier = this.query.trim()): void {
    const state = this.readState();
    state.objectType = this.objectType;
    state.queries[this.objectType] = identifier;
    this.writeStorage(this.stateStorageKey, state);
  }

  private readState(): { objectType: TraceObjectType; queries: Record<TraceObjectType, string> } {
    try {
      const stored = JSON.parse(localStorage.getItem(this.stateStorageKey) ?? '{}');
      return {
        objectType: stored.objectType === 'Basis price' ? 'Basis price' : 'Article',
        queries: {
          Article: typeof stored.queries?.Article === 'string' ? stored.queries.Article : '',
          'Basis price': typeof stored.queries?.['Basis price'] === 'string' ? stored.queries['Basis price'] : ''
        }
      };
    } catch {
      return { objectType: 'Article', queries: { Article: '', 'Basis price': '' } };
    }
  }

  private readHistory(): TraceHistory {
    try {
      const stored = JSON.parse(localStorage.getItem(this.historyStorageKey) ?? '{}');
      return {
        Article: this.validHistoryItems(stored.Article),
        'Basis price': this.validHistoryItems(stored['Basis price'])
      };
    } catch {
      return { ...EMPTY_TRACE_HISTORY };
    }
  }

  private validHistoryItems(value: unknown): BusinessTraceSuggestion[] {
    return Array.isArray(value)
      ? value.filter((item): item is BusinessTraceSuggestion => !!item && typeof item.identifier === 'string').slice(0, 6)
      : [];
  }

  private writeStorage(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Search remains available when browser storage is disabled or full.
    }
  }

  private removeLegacyStorage(): void {
    try {
      localStorage.removeItem(TRACE_STATE_KEY_PREFIX);
      localStorage.removeItem(TRACE_HISTORY_KEY_PREFIX);
    } catch {
      // Search remains available when browser storage is disabled.
    }
  }

  private get stateStorageKey(): string {
    return `${TRACE_STATE_KEY_PREFIX}:${this.storageOwner}:${this.scopeKey}`;
  }

  private get historyStorageKey(): string {
    return `${TRACE_HISTORY_KEY_PREFIX}:${this.storageOwner}:${this.scopeKey}`;
  }

  private get storageOwner(): string {
    return encodeURIComponent(this.auth.userId || this.auth.loginName || 'unknown-user');
  }

  private get apiObjectType(): 'Article' | 'PriceList' {
    return this.objectType === 'Basis price' ? 'PriceList' : 'Article';
  }
}
