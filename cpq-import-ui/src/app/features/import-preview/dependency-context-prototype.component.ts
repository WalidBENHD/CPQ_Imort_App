import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthFacade } from '../../core/auth/auth.facade';
import { ArticleMasterCandidateSummary, DependencyContext, DependencyImpact, ImportJob, ReleasePackage } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';

type PanelView = 'summary' | 'revalidation' | 'release';
type CandidateSource = 'All' | ArticleMasterCandidateSummary['source'];

@Component({
  selector: 'app-dependency-context-prototype',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSnackBarModule],
  template: `
    <section class="dependency-shell" aria-labelledby="dependency-title">
      <div class="panel-loading" *ngIf="loading"><span></span> Loading validation context...</div>
      <div class="panel-error" *ngIf="!loading && errorMessage"><mat-icon>error_outline</mat-icon><span>{{ errorMessage }}</span><button mat-button (click)="load()">Retry</button></div>

      <ng-container *ngIf="!loading && context as ctx">
        <header class="dependency-head">
          <div class="head-identity">
            <span class="hero-icon"><mat-icon>account_tree</mat-icon></span>
            <div>
              <div class="eyebrow">Validation context</div>
              <h2 id="dependency-title">{{ ctx.isDependentDataset ? 'This draft keeps the Article Master it was checked against' : (ctx.releasePackage?.name || 'Coordinated release') }}</h2>
              <p>{{ ctx.isDependentDataset ? 'Your results remain stable until you explicitly preview and accept another master version.' : 'This upload is governed as part of the complete release package shown below.' }}</p>
            </div>
          </div>
          <div class="health"><i></i><div><small>{{ ctx.isDependentDataset ? 'Draft protection' : 'Release governance' }}</small><strong>{{ ctx.isDependentDataset ? anchorStateLabel : releaseStatusLabel(ctx.releasePackage?.status || 0) }}</strong></div></div>
        </header>

        <div class="no-anchor" *ngIf="ctx.isDependentDataset && !ctx.currentAnchor">
          <mat-icon>link_off</mat-icon>
          <div><strong>No Article Master is available</strong><span>Publish an Article Master first, or prepare an error-free master candidate and coordinate both drafts in a release.</span></div>
        </div>

        <div class="context-map" *ngIf="ctx.isDependentDataset && ctx.currentAnchor as anchor">
          <article class="context-card selected">
            <div class="card-top"><span class="card-icon"><mat-icon>{{ ctx.anchorKind === 3 ? 'inventory_2' : 'lock' }}</mat-icon></span><span class="pill teal">{{ ctx.anchorKind === 3 ? 'Release candidate' : 'Pinned' }}</span></div>
            <small>Current validation anchor</small>
            <h3>{{ anchor.fileName }}</h3>
            <p>{{ anchor.versionLabel }} · {{ anchor.articleCount }} articles</p>
            <footer><mat-icon>verified</mat-icon><span>{{ ctx.currentImpact.validReferences }} of {{ ctx.currentImpact.totalRows }} references match</span></footer>
          </article>

          <div class="connector"><span></span><mat-icon>arrow_forward</mat-icon><span></span><small>Explicit comparison</small></div>

          <article class="context-card latest" [class.same]="!ctx.hasNewerMaster" *ngIf="ctx.latestActiveMaster as latest">
            <div class="card-top"><span class="card-icon"><mat-icon>update</mat-icon></span><span class="pill blue">{{ ctx.hasNewerMaster ? 'Newer active version' : 'Current active' }}</span></div>
            <small>Latest published master</small>
            <h3>{{ latest.fileName }}</h3>
            <p>{{ latest.versionLabel }} · {{ latest.articleCount }} articles</p>
            <footer [class.attention]="ctx.latestImpact?.missingReferences">
              <mat-icon>{{ ctx.latestImpact?.missingReferences ? 'difference' : 'task_alt' }}</mat-icon>
              <span>{{ ctx.latestImpact ? ctx.latestImpact.missingReferences + ' references need review' : 'Already used by this draft' }}</span>
            </footer>
          </article>
        </div>

        <div class="stability" *ngIf="ctx.isDependentDataset" [class.release]="ctx.anchorKind === 3">
          <mat-icon>{{ ctx.anchorKind === 3 ? 'deployed_code' : 'shield' }}</mat-icon>
          <div>
            <strong>{{ stabilityTitle }}</strong>
            <span>{{ stabilityCopy }}</span>
          </div>
          <button *ngIf="ctx.hasNewerMaster && ctx.latestActiveMaster" mat-stroked-button [disabled]="busy" (click)="previewLatest()"><mat-icon>manage_search</mat-icon> Preview latest impact</button>
        </div>

        <section class="decision" *ngIf="view === 'revalidation' && previewImpact as impact">
          <div class="section-head"><div><span class="eyebrow">Revalidation preview</span><h3>Impact of {{ ctx.latestActiveMaster?.fileName }}</h3></div><button mat-icon-button (click)="view='summary'"><mat-icon>close</mat-icon></button></div>
          <div class="impact-grid">
            <div class="impact green"><small>Still valid</small><strong>{{ impact.validReferences }}</strong><span>Rows keep a valid reference</span></div>
            <div class="impact red"><small>Need correction</small><strong>{{ impact.missingReferences }}</strong><span>Referenced articles are missing</span></div>
            <div class="impact cyan"><small>Without {{ datasetName }}</small><strong>{{ impact.articlesWithoutDependentData }}</strong><span>Master articles have no matching row</span></div>
          </div>
          <details *ngIf="impact.missingArticleNumbers.length"><summary>Show affected articles</summary><div class="article-list"><span *ngFor="let article of impact.missingArticleNumbers">{{ article }}</span></div></details>
          <div class="notice"><mat-icon>info</mat-icon><div><strong>This preview has not changed your draft.</strong><span>Applying it will revalidate every active row and may create blocking errors.</span></div></div>
          <div class="actions"><button mat-button (click)="view='summary'">Keep pinned version</button><button mat-flat-button color="primary" [disabled]="busy" (click)="applyLatest()"><mat-icon>sync</mat-icon> {{ busy ? 'Applying...' : 'Use latest master' }}</button></div>
        </section>

        <div class="release-entry" *ngIf="ctx.isDependentDataset && !ctx.releasePackage && view !== 'release'">
          <span class="release-icon"><mat-icon>deployed_code</mat-icon></span>
          <div><span class="eyebrow">Preparing related datasets?</span><strong>Coordinate Master, Prices and Descriptions in one annual release</strong><p>Validate dependent drafts against a candidate master, then review and publish them in dependency order.</p></div>
          <button mat-stroked-button (click)="view='release'">Create release package <mat-icon>arrow_forward</mat-icon></button>
        </div>

        <section class="release-setup" *ngIf="ctx.isDependentDataset && view === 'release' && !ctx.releasePackage">
          <div class="section-head"><div><span class="eyebrow">New coordinated release</span><h3>Choose the Article Master candidate for this draft</h3></div><button mat-icon-button (click)="view='summary'"><mat-icon>close</mat-icon></button></div>
          <mat-form-field class="release-name" appearance="outline"><mat-label>Release name</mat-label><input matInput [(ngModel)]="releaseName" maxlength="180"></mat-form-field>

          <div class="candidate-picker" *ngIf="ctx.candidateMasters.length">
            <div class="picker-head">
              <div><span class="eyebrow">Article Master source</span><h4>Select the version this release should use</h4></div>
              <label class="candidate-search"><mat-icon>search</mat-icon><input [(ngModel)]="candidateSearch" placeholder="Search file or owner" aria-label="Search Article Master versions"></label>
            </div>
            <div class="source-tabs" role="tablist" aria-label="Article Master source">
              <button *ngFor="let source of candidateSources" type="button" role="tab" [class.active]="candidateSource === source" [attr.aria-selected]="candidateSource === source" (click)="candidateSource = source">
                <mat-icon>{{ sourceIcon(source) }}</mat-icon><span>{{ sourceLabel(source) }}</span><b>{{ candidateCount(source) }}</b>
              </button>
            </div>
            <div class="candidate-list" role="listbox" aria-label="Available Article Master versions">
              <button *ngFor="let master of filteredCandidates" type="button" class="candidate-card" role="option"
                [disabled]="!master.isEligible" [class.selected]="selectedCandidateId === master.jobId" [attr.aria-selected]="selectedCandidateId === master.jobId"
                (click)="selectedCandidateId = master.jobId">
                <span class="candidate-radio"><mat-icon>{{ selectedCandidateId === master.jobId ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon></span>
                <span class="candidate-main">
                  <span class="candidate-title"><strong>{{ master.fileName }}</strong><em *ngIf="master.isActive">Active baseline</em></span>
                  <small>{{ master.versionLabel }} · {{ master.articleCount }} articles · {{ master.ownerDisplayName }}</small>
                  <span class="candidate-warning" *ngIf="!master.isEligible"><mat-icon>block</mat-icon>{{ master.ineligibleReason }}</span>
                </span>
                <span class="compatibility" [class.attention]="master.missingReferences">
                  <strong>{{ master.validReferences }}/{{ totalRows }}</strong>
                  <small>{{ master.missingReferences ? master.missingReferences + ' missing references' : 'All references match' }}</small>
                </span>
                <span class="reuse-mode"><mat-icon>{{ master.requiresWorkingCopy ? 'content_copy' : 'edit_note' }}</mat-icon>{{ master.requiresWorkingCopy ? 'Safe copy' : 'Use draft' }}</span>
              </button>
              <div class="picker-empty" *ngIf="!filteredCandidates.length"><mat-icon>search_off</mat-icon><span>No versions match this source and search.</span></div>
            </div>
            <div class="selection-note" *ngIf="selectedCandidate as selected">
              <mat-icon>{{ selected.requiresWorkingCopy ? 'content_copy' : 'lock_open' }}</mat-icon>
              <div><strong>{{ selected.requiresWorkingCopy ? 'A private release copy will be created.' : 'Your existing workspace draft will join the release.' }}</strong><span>{{ selected.requiresWorkingCopy ? 'The staged or published source remains unchanged and retained as evidence.' : 'You can continue editing it until the complete release is submitted.' }}</span></div>
            </div>
          </div>
          <div class="empty-candidates" *ngIf="!ctx.candidateMasters.length"><mat-icon>upload_file</mat-icon><span>No Article Master version is available in your workspace, review queue, or publication history.</span></div>
          <div class="notice"><mat-icon>verified_user</mat-icon><div><strong>The selected version becomes this draft's validation anchor.</strong><span>The package remains private until you submit the complete coordinated release.</span></div></div>
          <div class="actions"><button mat-button (click)="view='summary'">Cancel</button><button mat-flat-button color="primary" [disabled]="busy || !selectedCandidateId || !releaseName.trim()" (click)="createRelease()"><mat-icon>add_task</mat-icon> {{ busy ? 'Creating...' : 'Create and join release' }}</button></div>
        </section>

        <section class="release-board" *ngIf="ctx.releasePackage as release">
          <div class="release-head">
            <div class="release-title"><span><mat-icon>inventory_2</mat-icon></span><div><small>Coordinated release</small><h3>{{ release.name }}</h3></div></div>
            <span class="package-status" [class]="'package-status status-' + release.status">{{ releaseStatusLabel(release.status) }}</span>
          </div>
          <div class="release-sequence">
            <ng-container *ngFor="let item of release.items; let index = index">
              <article class="release-item" [class.current]="item.jobId === jobId">
                <span class="sequence">{{ index + 1 }}</span><span class="item-icon"><mat-icon>{{ datasetIcon(item.entityType) }}</mat-icon></span>
                <div><small>{{ item.isValidationAnchor ? 'Validation anchor' : (item.jobId === jobId ? 'Current draft' : item.datasetName) }}</small><strong>{{ item.fileName }}</strong><span>{{ item.totalRows }} rows · {{ item.errorRows ? item.errorRows + ' errors' : 'Ready' }}</span></div>
                <span class="item-state" [class.error]="item.errorRows"><mat-icon>{{ item.errorRows ? 'error' : 'check_circle' }}</mat-icon>{{ item.errorRows ? 'Attention' : 'Ready' }}</span>
              </article>
              <div class="sequence-link" *ngIf="index < release.items.length - 1"><mat-icon>south</mat-icon><span>{{ index === 0 ? 'validates' : 'then' }}</span></div>
            </ng-container>
          </div>
          <div class="publication-rule"><mat-icon>verified_user</mat-icon><div><strong>Governed as one release</strong><span>Approval evidence covers every listed upload. Publication runs Master, Descriptions, then Prices.</span></div></div>
          <div class="portfolio-check" [class.ready]="readiness.isConsistent" *ngIf="ctx.projectedReadiness as readiness">
            <mat-icon>{{ readiness.isConsistent ? 'task_alt' : 'rule' }}</mat-icon>
            <div class="portfolio-copy">
              <strong>{{ readiness.isConsistent ? 'The projected CPQ catalogue is complete' : 'Complete the Article and Price pair before review' }}</strong>
              <span *ngIf="readiness.isConsistent">Every article has a price and every price belongs to an article in this release.</span>
              <span *ngIf="!readiness.isConsistent">This release protects the active catalogue from unpriced articles and prices for removed articles.</span>
            </div>
            <div class="portfolio-metrics">
              <span [class.problem]="readiness.articlesWithoutPrices.length"><b>{{ readiness.articlesWithoutPrices.length }}</b> without price</span>
              <span [class.problem]="readiness.pricesWithoutArticles.length"><b>{{ readiness.pricesWithoutArticles.length }}</b> missing article</span>
            </div>
            <details *ngIf="!readiness.isConsistent && (readiness.articlesWithoutPrices.length || readiness.pricesWithoutArticles.length)">
              <summary>See examples to correct</summary>
              <div class="readiness-examples" *ngIf="readiness.articlesWithoutPrices.length"><small>Articles without prices</small><span *ngFor="let article of readiness.articlesWithoutPrices">{{ article }}</span></div>
              <div class="readiness-examples" *ngIf="readiness.pricesWithoutArticles.length"><small>Prices without articles</small><span *ngFor="let article of readiness.pricesWithoutArticles">{{ article }}</span></div>
            </details>
          </div>
          <div class="release-rejection" *ngIf="release.status === 6">
            <mat-icon>cancel</mat-icon>
            <div>
              <strong>Rejected by {{ release.rejectedByDisplayName }}</strong>
              <span *ngIf="release.rejectedAt">{{ release.rejectedAt | date:'dd/MM/yyyy HH:mm' }}</span>
              <p>{{ release.rejectionReason }}</p>
            </div>
          </div>
          <div class="failure" *ngIf="release.failureReason"><mat-icon>error_outline</mat-icon><span>{{ release.failureReason }}</span></div>
          <div class="actions package-actions">
            <span class="owner">Owned by {{ release.createdByDisplayName }}</span>
            <button *ngIf="canDissolve(release)" mat-stroked-button class="dissolve-package" [disabled]="busy" (click)="dissolvePackage(release)"><mat-icon>link_off</mat-icon> Dissolve release</button>
            <button *ngIf="canSubmit(release)" mat-flat-button color="primary" [disabled]="busy || packageHasErrors(release) || !packageIsPortfolioReady" (click)="submitPackage(release)"><mat-icon>send</mat-icon> {{ packageIsPortfolioReady ? 'Submit complete release' : 'Complete release pair' }}</button>
            <button *ngIf="canApprove(release)" mat-flat-button color="primary" [disabled]="busy" (click)="approvePackage(release)"><mat-icon>verified</mat-icon> Approve release</button>
            <button *ngIf="canReject(release)" mat-stroked-button color="warn" class="reject-release" [disabled]="busy" (click)="showReleaseRejectPanel = true"><mat-icon>close</mat-icon> Reject release</button>
            <button *ngIf="canPublish(release)" mat-flat-button color="primary" [disabled]="busy" (click)="publishPackage(release)"><mat-icon>rocket_launch</mat-icon> {{ release.status === 5 ? 'Resume publication' : 'Publish complete release' }}</button>
          </div>
          <div class="release-reject-panel" *ngIf="showReleaseRejectPanel && canReject(release)">
            <div class="release-reject-field">
              <div><strong>Rejection reason</strong><span>Tell the release owner what must change before resubmitting.</span></div>
              <textarea [(ngModel)]="releaseRejectionReason" rows="3" maxlength="2000" placeholder="Enter reason..."></textarea>
            </div>
            <div class="release-reject-actions">
              <button mat-flat-button color="warn" [disabled]="busy || !releaseRejectionReason.trim()" (click)="rejectPackage(release)">{{ busy ? 'Rejecting...' : 'Confirm Rejection' }}</button>
              <button mat-button [disabled]="busy" (click)="cancelReleaseRejection()">Cancel</button>
            </div>
          </div>
        </section>
      </ng-container>
    </section>
  `,
  styles: [`
    :host-context(html.theme-dark) .no-anchor{color:#fde68a;background:rgba(146,64,14,.2)!important}
    :host{display:block;margin:18px 0}.dependency-shell{overflow:hidden;border:1px solid color-mix(in srgb,#0f766e 24%,var(--app-border));border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,#ecfeff 72%,var(--app-surface)),var(--app-surface) 54%);box-shadow:0 16px 38px rgba(15,23,42,.07);color:var(--app-text)}h2,h3,p{margin:0}.dependency-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:24px 26px 20px}.head-identity{display:flex;gap:15px;min-width:0}.hero-icon{display:grid;place-items:center;flex:0 0 48px;height:48px;border-radius:15px;color:#fff;background:linear-gradient(135deg,#0f766e,#0891b2);box-shadow:0 10px 24px rgba(8,145,178,.24)}.eyebrow{color:#0f766e;font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.dependency-head h2{margin-top:4px;font-size:21px;line-height:1.25}.dependency-head p{max-width:760px;margin-top:7px;color:var(--app-text-muted);font-size:14px;line-height:1.5}.health{display:flex;align-items:center;gap:10px;flex:0 0 auto;padding:10px 13px;border:1px solid color-mix(in srgb,#14b8a6 30%,var(--app-border));border-radius:13px;background:color-mix(in srgb,#f0fdfa 72%,var(--app-surface))}.health i{width:10px;height:10px;border-radius:50%;background:#14b8a6;box-shadow:0 0 0 5px rgba(20,184,166,.13),0 0 14px rgba(20,184,166,.5)}.health div{display:grid}.health small,.context-card>small,.release-title small,.release-item small{color:var(--app-text-muted);font-size:10px;font-weight:800;text-transform:uppercase}.health strong{font-size:12px}.context-map{display:grid;grid-template-columns:minmax(0,1fr) 130px minmax(0,1fr);align-items:center;gap:13px;padding:0 26px}.context-card{min-width:0;padding:17px;border:1px solid var(--app-border);border-radius:17px;background:color-mix(in srgb,var(--app-surface) 92%,transparent)}.context-card.selected{border-color:#0d9488;box-shadow:inset 0 0 0 1px rgba(13,148,136,.15)}.context-card.same{opacity:.8}.card-top,.context-card footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.card-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;color:#0f766e;background:color-mix(in srgb,#ccfbf1 72%,var(--app-surface))}.context-card>small{display:block;margin-top:13px}.context-card h3{overflow:hidden;margin-top:4px;font-size:16px;text-overflow:ellipsis;white-space:nowrap}.context-card p{margin-top:3px;color:var(--app-text-muted);font-size:12px}.context-card footer{justify-content:flex-start;margin-top:14px;padding-top:12px;border-top:1px solid var(--app-border);color:#047857;font-size:12px;font-weight:800}.context-card footer.attention{color:#b45309}.context-card footer mat-icon{width:18px;height:18px;font-size:18px}.pill,.package-status,.item-state{display:inline-flex;align-items:center;width:max-content;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap}.pill.teal{color:#0f766e;background:#ccfbf1}.pill.blue{color:#1d4ed8;background:#dbeafe}.connector{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;color:#0d9488}.connector span{height:1px;background:color-mix(in srgb,#0d9488 45%,transparent)}.connector mat-icon{margin:0 5px}.connector small{grid-column:1/-1;margin-top:3px;color:var(--app-text-muted);text-align:center;font-size:10px}.stability,.notice,.publication-rule,.no-anchor{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;margin:16px 26px 22px;padding:13px 15px;border:1px solid color-mix(in srgb,#0d9488 22%,var(--app-border));border-radius:14px;background:color-mix(in srgb,#f0fdfa 75%,var(--app-surface))}.stability>mat-icon,.publication-rule>mat-icon{color:#0f766e}.stability div,.notice div,.publication-rule div,.no-anchor div{display:grid;gap:2px}.stability strong,.notice strong,.publication-rule strong,.no-anchor strong{font-size:13px}.stability span,.notice span,.publication-rule span,.no-anchor span{color:var(--app-text-muted);font-size:12px}.stability button{border-radius:999px;font-weight:800}.no-anchor{grid-template-columns:auto 1fr;border-color:#f59e0b;background:color-mix(in srgb,#fffbeb 70%,var(--app-surface))}.decision,.release-setup,.release-board{margin:0 26px 22px;padding:20px;border:1px solid color-mix(in srgb,#2563eb 24%,var(--app-border));border-radius:18px;background:color-mix(in srgb,#eff6ff 48%,var(--app-surface));animation:reveal .24s ease-out}.section-head,.release-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.section-head h3{margin-top:4px;font-size:17px}.impact-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:17px}.impact{display:grid;gap:4px;padding:14px;border:1px solid var(--app-border);border-top-width:3px;border-radius:13px;background:var(--app-surface)}.impact.green{border-top-color:#10b981}.impact.red{border-top-color:#ef4444}.impact.cyan{border-top-color:#0ea5e9}.impact small{color:var(--app-text-muted);font-size:10px;font-weight:900;text-transform:uppercase}.impact strong{font-size:25px}.impact span{color:var(--app-text-muted);font-size:11px}.notice{grid-template-columns:auto 1fr;margin:12px 0 0;color:#92400e;border:0;background:color-mix(in srgb,#fef3c7 76%,var(--app-surface))}details{margin-top:12px;padding:10px 12px;border:1px solid var(--app-border);border-radius:12px}summary{cursor:pointer;font-size:12px;font-weight:800}.article-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.article-list span{padding:4px 7px;border-radius:8px;color:#b91c1c;background:color-mix(in srgb,#fee2e2 75%,var(--app-surface));font-size:10px;font-weight:800}.actions{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:16px}.actions button,.release-entry button{border-radius:999px;font-weight:800}.release-entry{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;padding:17px 26px;border-top:1px solid var(--app-border);background:color-mix(in srgb,#f8fafc 65%,var(--app-surface))}.release-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;color:#4338ca;background:color-mix(in srgb,#e0e7ff 72%,var(--app-surface))}.release-entry div{display:grid;gap:2px}.release-entry strong{font-size:13px}.release-entry p{color:var(--app-text-muted);font-size:12px}.setup-grid{display:grid;grid-template-columns:1fr 1.35fr;gap:12px;margin-top:18px}.empty-candidates,.failure{display:flex;align-items:center;gap:9px;margin-top:10px;padding:12px;border:1px solid #f59e0b;border-radius:12px;color:#92400e;background:color-mix(in srgb,#fffbeb 72%,var(--app-surface));font-size:12px}.release-title{display:flex;align-items:center;gap:11px}.release-title>span{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;color:#fff;background:linear-gradient(135deg,#4338ca,#2563eb)}.release-title h3{margin-top:3px;font-size:17px}.package-status{color:#1d4ed8;background:#dbeafe}.package-status.status-2{color:#047857;background:#d1fae5}.package-status.status-3{color:#6d28d9;background:#ede9fe}.package-status.status-4{color:#047857;background:#d1fae5}.package-status.status-5{color:#b91c1c;background:#fee2e2}.release-sequence{display:grid;margin-top:18px}.release-item{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px;border:1px solid var(--app-border);border-radius:14px;background:var(--app-surface)}.release-item.current{border-color:color-mix(in srgb,#2563eb 42%,var(--app-border));box-shadow:inset 4px 0 #2563eb}.sequence{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;color:var(--app-text-muted);background:var(--app-soft-surface);font-size:11px;font-weight:900}.item-icon{display:grid;place-items:center;width:37px;height:37px;border-radius:11px;color:#2563eb;background:color-mix(in srgb,#dbeafe 70%,var(--app-surface))}.release-item>div{display:grid;gap:1px;min-width:0}.release-item strong{overflow:hidden;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.release-item>div>span{color:var(--app-text-muted);font-size:10px}.item-state{gap:4px;color:#047857;background:#d1fae5}.item-state.error{color:#b91c1c;background:#fee2e2}.item-state mat-icon{width:14px;height:14px;font-size:14px}.sequence-link{display:flex;align-items:center;gap:6px;height:28px;padding-left:69px;color:var(--app-text-muted);font-size:10px;font-weight:800;text-transform:uppercase}.sequence-link mat-icon{width:17px;height:17px;font-size:17px}.publication-rule{grid-template-columns:auto 1fr;margin:16px 0 0}.failure{border-color:#ef4444;color:#b91c1c}.package-actions{justify-content:flex-end}.owner{margin-right:auto;color:var(--app-text-muted);font-size:11px}.panel-loading,.panel-error{display:flex;align-items:center;justify-content:center;gap:9px;min-height:110px;color:var(--app-text-muted);font-size:13px}.panel-loading span{width:18px;height:18px;border:2px solid var(--app-border);border-top-color:#0d9488;border-radius:50%;animation:spin .8s linear infinite}.panel-error{color:#b91c1c}.panel-error button{margin-left:8px}@keyframes spin{to{transform:rotate(360deg)}}@keyframes reveal{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
    .release-name{width:min(520px,100%);margin-top:18px}.dissolve-package,.reject-release{color:#b91c1c;border-color:color-mix(in srgb,#ef4444 45%,var(--app-border))}.package-status.status-6{color:#b91c1c;background:#fee2e2}.release-rejection{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;margin-top:14px;padding:13px 15px;border:1px solid #fecaca;border-radius:14px;color:#b91c1c;background:color-mix(in srgb,#fef2f2 78%,var(--app-surface))}.release-rejection div{display:grid;gap:2px}.release-rejection strong{font-size:12px}.release-rejection span{font-size:10px}.release-rejection p{margin-top:5px;color:var(--app-text);font-size:12px;line-height:1.45}.release-reject-panel{display:grid;gap:14px;margin-top:16px;padding-top:15px;border-top:1px solid var(--app-border)}.release-reject-field{display:grid;gap:10px}.release-reject-field>div{display:grid;gap:4px}.release-reject-field strong{font-size:13px}.release-reject-field span{color:var(--app-text-muted);font-size:12px}.release-reject-field textarea{box-sizing:border-box;width:100%;min-height:104px;padding:14px 15px;resize:vertical;border:1px solid var(--app-border);border-radius:14px;outline:0;color:var(--app-text);background:linear-gradient(180deg,var(--app-surface),var(--app-soft-surface));font:inherit;line-height:1.5}.release-reject-field textarea:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.16)}.release-reject-actions{display:flex;align-items:center;gap:8px}.release-reject-actions button{border-radius:999px;font-weight:800}.candidate-picker{overflow:hidden;border:1px solid var(--app-border);border-radius:16px;background:var(--app-surface)}.picker-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 17px}.picker-head h4{margin:3px 0 0;font-size:15px}.candidate-search{display:flex;align-items:center;gap:7px;width:min(300px,42%);padding:9px 12px;border:1px solid var(--app-border);border-radius:11px;background:var(--app-soft-surface)}.candidate-search mat-icon{width:19px;height:19px;color:var(--app-text-muted);font-size:19px}.candidate-search input{min-width:0;width:100%;border:0;outline:0;color:var(--app-text);background:transparent;font:inherit;font-size:12px}.candidate-search input::placeholder{color:var(--app-text-muted)}.source-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:5px;border-block:1px solid var(--app-border);background:var(--app-soft-surface)}.source-tabs button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:40px;border:0;border-radius:9px;color:var(--app-text-muted);background:transparent;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.source-tabs button.active{color:#0f766e;background:var(--app-surface);box-shadow:0 2px 9px rgba(15,23,42,.08)}.source-tabs mat-icon{width:17px;height:17px;font-size:17px}.source-tabs b{display:grid;place-items:center;min-width:21px;height:21px;padding:0 5px;border-radius:999px;background:color-mix(in srgb,#0d9488 12%,var(--app-soft-surface));font-size:10px}.candidate-list{display:grid;gap:8px;max-height:350px;padding:12px;overflow:auto}.candidate-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:12px;width:100%;padding:13px;border:1px solid var(--app-border);border-radius:13px;color:var(--app-text);background:var(--app-surface);font:inherit;text-align:left;cursor:pointer;transition:border-color .16s,background .16s,transform .16s}.candidate-card:hover:not(:disabled){border-color:#0d9488;transform:translateY(-1px)}.candidate-card.selected{border-color:#0d9488;background:color-mix(in srgb,#ccfbf1 40%,var(--app-surface));box-shadow:inset 3px 0 #0d9488}.candidate-card:disabled{cursor:not-allowed;opacity:.62}.candidate-radio{color:#0d9488}.candidate-radio mat-icon{display:block}.candidate-main{display:grid;gap:4px;min-width:0}.candidate-title{display:flex;align-items:center;gap:8px;min-width:0}.candidate-title strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.candidate-title em{flex:0 0 auto;padding:3px 7px;border-radius:999px;color:#047857;background:#d1fae5;font-size:9px;font-style:normal;font-weight:900;text-transform:uppercase}.candidate-main small,.compatibility small{color:var(--app-text-muted);font-size:10px}.candidate-warning{display:flex;align-items:center;gap:4px;color:#b91c1c;font-size:10px;font-weight:700}.candidate-warning mat-icon{width:14px;height:14px;font-size:14px}.compatibility{display:grid;min-width:112px;padding-left:13px;border-left:1px solid var(--app-border);color:#047857;text-align:right}.compatibility strong{font-size:14px}.compatibility.attention{color:#b45309}.reuse-mode{display:flex;align-items:center;gap:5px;min-width:82px;padding:6px 8px;border-radius:8px;color:#1d4ed8;background:color-mix(in srgb,#dbeafe 60%,var(--app-surface));font-size:10px;font-weight:900}.reuse-mode mat-icon{width:15px;height:15px;font-size:15px}.picker-empty{display:flex;align-items:center;justify-content:center;gap:8px;min-height:90px;color:var(--app-text-muted);font-size:12px}.selection-note{display:flex;align-items:center;gap:10px;padding:12px 15px;border-top:1px solid var(--app-border);color:#1e40af;background:color-mix(in srgb,#eff6ff 72%,var(--app-surface))}.selection-note>mat-icon{flex:0 0 auto}.selection-note div{display:grid;gap:2px}.selection-note strong{font-size:11px}.selection-note span{color:var(--app-text-muted);font-size:10px}
    .portfolio-check{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:13px;margin-top:14px;padding:15px;border:1px solid #fca5a5;border-radius:15px;color:#991b1b;background:color-mix(in srgb,#fef2f2 78%,var(--app-surface))}.portfolio-check.ready{border-color:#6ee7b7;color:#047857;background:color-mix(in srgb,#ecfdf5 76%,var(--app-surface))}.portfolio-check>mat-icon{align-self:start}.portfolio-copy{display:grid;gap:3px}.portfolio-copy strong{font-size:13px}.portfolio-copy span{color:var(--app-text-muted);font-size:11px;line-height:1.45}.portfolio-metrics{display:flex;gap:7px}.portfolio-metrics span{display:grid;min-width:92px;padding:8px 10px;border:1px solid color-mix(in srgb,#10b981 35%,var(--app-border));border-radius:11px;color:#047857;background:var(--app-surface);font-size:9px;font-weight:800;text-align:center}.portfolio-metrics span.problem{border-color:#fca5a5;color:#b91c1c}.portfolio-metrics b{font-size:17px}.portfolio-check details{grid-column:2/-1;width:100%;box-sizing:border-box}.readiness-examples{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-top:8px}.readiness-examples small{width:100%;color:var(--app-text-muted);font-weight:800}.readiness-examples span{padding:4px 7px;border-radius:7px;color:#b91c1c;background:color-mix(in srgb,#fee2e2 70%,var(--app-surface));font-size:9px;font-weight:800}
    :host-context(html.theme-dark) .dependency-shell{border-color:rgba(45,212,191,.27);background:linear-gradient(145deg,rgba(13,148,136,.11),var(--app-surface) 48%);box-shadow:0 18px 40px rgba(0,0,0,.28)}:host-context(html.theme-dark) .eyebrow{color:#5eead4}:host-context(html.theme-dark) .health,:host-context(html.theme-dark) .stability,:host-context(html.theme-dark) .publication-rule{background:rgba(13,148,136,.1)}:host-context(html.theme-dark) .context-card,:host-context(html.theme-dark) .impact,:host-context(html.theme-dark) .release-item{background:rgba(15,23,42,.76)}:host-context(html.theme-dark) .card-icon{color:#5eead4;background:rgba(13,148,136,.16)}:host-context(html.theme-dark) .pill.teal{color:#5eead4;background:rgba(13,148,136,.18)}:host-context(html.theme-dark) .pill.blue{color:#93c5fd;background:rgba(37,99,235,.2)}:host-context(html.theme-dark) .decision,:host-context(html.theme-dark) .release-setup,:host-context(html.theme-dark) .release-board{background:rgba(30,58,138,.11)}:host-context(html.theme-dark) .notice{color:#fde68a;background:rgba(146,64,14,.19)}:host-context(html.theme-dark) .release-entry{background:rgba(15,23,42,.38)}:host-context(html.theme-dark) .item-state{color:#6ee7b7;background:rgba(5,150,105,.2)}:host-context(html.theme-dark) .item-state.error{color:#fca5a5;background:rgba(185,28,28,.2)}:host-context(html.theme-dark) .source-tabs button.active{color:#5eead4;background:rgba(15,23,42,.9)}:host-context(html.theme-dark) .candidate-card.selected{border-color:#2dd4bf;background:rgba(13,148,136,.12)}:host-context(html.theme-dark) .candidate-title em{color:#6ee7b7;background:rgba(5,150,105,.2)}:host-context(html.theme-dark) .reuse-mode{color:#93c5fd;background:rgba(37,99,235,.18)}:host-context(html.theme-dark) .selection-note{color:#93c5fd;background:rgba(37,99,235,.13)}:host-context(html.theme-dark) .portfolio-check{color:#fca5a5;background:rgba(127,29,29,.16)}:host-context(html.theme-dark) .portfolio-check.ready{color:#6ee7b7;background:rgba(6,78,59,.18)}:host-context(html.theme-dark) .portfolio-metrics span{color:#6ee7b7;background:rgba(15,23,42,.74)}:host-context(html.theme-dark) .portfolio-metrics span.problem{color:#fca5a5}:host-context(html.theme-dark) .readiness-examples span{color:#fecaca;background:rgba(127,29,29,.24)}
    @media(max-width:900px){.dependency-head{flex-direction:column}.health{align-self:stretch}.context-map{grid-template-columns:1fr}.connector{padding:2px 24px;transform:rotate(90deg)}.connector small{display:none}.impact-grid{grid-template-columns:1fr}.release-entry{grid-template-columns:auto 1fr}.release-entry button{grid-column:1/-1;width:100%}.setup-grid{grid-template-columns:1fr}}
    @media(max-width:600px){:host{margin:12px 0}.dependency-shell{border-radius:17px}.dependency-head{padding:18px 16px 16px}.head-identity{gap:11px}.hero-icon{flex-basis:42px;height:42px}.dependency-head h2{font-size:17px}.dependency-head p{font-size:12px}.context-map{padding:0 16px}.connector{display:flex;justify-content:center;padding:10px 0;transform:none}.connector span,.connector small{display:none}.connector mat-icon{margin:0;transform:rotate(90deg)}.stability{grid-template-columns:auto 1fr;margin:14px 16px 17px}.stability button{grid-column:1/-1;width:100%}.decision,.release-setup,.release-board{margin:0 10px 16px;padding:15px}.picker-head{align-items:stretch;flex-direction:column}.candidate-search{width:auto}.source-tabs{grid-template-columns:repeat(2,1fr)}.candidate-card{grid-template-columns:auto minmax(0,1fr)}.compatibility,.reuse-mode{grid-column:2;text-align:left}.compatibility{padding:6px 0 0;border-top:1px solid var(--app-border);border-left:0}.reuse-mode{width:max-content}.actions{flex-direction:column-reverse}.actions button{width:100%}.release-entry{grid-template-columns:1fr;padding:15px 16px}.release-icon{display:none}.release-head{align-items:center}.release-title h3{font-size:14px}.release-item{grid-template-columns:auto auto minmax(0,1fr)}.item-state{grid-column:2/-1}.sequence-link{padding-left:53px}.package-actions .owner{width:100%;margin:0;text-align:center}.release-reject-actions{flex-direction:column}.release-reject-actions button{width:100%}}
    @media(max-width:600px){.portfolio-check{grid-template-columns:auto minmax(0,1fr);padding:13px}.portfolio-metrics,.portfolio-check details{grid-column:1/-1}.portfolio-metrics{display:grid;grid-template-columns:1fr 1fr}.portfolio-metrics span{min-width:0}.readiness-examples{max-height:120px;overflow:auto}}
  `]
})
export class DependencyContextPrototypeComponent implements OnChanges {
  @Input({ required: true }) jobId = '';
  @Input() datasetName = 'Basis Price';
  @Input() fileName = '';
  @Input() totalRows = 0;
  @Input() errorCount = 0;
  @Output() readonly jobChanged = new EventEmitter<ImportJob>();

