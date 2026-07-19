import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PriceListCandidateSummary } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';

type CandidateSource = 'All' | PriceListCandidateSummary['source'];

@Component({
  selector: 'app-article-release-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatProgressSpinnerModule, MatSnackBarModule],
  template: `
    <section class="release-setup" id="article-release-workflow">
      <header class="section-head">
        <div><span class="eyebrow">New coordinated release</span><h2>Choose the Price List candidate for this draft</h2></div>
      </header>

      <mat-form-field class="release-name" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Release name</mat-label>
        <input matInput [(ngModel)]="releaseName" maxlength="120" />
      </mat-form-field>

      <div class="candidate-picker">
        <div class="picker-head">
          <div><span class="eyebrow">Price List source</span><h3>Select the prices this release should use</h3></div>
          <label class="candidate-search">
            <mat-icon>search</mat-icon>
            <input [(ngModel)]="search" placeholder="Search file or owner" aria-label="Search Price List versions" />
          </label>
        </div>
        <nav class="source-tabs" aria-label="Price List sources">
          <button *ngFor="let source of sources" type="button" [class.active]="selectedSource === source"
            (click)="selectedSource = source">
            <mat-icon>{{ sourceIcon(source) }}</mat-icon><span>{{ sourceLabel(source) }}</span><b>{{ candidateCount(source) }}</b>
          </button>
        </nav>

      <div class="loading" *ngIf="loading">
        <mat-spinner diameter="28" />
        <span>Finding compatible Price Lists...</span>
      </div>

      <div class="error" *ngIf="!loading && errorMessage">
        <mat-icon>error_outline</mat-icon><span>{{ errorMessage }}</span>
        <button mat-button type="button" (click)="load()">Try again</button>
      </div>

      <div class="candidate-list" *ngIf="!loading && !errorMessage && filteredCandidates.length">
        <button class="candidate" type="button" *ngFor="let candidate of filteredCandidates"
          [class.selected]="selectedCandidateId === candidate.jobId"
          [class.ineligible]="!candidate.isEligible"
          [disabled]="!candidate.isEligible || busy"
          (click)="selectedCandidateId = candidate.jobId">
          <span class="radio"><mat-icon>{{ selectedCandidateId === candidate.jobId ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon></span>
          <span class="candidate-identity">
            <span class="candidate-title">
              <strong>{{ candidate.fileName }}</strong>
              <em *ngIf="candidate.isActive">Current active</em>
            </span>
            <small>{{ candidate.source }} · {{ candidate.versionLabel }} · {{ candidate.ownerDisplayName }}</small>
            <span class="copy-note" *ngIf="candidate.requiresWorkingCopy"><mat-icon>content_copy</mat-icon>A private working copy will be created</span>
            <span class="correction-note" *ngIf="candidate.isEligible && candidate.errorRows > 0"><mat-icon>sync</mat-icon>Validation will be recalculated against this Article Master after pairing</span>
            <span class="blocked-note" *ngIf="!candidate.isEligible"><mat-icon>block</mat-icon>{{ candidate.ineligibleReason }}</span>
          </span>
          <span class="candidate-impact" [class.attention]="candidate.articlesWithoutPrices || candidate.pricesWithoutArticles">
            <strong>{{ candidate.matchedArticles }}/{{ articleCount }}</strong>
            <small>{{ candidate.articlesWithoutPrices ? candidate.articlesWithoutPrices + ' without price' : candidate.pricesWithoutArticles ? candidate.pricesWithoutArticles + ' orphan prices' : 'All articles priced' }}</small>
          </span>
          <span class="use-draft"><mat-icon>{{ candidate.requiresWorkingCopy ? 'content_copy' : 'playlist_add_check' }}</mat-icon>{{ candidate.requiresWorkingCopy ? 'Use copy' : 'Use draft' }}</span>
        </button>
      </div>

      <div class="empty" *ngIf="!loading && !errorMessage && !filteredCandidates.length">
        <mat-icon>search_off</mat-icon>
        <strong>No Price List matches this view</strong>
        <span>Try another source or clear the search.</span>
      </div>

        <div class="selection-note" *ngIf="selectedCandidate as selected">
          <mat-icon>{{ selected.requiresWorkingCopy ? 'content_copy' : 'lock_open' }}</mat-icon>
          <div><strong>{{ selected.requiresWorkingCopy ? 'A private release copy will be created.' : 'Your existing workspace draft will join the release.' }}</strong><span>{{ selected.requiresWorkingCopy ? 'The staged or published source remains unchanged and retained as evidence.' : 'You can continue editing it until the complete release is submitted.' }}</span></div>
        </div>
      </div>

      <div class="notice"><mat-icon>verified_user</mat-icon><div><strong>The selected Price List becomes this Article Master's release companion.</strong><span>The package remains private until you submit the complete coordinated release.</span></div></div>

      <footer class="actions">
        <button mat-flat-button color="primary" type="button" [disabled]="!canCreate" (click)="createRelease()">
          <mat-spinner *ngIf="busy" diameter="18" />
          <mat-icon *ngIf="!busy">add_task</mat-icon>
          {{ busy ? 'Creating...' : 'Create and join release' }}
        </button>
      </footer>
    </section>
  `,
  styles: [`
    :host{display:block;margin:0 0 16px}.builder{overflow:hidden;border:1px solid color-mix(in srgb,#0891b2 36%,var(--app-border));border-radius:20px;background:linear-gradient(145deg,color-mix(in srgb,#06b6d4 5%,var(--app-surface-elevated)),var(--app-surface-elevated) 48%);box-shadow:0 14px 35px color-mix(in srgb,#0f172a 9%,transparent)}.builder__header{display:grid;grid-template-columns:52px minmax(0,1fr);gap:15px;align-items:center;padding:21px 23px 17px}.header-icon{display:grid;place-items:center;width:52px;height:52px;border-radius:16px;color:#fff;background:linear-gradient(145deg,#0891b2,#0f766e);box-shadow:0 10px 22px color-mix(in srgb,#0891b2 28%,transparent)}.header-icon mat-icon{width:27px;height:27px;font-size:27px}.eyebrow{color:#0e7490;font-size:10px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.builder h2{margin:3px 0;color:var(--app-text);font-size:21px;line-height:1.25}.builder__header p{margin:0;color:var(--app-text-muted);font-size:13px}.builder__controls{display:grid;grid-template-columns:minmax(210px,.8fr) minmax(240px,1.2fr) auto;gap:11px;align-items:center;padding:0 23px 16px}.search{display:flex;align-items:center;gap:8px;height:54px;padding:0 14px;border:1px solid var(--app-border);border-radius:8px;background:var(--app-surface)}.search:focus-within{border-color:#0891b2;box-shadow:0 0 0 2px color-mix(in srgb,#0891b2 14%,transparent)}.search mat-icon{color:var(--app-text-muted)}.search input{min-width:0;width:100%;border:0;outline:0;color:var(--app-text);background:transparent;font:inherit}.source-tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--app-border);border-radius:12px;background:var(--app-surface)}.source-tabs button{border:0;border-radius:8px;padding:8px 10px;color:var(--app-text-muted);background:transparent;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.source-tabs button.active{color:#0e7490;background:color-mix(in srgb,#06b6d4 14%,var(--app-surface))}.candidate-list{display:grid;gap:9px;max-height:410px;overflow:auto;padding:0 23px 16px}.candidate{display:grid;grid-template-columns:30px minmax(210px,1fr) minmax(300px,.9fr);gap:11px;align-items:center;width:100%;padding:15px;border:1px solid var(--app-border);border-radius:15px;text-align:left;color:var(--app-text);background:var(--app-surface);cursor:pointer;transition:border-color .16s,transform .16s,box-shadow .16s}.candidate:hover:not(:disabled){transform:translateY(-1px);border-color:color-mix(in srgb,#0891b2 45%,var(--app-border));box-shadow:0 8px 20px color-mix(in srgb,#0f172a 7%,transparent)}.candidate.selected{border-color:#0891b2;box-shadow:inset 0 0 0 1px #0891b2,0 8px 20px color-mix(in srgb,#0891b2 12%,transparent)}.candidate.ineligible{opacity:.62;cursor:not-allowed}.radio{color:#0891b2}.candidate__identity{display:grid;gap:4px;min-width:0}.candidate__title{display:flex;gap:8px;align-items:center;min-width:0}.candidate__title strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.candidate__title em{flex:none;padding:4px 7px;border-radius:999px;color:#1d4ed8;background:color-mix(in srgb,#3b82f6 12%,transparent);font-size:9px;font-style:normal;font-weight:900;text-transform:uppercase}.candidate__identity small{color:var(--app-text-muted);font-size:11px}.copy-note,.correction-note,.blocked-note{display:flex;align-items:center;gap:5px;color:#0e7490;font-size:10px;font-weight:750}.copy-note mat-icon,.correction-note mat-icon,.blocked-note mat-icon{width:15px;height:15px;font-size:15px}.correction-note{color:#b45309}.blocked-note{color:#b91c1c}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.metric{display:grid;padding:9px;border-radius:10px;background:var(--app-surface-elevated)}.metric strong{font-size:16px}.metric small{color:var(--app-text-muted);font-size:9px;text-transform:uppercase}.metric--good strong{color:#047857}.metric--bad strong{color:#b91c1c}.loading,.empty,.error{display:flex;align-items:center;justify-content:center;gap:10px;min-height:130px;margin:0 23px 16px;border:1px dashed var(--app-border);border-radius:15px;color:var(--app-text-muted)}.empty{flex-direction:column}.empty mat-icon{width:32px;height:32px;font-size:32px}.empty strong{color:var(--app-text)}.error{color:#b91c1c}.builder footer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:15px 23px;border-top:1px solid var(--app-border);background:color-mix(in srgb,#0891b2 4%,var(--app-surface))}.selection-help{display:flex;align-items:center;gap:9px;color:var(--app-text-muted);font-size:12px}.selection-help mat-icon{color:#0e7490}.selection-help strong{color:var(--app-text)}footer button{min-width:205px;height:42px;border-radius:11px;font-weight:800}footer button mat-spinner{display:inline-block;margin-right:8px}:host-context(html.theme-dark) .eyebrow,:host-context(html.theme-dark) .source-tabs button.active,:host-context(html.theme-dark) .copy-note,:host-context(html.theme-dark) .selection-help mat-icon{color:#67e8f9}:host-context(html.theme-dark) .correction-note{color:#fbbf24}:host-context(html.theme-dark) .metric--good strong{color:#6ee7b7}:host-context(html.theme-dark) .metric--bad strong,:host-context(html.theme-dark) .blocked-note,:host-context(html.theme-dark) .error{color:#fca5a5}@media(max-width:900px){.builder__controls{grid-template-columns:1fr 1fr}.source-tabs{grid-column:1/-1;justify-content:center}.candidate{grid-template-columns:30px 1fr}.metrics{grid-column:2}}@media(max-width:620px){.builder{border-radius:16px}.builder__header{grid-template-columns:44px 1fr;padding:17px 16px 14px}.header-icon{width:44px;height:44px;border-radius:13px}.builder h2{font-size:18px}.builder__controls{grid-template-columns:1fr;padding:0 16px 13px}.source-tabs{grid-column:auto;overflow:auto;justify-content:flex-start}.candidate-list{max-height:460px;padding:0 16px 13px}.candidate{grid-template-columns:24px minmax(0,1fr);padding:13px}.metrics{grid-column:1/-1}.builder footer{grid-template-columns:1fr;padding:13px 16px}.builder footer button{width:100%}.loading,.empty,.error{margin:0 16px 13px}}
    .release-setup{margin:0 0 16px;padding:20px;border:1px solid color-mix(in srgb,#2563eb 24%,var(--app-border));border-radius:18px;background:color-mix(in srgb,#eff6ff 48%,var(--app-surface));color:var(--app-text);box-shadow:0 14px 32px color-mix(in srgb,#0f172a 7%,transparent)}
    .section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.section-head h2{margin:4px 0 0;font-size:18px;font-weight:500}.release-name{display:block;width:100%;margin-top:17px}.candidate-picker{overflow:hidden;border:1px solid var(--app-border);border-radius:17px;background:var(--app-surface)}
    .picker-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px}.picker-head h3{margin:5px 0 0;font-size:15px;font-weight:500}.candidate-search{display:flex;align-items:center;gap:9px;width:min(300px,42%);height:48px;padding:0 13px;border:1px solid var(--app-border);border-radius:12px;background:var(--app-surface-elevated)}.candidate-search:focus-within{border-color:#2563eb}.candidate-search mat-icon{color:var(--app-text-muted)}.candidate-search input{min-width:0;width:100%;border:0;outline:0;color:var(--app-text);background:transparent;font:inherit}
    .source-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:5px;border-top:1px solid var(--app-border);border-bottom:1px solid var(--app-border);border-left:0;border-right:0;border-radius:0;background:color-mix(in srgb,#eff6ff 55%,var(--app-surface))}.source-tabs button{display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 8px}.source-tabs button mat-icon{width:17px;height:17px;font-size:17px}.source-tabs button b{display:grid;place-items:center;min-width:22px;height:22px;border-radius:999px;background:color-mix(in srgb,#0891b2 11%,var(--app-surface));font-size:10px}.source-tabs button.active{box-shadow:0 5px 14px color-mix(in srgb,#0f172a 8%,transparent)}
    .candidate-list{max-height:360px;padding:12px}.candidate{grid-template-columns:28px minmax(220px,1fr) minmax(120px,.35fr) auto;padding:13px;border-left:4px solid transparent;border-radius:14px}.candidate.selected{border-color:#0d9488;background:color-mix(in srgb,#ccfbf1 44%,var(--app-surface));box-shadow:none}.candidate-identity{display:grid;gap:4px;min-width:0}.candidate-title{display:flex;align-items:center;gap:8px;min-width:0}.candidate-title strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.candidate-title em{padding:4px 7px;border-radius:999px;color:#1d4ed8;background:color-mix(in srgb,#3b82f6 12%,transparent);font-size:9px;font-style:normal;font-weight:900}.candidate-identity small{color:var(--app-text-muted);font-size:10px}.candidate-impact{display:grid;text-align:center;color:#047857}.candidate-impact strong{font-size:17px}.candidate-impact small{color:var(--app-text-muted);font-size:9px}.candidate-impact.attention strong{color:#b45309}.use-draft{display:flex;align-items:center;gap:5px;padding:8px 10px;border-radius:10px;color:#1d4ed8;background:color-mix(in srgb,#dbeafe 65%,var(--app-surface));font-size:10px;font-weight:850;white-space:nowrap}.use-draft mat-icon{width:16px;height:16px;font-size:16px}
    .selection-note{display:grid;grid-template-columns:auto 1fr;gap:11px;align-items:center;padding:14px 17px;border-top:1px solid var(--app-border);background:color-mix(in srgb,#eff6ff 52%,var(--app-surface))}.selection-note>mat-icon{color:#1d4ed8}.selection-note div{display:grid;gap:3px}.selection-note strong{font-size:12px}.selection-note span{color:var(--app-text-muted);font-size:11px}.notice{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;margin-top:13px;padding:14px 16px;border-radius:14px;color:#92400e;background:color-mix(in srgb,#fef3c7 76%,var(--app-surface))}.notice div{display:grid;gap:3px}.notice strong{font-size:12px}.notice span{font-size:11px}.actions{display:flex;justify-content:flex-end;margin-top:14px}.actions button{min-width:205px;border-radius:999px;font-weight:850}
    :host-context(html.theme-dark) .release-setup{background:color-mix(in srgb,#172554 34%,var(--app-surface))}:host-context(html.theme-dark) .candidate.selected{background:color-mix(in srgb,#134e4a 42%,var(--app-surface))}:host-context(html.theme-dark) .notice{color:#fde68a;background:color-mix(in srgb,#78350f 34%,var(--app-surface))}
    @media(max-width:700px){.release-setup{padding:15px}.picker-head{align-items:stretch;flex-direction:column}.candidate-search{width:100%;box-sizing:border-box}.source-tabs{display:flex;overflow:auto;justify-content:flex-start}.source-tabs button{flex:0 0 auto}.candidate{grid-template-columns:24px minmax(0,1fr)}.candidate-impact{grid-column:2;text-align:left}.use-draft{grid-column:2;width:max-content}.actions button{width:100%}}
  `]
})
export class ArticleReleaseBuilderComponent implements OnChanges {
  @Input({ required: true }) jobId = '';
  @Input() articleCount = 0;
  @Output() readonly releaseCreated = new EventEmitter<void>();

