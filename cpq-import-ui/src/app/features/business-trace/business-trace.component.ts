import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { PILOT_SCOPE } from '../../core/models/import.models';

type TraceFilter = 'all' | 'changes' | 'decisions';
type TraceKind = 'published' | 'approved' | 'submitted' | 'introduced';

interface TraceEvent {
  kind: TraceKind;
  date: string;
  time: string;
  title: string;
  summary: string;
  actorLabel: string;
  actor: string;
  source: string;
  release: string;
  changes?: Array<{ field: string; before: string; after: string }>;
  decision?: string;
}

@Component({
  selector: 'app-business-trace',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, RouterLink],
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
          <span class="prototype-badge"><mat-icon>science</mat-icon> Prototype · sample evidence</span>
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

          <button mat-flat-button type="button" class="search-button" (click)="search()">
            <mat-icon>manage_search</mat-icon> Search trace
          </button>
        </div>

        <div class="recent-searches">
          <span>Try a recent search</span>
          <button type="button" *ngFor="let item of recentSearches" (click)="useRecent(item)">
            <mat-icon>{{ item.icon }}</mat-icon>{{ item.label }}
          </button>
        </div>
      </section>

      <ng-container *ngIf="hasSearched">
        <section class="result-heading">
          <div class="result-identity">
            <span class="result-icon"><mat-icon>{{ resultIcon }}</mat-icon></span>
            <div>
              <span class="section-kicker">{{ objectType }} · Current CPQ record</span>
              <h2>{{ displayIdentifier }}</h2>
              <p>{{ resultDescription }}</p>
            </div>
          </div>
          <div class="result-status"><i></i><span><strong>Active in CPQ</strong><small>Last published 16 Jul 2026</small></span></div>
        </section>

        <section class="current-layout">
          <article class="truth-card">
            <header>
              <div>
                <span class="section-kicker">Current truth</span>
                <h3>Values used by CPQ today</h3>
              </div>
              <span class="truth-card__version"><mat-icon>verified</mat-icon> Release 2026.1</span>
            </header>

            <div class="truth-grid">
              <div class="truth-value truth-value--wide"><span>Description</span><strong>PDU standard power distribution unit, 16A</strong><small>English · Commercial description</small></div>
              <div class="truth-value truth-value--price"><span>Basis price</span><strong>€1.20</strong><small>EUR · Per PC</small></div>
              <div class="truth-value"><span>Category</span><strong>Standard</strong><small>Article Master</small></div>
              <div class="truth-value"><span>Unit</span><strong>PC</strong><small>Article Master</small></div>
              <div class="truth-value"><span>Validity</span><strong>01 Jan – 31 Dec 2026</strong><small>Basis Price</small></div>
            </div>

            <footer>
              <span><mat-icon>inventory_2</mat-icon><span><small>Master source</small><strong>Articles_PDU_SM_2026</strong></span></span>
              <span><mat-icon>payments</mat-icon><span><small>Price source</small><strong>Prices_PDU_SM_2026</strong></span></span>
              <a mat-stroked-button routerLink="/uploads"><mat-icon>open_in_new</mat-icon> View publication</a>
            </footer>
          </article>

          <aside class="proof-card">
            <span class="section-kicker">Evidence at a glance</span>
            <h3>A complete chain of responsibility</h3>
            <div class="proof-chain">
              <div><span>WB</span><p><small>Prepared by</small><strong>Walid Benhamed</strong><em>14 Jul · 18:24</em></p></div>
              <div><span>HA</span><p><small>Approved by</small><strong>Hanan</strong><em>16 Jul · 09:12</em></p></div>
              <div><span>WA</span><p><small>Published by</small><strong>Walid</strong><em>16 Jul · 09:18</em></p></div>
            </div>
            <div class="proof-seal"><mat-icon>workspace_premium</mat-icon><span><strong>Approval evidence preserved</strong><small>The accepted values remain unchanged in history.</small></span></div>
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
              <div class="timeline-date"><strong>{{ event.date }}</strong><span>{{ event.time }}</span></div>
              <div class="timeline-rail"><span [class]="'timeline-dot timeline-dot--' + event.kind"><mat-icon>{{ iconFor(event.kind) }}</mat-icon></span></div>
              <div class="event-card">
                <header>
                  <div><span [class]="'event-kind event-kind--' + event.kind">{{ labelFor(event.kind) }}</span><h3>{{ event.title }}</h3></div>
                  <button type="button" aria-label="More options"><mat-icon>more_horiz</mat-icon></button>
                </header>
                <p>{{ event.summary }}</p>

                <div class="change-set" *ngIf="event.changes?.length">
                  <div *ngFor="let change of event.changes">
                    <span>{{ change.field }}</span>
                    <del>{{ change.before }}</del>
                    <mat-icon>arrow_forward</mat-icon>
                    <strong>{{ change.after }}</strong>
                  </div>
                </div>

                <blockquote *ngIf="event.decision"><mat-icon>format_quote</mat-icon>{{ event.decision }}</blockquote>

                <footer>
                  <span><mat-icon>person</mat-icon><small>{{ event.actorLabel }}</small><strong>{{ event.actor }}</strong></span>
                  <span><mat-icon>description</mat-icon><small>Source</small><strong>{{ event.source }}</strong></span>
                  <span><mat-icon>deployed_code</mat-icon><small>Release</small><strong>{{ event.release }}</strong></span>
                  <button mat-button type="button"><mat-icon>fact_check</mat-icon> Open evidence</button>
                </footer>
              </div>
            </article>
          </div>

          <div class="history-origin"><span><mat-icon>flag</mat-icon></span><div><strong>Beginning of recorded history</strong><small>This article first entered the governed CPQ portfolio on 12 January 2025.</small></div></div>
        </section>
      </ng-container>

      <section class="empty-result" *ngIf="showEmpty">
        <span><mat-icon>search_off</mat-icon></span>
        <h2>No matching object in this scope</h2>
        <p>Check the identifier or choose another object type. Results are limited to {{ pilotScope.site }} · {{ pilotScope.productFamily }}.</p>
      </section>
    </main>
  `,
  styles: [`
    :host { display: block; color: var(--app-text); }
    .trace-page { max-width: 1460px; margin: 0 auto; display: grid; gap: 20px; }
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
    .recent-searches { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
    .recent-searches > span { margin-right: 3px; color: var(--app-text-muted); font-size: 11px; font-weight: 750; }
    .recent-searches button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 9px; border: 1px solid var(--app-border); border-radius: 999px; color: var(--app-text-muted); background: transparent; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
    .recent-searches button:hover { color: var(--app-accent); border-color: color-mix(in srgb, var(--app-accent) 45%, var(--app-border)); background: color-mix(in srgb, var(--app-accent) 6%, transparent); }
    .recent-searches mat-icon { width: 14px; height: 14px; font-size: 14px; }

    .result-heading { padding: 4px 5px; }
    .result-identity { display: flex; align-items: center; gap: 14px; }
    .result-icon { width: 50px; height: 50px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 15px; color: #0f766e; background: linear-gradient(145deg, #ccfbf1, #f0fdfa); border: 1px solid #99f6e4; }
    .result-heading h2 { font-size: 25px; }
    .result-heading p { margin: 3px 0 0; color: var(--app-text-muted); font-size: 13px; }
    .result-status { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid rgba(22, 163, 74, .22); border-radius: 14px; background: color-mix(in srgb, var(--app-surface) 88%, #dcfce7); }
    .result-status i { width: 10px; height: 10px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 0 5px rgba(22, 163, 74, .12); }
    .result-status span { display: grid; }
    .result-status strong { color: #15803d; font-size: 12px; }
    .result-status small { color: var(--app-text-muted); font-size: 10px; }

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
    .timeline { margin-top: 24px; }
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
    .event-card > footer button { border-radius: 999px; color: var(--app-accent); font-weight: 750; }
    .history-origin { display: flex; align-items: center; gap: 11px; margin: 0 0 0 113px; padding: 13px 16px; border: 1px dashed var(--app-border); border-radius: 13px; }
    .history-origin > span { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; color: #0f766e; background: color-mix(in srgb, var(--app-surface) 80%, #ccfbf1); }
    .history-origin mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .history-origin div { display: grid; }
    .history-origin strong { font-size: 11px; }
    .history-origin small { color: var(--app-text-muted); font-size: 10px; }

    .empty-result { padding: 55px 20px; text-align: center; border: 1px dashed var(--app-border); border-radius: 22px; background: var(--app-surface); }
    .empty-result > span { width: 58px; height: 58px; display: grid; place-items: center; margin: 0 auto 14px; border-radius: 18px; color: var(--app-text-muted); background: var(--app-soft-surface); }
    .empty-result h2 { margin: 0; font-size: 20px; }
    .empty-result p { max-width: 570px; margin: 8px auto 0; color: var(--app-text-muted); }

    :host-context(.theme-dark) .eyebrow, :host-context(.theme-dark) .section-kicker, :host-context(.theme-dark) h1 span { color: #5eead4; }
    :host-context(.theme-dark) .scope-card__signal, :host-context(.theme-dark) .scope-card small { color: #5eead4; }
    :host-context(.theme-dark) .result-icon, :host-context(.theme-dark) .proof-chain > div > span, :host-context(.theme-dark) .history-origin > span { color: #5eead4; background: rgba(15, 118, 110, .2); border-color: rgba(94, 234, 212, .25); }
    :host-context(.theme-dark) .result-status strong, :host-context(.theme-dark) .truth-value--price strong, :host-context(.theme-dark) .change-set strong { color: #86efac; }
    :host-context(.theme-dark) .change-set del { color: #fca5a5; }
    :host-context(.theme-dark) .scope-card { background: rgba(15, 118, 110, .13); }

    @media (max-width: 1080px) {
      .search-grid { grid-template-columns: 1fr 1fr; }
      .search-button { width: 100%; }
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
      .result-heading { align-items: flex-start; }
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
      .event-card > footer button { width: 100%; justify-content: center; margin-top: 3px; }
      .history-origin { margin-left: 43px; }
    }

    @media (max-width: 420px) {
      h1 { font-size: 29px; }
      .trace-hero { padding: 20px 16px; }
      .prototype-badge { font-size: 0; }
      .truth-grid { grid-template-columns: 1fr; }
      .truth-value--wide { grid-column: auto; }
      .result-heading { flex-wrap: wrap; }
      .result-status { margin-left: 57px; }
      .history-section { padding-inline: 13px; }
      .event-card > header, .event-card > p { margin-left: 0; margin-right: 0; }
      .event-card > header { padding-inline: 13px; }
      .event-card > p { padding-inline: 13px; }
      .change-set, blockquote { margin-inline: 13px; }
    }
  `]
})
export class BusinessTraceComponent {
  readonly pilotScope = PILOT_SCOPE;
  objectType = 'Article';
  query = '1_D001951AA';
  displayIdentifier = '1_D001951AA';
  hasSearched = true;
  showEmpty = false;
  filter: TraceFilter = 'all';

  readonly recentSearches = [
    { label: '1_D001951AA', type: 'Article', icon: 'inventory_2' },
    { label: '1_A023384AA', type: 'Article', icon: 'inventory_2' },
    { label: 'Price · 1_CB00320AA', type: 'Basis price', icon: 'payments' }
  ];

  readonly events: TraceEvent[] = [
    {
      kind: 'published', date: '16 Jul 2026', time: '09:18', title: 'Annual 2026 values published to CPQ',
      summary: 'The approved coordinated release became the active source for Article Master and Basis Price.',
      actorLabel: 'Published by', actor: 'Walid', source: 'Prices_PDU_SM_2026', release: 'Annual PDU 2026',
      changes: [
        { field: 'Basis price', before: '€1.16', after: '€1.20' },
        { field: 'Valid to', before: '31 Dec 2025', after: '31 Dec 2026' }
      ]
    },
    {
      kind: 'approved', date: '16 Jul 2026', time: '09:12', title: 'Release approved for publication',
      summary: 'The approver accepted the exact Article Master and Basis Price comparison presented at the review gate.',
      actorLabel: 'Approved by', actor: 'Hanan', source: 'Approval record #AR-1042', release: 'Annual PDU 2026',
      decision: 'Validated against the complete annual portfolio. Price update accepted with no orphan or unpriced articles.'
    },
    {
      kind: 'submitted', date: '14 Jul 2026', time: '18:24', title: 'Coordinated release submitted for review',
      summary: 'The Article Master and Basis Price drafts were locked together and shared with approvers.',
      actorLabel: 'Submitted by', actor: 'Walid Benhamed', source: '2 governed uploads', release: 'Annual PDU 2026'
    },
    {
      kind: 'published', date: '15 Jan 2025', time: '11:36', title: 'Article description clarified',
      summary: 'A commercial wording update was approved and published without changing the article identity.',
      actorLabel: 'Published by', actor: 'Nadia', source: 'Articles_PDU_SM_2025', release: 'Annual PDU 2025',
      changes: [{ field: 'Description', before: 'PDU power unit, 16A', after: 'PDU standard power distribution unit, 16A' }]
    },
    {
      kind: 'introduced', date: '12 Jan 2025', time: '14:08', title: 'Article introduced into the governed portfolio',
      summary: 'The article and its first basis price were approved together and published to CPQ.',
      actorLabel: 'Introduced by', actor: 'Sophie Martin', source: 'Initial_PDU_Portfolio_2025', release: 'Pilot baseline 2025',
      changes: [
        { field: 'Article', before: 'Not in CPQ', after: 'Active' },
        { field: 'Basis price', before: '—', after: '€1.16' }
      ]
    }
  ];

  get visibleEvents(): TraceEvent[] {
    if (this.filter === 'changes') return this.events.filter(event => !!event.changes?.length);
    if (this.filter === 'decisions') return this.events.filter(event => event.kind === 'approved' || event.kind === 'submitted');
    return this.events;
  }

  get resultIcon(): string {
    return this.objectType === 'Basis price' ? 'payments' : 'inventory_2';
  }

  get resultDescription(): string {
    return this.objectType === 'Basis price'
      ? 'Current governed price · Standard PDU portfolio'
      : 'Low-voltage distribution unit · Standard portfolio';
  }

  get historySubject(): string {
    return this.objectType === 'Basis price' ? 'price record' : 'article';
  }

  search(): void {
    const value = this.query.trim();
    this.showEmpty = !value || value.toLowerCase().includes('unknown');
    this.hasSearched = !this.showEmpty;
    if (this.hasSearched) this.displayIdentifier = value;
  }

  useRecent(item: { label: string; type: string }): void {
    this.objectType = item.type;
    this.query = item.label.replace('Price · ', '');
    this.search();
  }

  selectObjectType(): void {
    if (this.objectType === 'Basis price') this.query = '1_CB00320AA';
    else this.query = '1_D001951AA';
    this.search();
  }

  iconFor(kind: TraceKind): string {
    return { published: 'rocket_launch', approved: 'verified', submitted: 'send', introduced: 'add' }[kind];
  }

  labelFor(kind: TraceKind): string {
    return { published: 'Published change', approved: 'Approval decision', submitted: 'Review started', introduced: 'Introduced' }[kind];
  }
}
