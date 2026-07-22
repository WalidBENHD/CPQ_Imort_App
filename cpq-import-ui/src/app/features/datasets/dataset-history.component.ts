import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DATASET_CATALOG, DatasetDefinition, EntityType, ImportJob } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';

@Component({
  selector: 'app-dataset-history',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule],
  template: `
    <section class="history-page" *ngIf="dataset">
      <header class="history-hero">
        <a mat-button routerLink="/datasets"><mat-icon>arrow_back</mat-icon> Back to datasets</a>
        <div class="hero-copy">
          <span class="dataset-icon"><mat-icon>{{ dataset.icon }}</mat-icon></span>
          <div>
            <span class="eyebrow">Governed publication history</span>
            <h1>{{ dataset.name }}</h1>
            <p>The active list and every previous publication are retained here as business evidence.</p>
          </div>
        </div>
      </header>

      <section class="history-panel">
        <div class="panel-heading">
          <div><span>Version register</span><h2>Published versions</h2></div>
          <strong>{{ publications.length }} {{ publications.length === 1 ? 'publication' : 'publications' }}</strong>
        </div>

        <div class="loading-state" *ngIf="loading"><mat-icon>progress_activity</mat-icon> Reading publication history...</div>
        <div class="empty-state empty-state--error" *ngIf="!loading && loadError">
          <mat-icon>cloud_off</mat-icon><strong>Publication history is unavailable</strong>
          <span>Please try again when the data service is available.</span>
        </div>
        <div class="empty-state" *ngIf="!loading && !loadError && !publications.length">
          <mat-icon>inventory_2</mat-icon><strong>No published version yet</strong>
          <span>The first approved publication will establish this dataset.</span>
        </div>

        <div class="version-list" *ngIf="!loading && publications.length">
          <button class="version-row" type="button" *ngFor="let publication of publications" (click)="open(publication)">
            <span class="version-led" [class.version-led--active]="publication.isActiveBaseline"></span>
            <span class="version-main">
              <span class="version-title">
                <strong>{{ publication.originalFileName }}</strong>
                <em *ngIf="publication.isActiveBaseline">Active version</em>
              </span>
              <small><mat-icon>{{ sourceIcon(publication) }}</mat-icon>{{ source(publication) }}</small>
            </span>
            <span class="version-data"><strong>{{ publication.committedRows }}</strong><small>Rows</small></span>
            <span class="version-data"><strong>{{ publication.committedBy || 'Unknown user' }}</strong><small>Published by</small></span>
            <span class="version-data"><strong>{{ publication.committedAt | date:'dd MMM yyyy, HH:mm' }}</strong><small>Published</small></span>
            <mat-icon class="open-icon">arrow_forward</mat-icon>
          </button>
        </div>
      </section>
    </section>
  `,
  styles: [`
    :host{display:block;color:var(--app-text)}.history-page{display:grid;gap:18px}.history-hero{display:grid;gap:18px;padding:24px 28px;border:1px solid color-mix(in srgb,#0f8f87 26%,var(--app-border));border-radius:24px;background:linear-gradient(125deg,color-mix(in srgb,var(--app-surface) 96%,#0f766e),color-mix(in srgb,var(--app-surface) 88%,#dbeafe));box-shadow:var(--app-shadow-soft)}.history-hero>a{justify-self:start;color:var(--app-text-muted)}.hero-copy{display:flex;align-items:center;gap:16px}.dataset-icon{display:grid;place-items:center;width:58px;height:58px;color:#0f8f87;border-radius:18px;background:color-mix(in srgb,#14b8a6 14%,transparent)}.dataset-icon mat-icon{width:30px;height:30px;font-size:30px}.eyebrow{color:#0f8f87;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.09em}h1{margin:3px 0;color:var(--app-text);font-size:clamp(31px,4vw,46px);letter-spacing:-.045em}.hero-copy p{max-width:720px;margin:0;color:var(--app-text-muted);font-size:12px;line-height:1.5}.history-panel{overflow:hidden;border:1px solid var(--app-border);border-radius:20px;background:var(--app-surface-elevated);box-shadow:var(--app-shadow-soft)}.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:21px 24px;border-bottom:1px solid var(--app-border)}.panel-heading>div>span{color:#0f8f87;font-size:8px;font-weight:900;text-transform:uppercase}.panel-heading h2{margin:3px 0 0;font-size:22px;letter-spacing:-.03em}.panel-heading>strong{padding:6px 10px;color:var(--app-text-muted);border-radius:999px;background:var(--app-soft-surface);font-size:9px;text-transform:uppercase}.version-list{display:grid;padding:8px 16px 16px}.version-row{display:grid;grid-template-columns:10px minmax(220px,1.4fr) 80px minmax(130px,.7fr) minmax(145px,.8fr) 24px;align-items:center;gap:14px;width:100%;min-height:76px;padding:12px 10px;color:var(--app-text);border:0;border-bottom:1px solid var(--app-border);background:transparent;text-align:left;cursor:pointer}.version-row:last-child{border-bottom:0}.version-row:hover{border-radius:12px;background:color-mix(in srgb,#0f8f87 5%,var(--app-surface))}.version-led{width:8px;height:8px;border-radius:50%;background:#94a3b8}.version-led--active{background:#22c55e;box-shadow:0 0 0 5px color-mix(in srgb,#22c55e 14%,transparent)}.version-main{display:grid;min-width:0;gap:5px}.version-title{display:flex;align-items:center;min-width:0;gap:8px}.version-title strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.version-title em{padding:4px 7px;color:#047857;border-radius:999px;background:color-mix(in srgb,#22c55e 12%,transparent);font-size:8px;font-style:normal;font-weight:900;text-transform:uppercase}.version-main small{display:flex;align-items:center;gap:4px;color:var(--app-text-muted);font-size:9px}.version-main mat-icon{width:13px;height:13px;font-size:13px}.version-data{display:grid;gap:2px}.version-data strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.version-data small{color:var(--app-text-muted);font-size:8px;text-transform:uppercase}.open-icon{color:#0f8f87}.loading-state,.empty-state{display:grid;place-items:center;gap:7px;padding:70px 20px;color:var(--app-text-muted)}.loading-state{display:flex}.loading-state mat-icon{animation:spin 1s linear infinite}.empty-state mat-icon{width:36px;height:36px;font-size:36px}.empty-state strong{color:var(--app-text)}.empty-state span{font-size:10px}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:820px){.version-row{grid-template-columns:10px minmax(0,1fr) 24px}.version-data{grid-column:2}.open-icon{grid-column:3;grid-row:1/5}.hero-copy{align-items:flex-start}}@media(max-width:520px){.history-hero{padding:18px}.dataset-icon{width:44px;height:44px;border-radius:14px}.dataset-icon mat-icon{width:23px;height:23px;font-size:23px}.hero-copy{gap:11px}h1{font-size:30px}.panel-heading{padding:17px}.version-list{padding:6px 8px 11px}.version-row{gap:9px;padding:12px 7px}.version-title{align-items:flex-start;flex-direction:column;gap:4px}.version-title strong{white-space:normal;overflow-wrap:anywhere}}
  `]
})
export class DatasetHistoryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly importService = inject(ImportService);

  dataset?: DatasetDefinition;
  publications: ImportJob[] = [];
  loading = true;
  loadError = false;

  ngOnInit(): void {
    const entityType = this.route.snapshot.paramMap.get('entityType') as EntityType | null;
    this.dataset = DATASET_CATALOG.find(item => item.key === entityType);
    if (!this.dataset) {
      this.router.navigate(['/datasets']);
      return;
    }

    this.importService.getJobs(1, 100, null, 'Committed', this.dataset.key).subscribe({
      next: result => {
        this.publications = [...result.items].sort((left, right) =>
          new Date(right.committedAt ?? right.createdAt).getTime() - new Date(left.committedAt ?? left.createdAt).getTime());
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      }
    });
  }

  source(publication: ImportJob): string {
    return publication.fileExtension.toLowerCase() === '.hmi' ? 'Maintenance publication' : 'Annual submission';
  }

  sourceIcon(publication: ImportJob): string {
    return publication.fileExtension.toLowerCase() === '.hmi' ? 'edit_note' : 'upload_file';
  }

  open(publication: ImportJob): void {
    this.router.navigate(['/import', publication.id]);
  }
}