  private readonly imports = inject(ImportService);
  private readonly snackBar = inject(MatSnackBar);
  readonly sources: CandidateSource[] = ['All', 'Workspace', 'Review', 'Published'];
  candidates: PriceListCandidateSummary[] = [];
  selectedSource: CandidateSource = 'All';
  selectedCandidateId = '';
  search = '';
  releaseName = `Annual ${new Date().getFullYear() + 1} release`;
  loading = false;
  busy = false;
  errorMessage = '';

  ngOnChanges(): void {
    if (this.jobId) this.load();
  }

  get filteredCandidates(): PriceListCandidateSummary[] {
    const term = this.search.trim().toLocaleLowerCase();
    return this.candidates.filter(candidate =>
      (this.selectedSource === 'All' || candidate.source === this.selectedSource)
      && (!term || candidate.fileName.toLocaleLowerCase().includes(term)
        || candidate.ownerDisplayName.toLocaleLowerCase().includes(term)));
  }

  get selectedCandidate(): PriceListCandidateSummary | undefined {
    return this.candidates.find(candidate => candidate.jobId === this.selectedCandidateId);
  }

  get canCreate(): boolean {
    return !this.busy && !!this.selectedCandidate?.isEligible && !!this.releaseName.trim();
  }

  sourceIcon(source: CandidateSource): string {
    return source === 'Workspace' ? 'playlist_add_check'
      : source === 'Review' ? 'rate_review'
        : source === 'Published' ? 'verified' : 'list';
  }