  private readonly imports = inject(ImportService);
  readonly auth = inject(AuthFacade);
  private readonly snackBar = inject(MatSnackBar);

  context: DependencyContext | null = null;
  previewImpact: DependencyImpact | null = null;
  view: PanelView = 'summary';
  loading = false;
  busy = false;
  errorMessage = '';
  selectedCandidateId = '';
  candidateSearch = '';
  candidateSource: CandidateSource = 'All';
  showReleaseRejectPanel = false;
  releaseRejectionReason = '';
  readonly candidateSources: CandidateSource[] = ['All', 'Workspace', 'Review', 'Published'];
  releaseName = `Annual ${new Date().getFullYear() + 1} release`;

  ngOnChanges(): void { if (this.jobId) this.load(); }

  get anchorStateLabel(): string {
    if (this.context?.anchorKind === 3) return 'Coordinated release';
    if (this.context?.anchorKind === 2) return 'Explicit version';
    return this.context?.currentAnchor ? 'Context locked' : 'Anchor required';
  }

  get stabilityTitle(): string {
    if (this.context?.anchorKind === 3) return 'This draft is coordinated with the package Article Master.';
    return this.context?.hasNewerMaster ? 'A newer master is available, but your draft has not changed.' : 'This draft uses the latest published Article Master.';
  }

