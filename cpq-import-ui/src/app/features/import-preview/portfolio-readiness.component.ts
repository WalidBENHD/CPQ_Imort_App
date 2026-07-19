import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PortfolioReadiness } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';

@Component({
  selector: 'app-portfolio-readiness',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <section class="readiness" [class.readiness--blocked]="readiness?.requiresCoordinatedRelease" [class.readiness--ready]="readiness?.isConsistent">
      <div class="loading" *ngIf="loading">
        <mat-spinner diameter="24" />
        <div><strong>Checking future CPQ consistency</strong><span>Comparing Article Master and Price List coverage...</span></div>
      </div>

      <ng-container *ngIf="!loading && readiness as result">
        <header>
          <span class="status-icon"><mat-icon>{{ result.isConsistent ? 'verified' : 'account_tree' }}</mat-icon></span>
          <div>
            <span class="eyebrow">Pilot projected-state check</span>
            <h2>{{ result.isConsistent ? 'Safe to submit independently' : 'Coordinated release required' }}</h2>
            <p *ngIf="result.isConsistent">The future Article Master and Price List remain aligned after this update.</p>
            <p *ngIf="!result.isConsistent">Publishing this file alone would leave the active CPQ portfolio inconsistent.</p>
          </div>
          <span class="result-pill">{{ result.masterArticleCount }} articles · {{ result.pricedArticleCount }} priced</span>
        </header>

        <div class="issue-grid" *ngIf="!result.isConsistent">
          <article [class.issue--clear]="result.articlesWithoutPricesCount === 0">
            <span><mat-icon>price_check</mat-icon></span>
            <div><strong>{{ result.articlesWithoutPricesCount }}</strong><small>Articles without a price</small></div>
          </article>
          <article [class.issue--clear]="result.pricesWithoutArticlesCount === 0">
            <span><mat-icon>link_off</mat-icon></span>
            <div><strong>{{ result.pricesWithoutArticlesCount }}</strong><small>Prices referencing missing articles</small></div>
          </article>
        </div>

        <div class="examples" *ngIf="!result.isConsistent && (result.articlesWithoutPrices.length || result.pricesWithoutArticles.length)">
          <div *ngIf="result.articlesWithoutPrices.length">
            <strong>Need prices</strong>
            <span *ngFor="let article of result.articlesWithoutPrices.slice(0, 6)">{{ article }}</span>
            <em *ngIf="result.articlesWithoutPricesCount > 6">+{{ result.articlesWithoutPricesCount - 6 }} more</em>
          </div>
          <div *ngIf="result.pricesWithoutArticles.length">
            <strong>Would become orphan prices</strong>
            <span *ngFor="let article of result.pricesWithoutArticles.slice(0, 6)">{{ article }}</span>
            <em *ngIf="result.pricesWithoutArticlesCount > 6">+{{ result.pricesWithoutArticlesCount - 6 }} more</em>
          </div>
        </div>

        <footer *ngIf="result.requiresCoordinatedRelease">
          <mat-icon>info</mat-icon>
          <p *ngIf="isArticleMaster"><strong>Do not submit this Article Master alone.</strong> Choose a matching Price List below and create the coordinated release here.</p>
          <p *ngIf="!isArticleMaster"><strong>Individual submission is locked.</strong> Use the validation and release section below to pair this Price List with the matching Article Master.</p>
          <button mat-stroked-button color="primary" (click)="createReleaseRequested.emit()">
            <mat-icon>inventory_2</mat-icon>
            {{ isArticleMaster ? 'Choose Price List' : 'Create coordinated release' }}
          </button>
        </footer>
      </ng-container>
    </section>
  `,
  styles: [`
    :host{display:block;margin:0 0 16px}.readiness{overflow:hidden;border:1px solid var(--app-border);border-radius:20px;background:var(--app-surface-elevated);box-shadow:0 12px 30px color-mix(in srgb,#0f172a 8%,transparent)}.loading{display:flex;align-items:center;gap:13px;min-height:82px;padding:18px 22px}.loading div{display:grid;gap:3px}.loading span{color:var(--app-text-muted);font-size:12px}.readiness header{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:14px;align-items:center;padding:19px 21px}.status-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:15px}.status-icon mat-icon{width:25px;height:25px;font-size:25px}.eyebrow{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.readiness h2{margin:3px 0 3px;color:var(--app-text);font-size:19px}.readiness header p{margin:0;color:var(--app-text-muted);font-size:12px;line-height:1.45}.result-pill{padding:7px 10px;border-radius:999px;font-size:10px;font-weight:850;white-space:nowrap}.readiness--ready{border-color:color-mix(in srgb,#16a34a 32%,var(--app-border));background:linear-gradient(120deg,color-mix(in srgb,#22c55e 7%,var(--app-surface-elevated)),var(--app-surface-elevated) 70%)}.readiness--ready .status-icon,.readiness--ready .result-pill{color:#15803d;background:color-mix(in srgb,#22c55e 13%,transparent)}.readiness--ready .eyebrow{color:#15803d}.readiness--blocked{border-color:color-mix(in srgb,#dc2626 35%,var(--app-border));background:linear-gradient(120deg,color-mix(in srgb,#ef4444 6%,var(--app-surface-elevated)),var(--app-surface-elevated) 72%)}.readiness--blocked .status-icon,.readiness--blocked .result-pill{color:#b91c1c;background:color-mix(in srgb,#ef4444 12%,transparent)}.readiness--blocked .eyebrow{color:#b91c1c}.issue-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:0 21px 14px}.issue-grid article{display:grid;grid-template-columns:38px 1fr;gap:10px;align-items:center;padding:12px;border:1px solid color-mix(in srgb,#ef4444 25%,var(--app-border));border-radius:13px;background:var(--app-surface)}.issue-grid article>span{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;color:#b91c1c;background:color-mix(in srgb,#ef4444 11%,transparent)}.issue-grid mat-icon{width:20px;height:20px;font-size:20px}.issue-grid article div{display:grid}.issue-grid strong{font-size:20px}.issue-grid small{color:var(--app-text-muted);font-size:11px}.issue-grid .issue--clear{border-color:color-mix(in srgb,#22c55e 24%,var(--app-border))}.issue-grid .issue--clear>span{color:#15803d;background:color-mix(in srgb,#22c55e 11%,transparent)}.examples{display:grid;gap:10px;padding:0 21px 15px}.examples>div{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.examples strong{min-width:100%;color:var(--app-text-muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em}.examples span,.examples em{padding:4px 8px;border:1px solid var(--app-border);border-radius:999px;background:var(--app-surface);font-size:10px;font-style:normal;font-weight:750}.examples em{color:var(--app-text-muted)}footer{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:10px;align-items:center;padding:14px 21px;border-top:1px solid color-mix(in srgb,#ef4444 22%,var(--app-border));background:color-mix(in srgb,#ef4444 5%,var(--app-surface))}footer>mat-icon{color:#b91c1c}footer p{margin:0;color:var(--app-text-muted);font-size:12px;line-height:1.5}footer p strong{color:var(--app-text)}footer button{border-radius:11px;font-weight:800}:host-context(html.theme-dark) .readiness--ready .status-icon,:host-context(html.theme-dark) .readiness--ready .result-pill,:host-context(html.theme-dark) .readiness--ready .eyebrow{color:#86efac}:host-context(html.theme-dark) .readiness--blocked .status-icon,:host-context(html.theme-dark) .readiness--blocked .result-pill,:host-context(html.theme-dark) .readiness--blocked .eyebrow,:host-context(html.theme-dark) footer>mat-icon{color:#fca5a5}@media(max-width:650px){.readiness{border-radius:16px}.readiness header{grid-template-columns:42px minmax(0,1fr);padding:16px}.status-icon{width:42px;height:42px;border-radius:13px}.result-pill{grid-column:1/-1;width:max-content}.issue-grid{grid-template-columns:1fr;padding:0 16px 12px}.examples{padding:0 16px 13px}footer{grid-template-columns:20px 1fr;padding:13px 16px}footer button{grid-column:1/-1;width:100%}}
  `]
})
export class PortfolioReadinessComponent implements OnChanges {
  @Input({ required: true }) jobId = '';
  @Input() refreshKey = '';
  @Input() isArticleMaster = false;
  @Output() readonly readinessChanged = new EventEmitter<PortfolioReadiness | null>();
  @Output() readonly createReleaseRequested = new EventEmitter<void>();
  private readonly imports = inject(ImportService);
  readiness: PortfolioReadiness | null = null;
  loading = false;

  ngOnChanges(): void {
    if (!this.jobId) return;
    this.loading = true;
    this.readiness = null;
    this.readinessChanged.emit(null);
    this.imports.getPortfolioReadiness(this.jobId).subscribe({
      next: readiness => {
        this.readiness = readiness;
        this.loading = false;
        this.readinessChanged.emit(readiness);
      },
      error: () => {
        this.loading = false;
        this.readinessChanged.emit(null);
      }
    });
  }
}