  sourceLabel(source: CandidateSource): string {
    return source === 'All' ? 'All versions' : source === 'Review' ? 'Under review' : source;
  }

  candidateCount(source: CandidateSource): number {
    return source === 'All' ? this.candidates.length : this.candidates.filter(candidate => candidate.source === source).length;
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.imports.getPriceListCandidates(this.jobId).subscribe({
      next: candidates => {
        this.candidates = candidates;
        if (!candidates.some(candidate => candidate.jobId === this.selectedCandidateId && candidate.isEligible)) {
          this.selectedCandidateId = candidates.find(candidate => candidate.isEligible)?.jobId ?? '';
        }
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.errorMessage = error?.error?.error ?? 'Price List candidates could not be loaded.';
      }
    });
  }

  createRelease(): void {
    if (!this.canCreate) return;
    this.busy = true;
    this.imports.createReleasePackageFromArticle(this.jobId, this.selectedCandidateId, this.releaseName.trim()).subscribe({
      next: () => {
        this.busy = false;
        this.snackBar.open('Coordinated release created.', 'Close', { duration: 4000 });
        this.releaseCreated.emit();
      },
      error: error => {
        this.busy = false;
        this.snackBar.open(error?.error?.error ?? 'The release package could not be created.', 'Close', { duration: 7000 });
      }
    });
  }
}