  get stabilityCopy(): string {
    if (this.context?.anchorKind === 3) return 'Cross-dataset checks use the candidate master until the full release is published.';
    return this.context?.hasNewerMaster ? 'Preview the impact before choosing whether to revalidate.' : 'Future master publications will not silently change these results.';
  }

  get filteredCandidates(): ArticleMasterCandidateSummary[] {
    const search = this.candidateSearch.trim().toLocaleLowerCase();
    return (this.context?.candidateMasters ?? []).filter(candidate =>
      (this.candidateSource === 'All' || candidate.source === this.candidateSource)
      && (!search
        || candidate.fileName.toLocaleLowerCase().includes(search)
        || candidate.ownerDisplayName.toLocaleLowerCase().includes(search)));
  }

  get selectedCandidate(): ArticleMasterCandidateSummary | null {
    return this.context?.candidateMasters.find(candidate => candidate.jobId === this.selectedCandidateId) ?? null;
  }

  candidateCount(source: CandidateSource): number {
    const candidates = this.context?.candidateMasters ?? [];
    return source === 'All' ? candidates.length : candidates.filter(candidate => candidate.source === source).length;
  }

  sourceLabel(source: CandidateSource): string {
    return source === 'All' ? 'All versions' : source === 'Review' ? 'Under review' : source;
  }

  sourceIcon(source: CandidateSource): string {
    return source === 'Workspace' ? 'edit_note' : source === 'Review' ? 'rate_review' : source === 'Published' ? 'verified' : 'view_list';
  }

  load(): void {
    this.loading = true; this.errorMessage = '';
    this.imports.getDependencyContext(this.jobId).subscribe({
      next: context => {
        this.context = context;
        this.loading = false;
        if (!context.candidateMasters.some(candidate => candidate.jobId === this.selectedCandidateId && candidate.isEligible)) {
          this.selectedCandidateId = context.candidateMasters.find(candidate => candidate.isEligible)?.jobId ?? '';
        }
      },
      error: error => { this.loading = false; this.errorMessage = error?.error?.error ?? 'Validation context could not be loaded.'; }
    });
  }

  previewLatest(): void {
    const masterId = this.context?.latestActiveMaster?.jobId; if (!masterId) return;
    this.busy = true;
    this.imports.previewDependencyAnchor(this.jobId, masterId).subscribe({
      next: impact => { this.previewImpact = impact; this.view = 'revalidation'; this.busy = false; },
      error: error => this.fail(error, 'The revalidation preview could not be calculated.')
    });
  }

  applyLatest(): void {
    const masterId = this.context?.latestActiveMaster?.jobId; if (!masterId) return;
    this.busy = true;
    this.imports.applyDependencyAnchor(this.jobId, masterId).subscribe({
      next: job => { this.busy = false; this.view = 'summary'; this.jobChanged.emit(job); this.load(); this.snackBar.open('Draft revalidated against the selected Article Master.', 'Close', { duration: 4500 }); },
      error: error => this.fail(error, 'The validation anchor could not be changed.')
    });
  }

  createRelease(): void {
    if (!this.selectedCandidateId || !this.releaseName.trim()) return;
    this.busy = true;
    this.imports.createReleasePackage(this.jobId, this.selectedCandidateId, this.releaseName.trim()).subscribe({
      next: () => { this.busy = false; this.view = 'summary'; this.refreshParent(); this.load(); this.snackBar.open('Coordinated release created.', 'Close', { duration: 4500 }); },
      error: error => this.fail(error, 'The release package could not be created.')
    });
  }

  submitPackage(release: ReleasePackage): void { this.runPackageAction(this.imports.submitReleasePackage(release.id), 'Release submitted for approval.'); }
  approvePackage(release: ReleasePackage): void { this.runPackageAction(this.imports.approveReleasePackage(release.id), 'Release approved with immutable evidence.'); }
  publishPackage(release: ReleasePackage): void { this.runPackageAction(this.imports.publishReleasePackage(release.id), 'Release published in dependency order.'); }

  rejectPackage(release: ReleasePackage): void {
    const reason = this.releaseRejectionReason.trim();
    if (!this.canReject(release) || !reason) return;
    this.busy = true;
    this.imports.rejectReleasePackage(release.id, reason).subscribe({
      next: () => {
        this.busy = false;
        this.cancelReleaseRejection();
        this.refreshParent();
        this.load();
        this.snackBar.open('Release rejected. The owner has been notified with your reason.', 'Close', { duration: 5000 });
      },
      error: error => this.fail(error, 'The release could not be rejected.')
    });
  }

  cancelReleaseRejection(): void {
    this.showReleaseRejectPanel = false;
    this.releaseRejectionReason = '';
  }

  canSubmit(release: ReleasePackage): boolean { return release.status === 0 && release.createdBy === this.auth.userId && this.auth.hasCapability('imports.submit'); }
  canDissolve(release: ReleasePackage): boolean { return release.status === 0 && release.createdBy === this.auth.userId && this.auth.hasCapability('imports.correct_own'); }
  canApprove(release: ReleasePackage): boolean { return release.status === 1 && release.createdBy !== this.auth.userId && this.auth.hasCapability('imports.approve'); }
  canReject(release: ReleasePackage): boolean { return release.status === 1 && release.createdBy !== this.auth.userId && this.auth.hasCapability('imports.reject'); }
  canPublish(release: ReleasePackage): boolean { return (release.status === 2 || release.status === 5) && this.auth.hasCapability('imports.publish'); }
  packageHasErrors(release: ReleasePackage): boolean { return release.items.some(item => item.errorRows > 0); }
  get packageIsPortfolioReady(): boolean { return this.context?.projectedReadiness?.isConsistent === true; }
  releaseStatusLabel(status: number): string { return ['Draft','In review','Approved','Publishing','Published','Action required','Rejected'][status] ?? 'Unknown'; }
  datasetIcon(type: string): string { return type === 'Article' ? 'category' : type === 'Description' ? 'description' : type === 'PriceList' ? 'payments' : 'dataset'; }

  dissolvePackage(release: ReleasePackage): void {
    if (!this.canDissolve(release)) return;
    const confirmed = window.confirm(
      `Dissolve "${release.name}"? Every upload will return to its owner's private workspace and can be reused or submitted independently.`
    );
    if (!confirmed) return;
    this.busy = true;
    this.imports.dissolveReleasePackage(release.id).subscribe({
      next: () => {
        this.busy = false;
        this.view = 'summary';
        this.refreshParent();
        this.load();
        this.snackBar.open('Release dissolved. All uploads are available in the private workspace again.', 'Close', { duration: 5500 });
      },
      error: error => this.fail(error, 'The release could not be dissolved.')
    });
  }

  private runPackageAction(request: ReturnType<ImportService['submitReleasePackage']>, successMessage: string): void {
    this.busy = true;
    request.subscribe({ next: () => { this.busy = false; this.refreshParent(); this.load(); this.snackBar.open(successMessage, 'Close', { duration: 5000 }); }, error: error => this.fail(error, 'The release action could not be completed.') });
  }

  private refreshParent(): void { this.imports.getJob(this.jobId).subscribe(job => this.jobChanged.emit(job)); }
  private fail(error: any, fallback: string): void { this.busy = false; this.snackBar.open(error?.error?.error ?? fallback, 'Close', { duration: 7000 }); }
}
