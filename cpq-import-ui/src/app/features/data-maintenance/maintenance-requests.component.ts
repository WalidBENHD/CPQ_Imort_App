import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthFacade } from '../../core/auth/auth.facade';
import { ImportJob } from '../../core/models/import.models';
import { ImportService } from '../../core/services/import.service';
import { ToastService } from '../../core/services/toast.service';

type RequestSpace = 'mine' | 'approval' | 'approved' | 'history';

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
        <div><span class="eyebrow"><mat-icon>fact_check</mat-icon> Maintenance governance</span><h1>Business change sets</h1><p>Prepare, review and publish individual or grouped record changes through a workflow designed for maintenance work.</p></div>
        <a mat-flat-button routerLink="/maintenance"><mat-icon>add</mat-icon>New change set</a>
      </header>

      <nav class="spaces" aria-label="Maintenance request views">
        <button *ngFor="let space of spaces" type="button" [class.active]="activeSpace === space.key" (click)="activeSpace = space.key">
          <mat-icon>{{ space.icon }}</mat-icon><span><strong>{{ space.label }}</strong><small>{{ space.description }}</small></span><b>{{ count(space.key) }}</b>
        </button>
      </nav>

      <section class="request-centre">
        <header class="centre-head">
          <div><span>{{ activeDefinition.eyebrow }}</span><h2>{{ activeDefinition.title }}</h2></div>
          <label><mat-icon>search</mat-icon><input [(ngModel)]="search" placeholder="Search name, owner or dataset" /></label>
        </header>

        <div class="loading" *ngIf="loading"><mat-icon>sync</mat-icon>Loading maintenance requests…</div>
        <div class="empty" *ngIf="!loading && !filteredRequests.length"><mat-icon>inbox</mat-icon><strong>No maintenance requests here</strong><span>{{ activeDefinition.empty }}</span></div>

        <div class="request-list" *ngIf="!loading && filteredRequests.length">
          <article class="request-card" *ngFor="let request of filteredRequests">
            <a class="request-card__link" [routerLink]="['/maintenance/requests', request.kind, request.id]">
              <span class="request-mark"><mat-icon>{{ request.kind === 'package' ? 'account_tree' : 'edit_note' }}</mat-icon></span>
              <div class="request-main">
                <span class="request-meta">{{ request.kind === 'package' ? 'Coordinated change set' : 'Dataset change set' }} · {{ request.jobs.length }} dataset{{ request.jobs.length === 1 ? '' : 's' }}</span>
                <strong>{{ request.name }}</strong>
                <small>{{ request.owner }} · {{ request.createdAt | date:'dd MMM yyyy, HH:mm' }}</small>
                <div class="datasets"><span *ngFor="let job of request.jobs"><mat-icon>{{ datasetIcon(job.entityType) }}</mat-icon>{{ job.entityTypeLabel }}</span></div>
              </div>
              <div class="request-impact"><strong>{{ request.totalChanges }}</strong><span>record changes</span><em *ngIf="request.errors"><mat-icon>error</mat-icon>{{ request.errors }} blocking</em></div>
              <span class="request-status" [attr.data-status]="request.status"><i></i>{{ request.status }}</span>
            </a>
            <button mat-icon-button class="card-discard" *ngIf="canDiscard(request)" title="Discard change set" [attr.aria-label]="'Discard ' + request.name" (click)="discardCandidate = request"><mat-icon>delete_outline</mat-icon></button>
            <mat-icon class="chevron">chevron_right</mat-icon>
          </article>
        </div>
      </section>

      <div class="discard-backdrop" *ngIf="discardCandidate" (click)="closeDiscard()"></div>
      <section class="discard-dialog" *ngIf="discardCandidate" role="dialog" aria-modal="true" aria-labelledby="discard-title">
        <header><mat-icon>delete_forever</mat-icon><div><span>Discard change set</span><h2 id="discard-title">Permanently delete {{ discardCandidate.name }}?</h2></div></header>
        <p>This removes the private change set and all of its staged record changes. This action cannot be undone.</p>
        <footer><button mat-button [disabled]="discarding" (click)="closeDiscard()">Keep change set</button><button mat-flat-button color="warn" [disabled]="discarding" (click)="discard()"><mat-icon>delete_forever</mat-icon>{{ discarding ? 'Discarding…' : 'Discard permanently' }}</button></footer>
      </section>
    </section>
  `,
  styles: [`
    :host{display:block;color:var(--app-text)}.requests-page{display:grid;gap:18px}.requests-hero{display:flex;justify-content:space-between;align-items:end;gap:24px;padding:29px 32px;border:1px solid color-mix(in srgb,#0f8f87 24%,var(--app-border));border-radius:22px;background:linear-gradient(125deg,color-mix(in srgb,var(--app-surface) 96%,#0f766e),color-mix(in srgb,var(--app-surface) 90%,#dbeafe));box-shadow:var(--app-shadow-soft)}.requests-hero>div{display:grid;gap:6px}.eyebrow{display:flex;align-items:center;gap:6px;color:#0f8f87;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.eyebrow mat-icon{width:17px;height:17px;font-size:17px}h1{margin:0;font-size:36px;letter-spacing:-.04em}.requests-hero p{max-width:720px;margin:0;color:var(--app-text-muted);font-size:13px;line-height:1.5}.requests-hero a{color:#fff;background:#0f8f87}.spaces{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.spaces button{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;min-height:70px;padding:12px;border:1px solid var(--app-border);border-radius:12px;color:var(--app-text);background:var(--app-surface);text-align:left;cursor:pointer}.spaces button>mat-icon{color:var(--app-text-muted)}.spaces button span{display:grid;gap:2px}.spaces strong{font-size:11px}.spaces small{color:var(--app-text-muted);font-size:8px}.spaces b{display:grid;place-items:center;min-width:25px;height:25px;border-radius:7px;background:var(--app-soft-surface);font-size:10px}.spaces button.active{border-color:#5eead4;background:color-mix(in srgb,#14b8a6 7%,var(--app-surface))}.spaces button.active>mat-icon{color:#0f8f87}.spaces button.active b{color:#fff;background:#0f8f87}.request-centre{overflow:hidden;border:1px solid var(--app-border);border-radius:16px;background:var(--app-surface);box-shadow:var(--app-shadow-soft)}.centre-head{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:18px 20px;border-bottom:1px solid var(--app-border)}.centre-head>div{display:grid}.centre-head>div span{color:#0f8f87;font-size:9px;font-weight:850;text-transform:uppercase}.centre-head h2{margin:2px 0;font-size:19px}.centre-head label{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:7px;width:min(340px,45%);min-height:38px;padding:0 10px;border:1px solid var(--app-border);border-radius:8px}.centre-head label mat-icon{width:17px;height:17px;color:var(--app-text-muted);font-size:17px}.centre-head input{min-width:0;border:0;outline:0;color:var(--app-text);background:transparent;font:inherit;font-size:11px}.request-list{display:grid}.request-card{display:grid;grid-template-columns:auto minmax(0,1fr) 105px 125px auto;align-items:center;gap:14px;min-height:104px;padding:14px 20px;border-bottom:1px solid var(--app-border);color:var(--app-text);text-decoration:none}.request-card:last-child{border-bottom:0}.request-card:hover{background:var(--app-soft-surface)}.request-mark{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;color:#0f766e;background:#ccfbf1}.request-main{display:grid;gap:3px}.request-meta{color:#0f8f87;font-size:8px;font-weight:850;text-transform:uppercase}.request-main>strong{font-size:13px}.request-main>small{color:var(--app-text-muted);font-size:9px}.datasets{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px}.datasets span{display:flex;align-items:center;gap:3px;padding:3px 6px;border:1px solid var(--app-border);border-radius:5px;color:var(--app-text-muted);font-size:8px}.datasets mat-icon{width:12px;height:12px;font-size:12px}.request-impact{display:grid}.request-impact strong{font-size:18px}.request-impact span{color:var(--app-text-muted);font-size:8px;text-transform:uppercase}.request-impact em{display:flex;align-items:center;gap:3px;margin-top:3px;color:#dc2626;font-size:8px;font-style:normal}.request-impact em mat-icon{width:12px;height:12px;font-size:12px}.request-status{display:flex;align-items:center;gap:6px;width:max-content;padding:5px 8px;border-radius:999px;color:#b45309;background:#fffbeb;font-size:9px;font-weight:850}.request-status i{width:5px;height:5px;border-radius:50%;background:currentColor}.request-status[data-status="Private draft"]{color:#2563eb;background:#eff6ff}.request-status[data-status="Approved"]{color:#047857;background:#ecfdf5}.request-status[data-status="Published"]{color:#475569;background:#f1f5f9}.request-status[data-status="Returned"]{color:#b91c1c;background:#fef2f2}.chevron{color:var(--app-text-muted)}.loading,.empty{display:grid;place-items:center;gap:6px;padding:70px 20px;color:var(--app-text-muted)}.loading{display:flex}.loading mat-icon{animation:spin 1s linear infinite}.empty mat-icon{width:34px;height:34px;font-size:34px}.empty strong{color:var(--app-text)}.empty span{font-size:10px}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:900px){.spaces{grid-template-columns:1fr 1fr}.request-card{grid-template-columns:auto 1fr auto}.request-impact,.request-status{grid-column:2}.chevron{grid-column:3;grid-row:1/4}.centre-head{align-items:stretch;flex-direction:column}.centre-head label{width:auto}}@media(max-width:560px){.requests-hero{align-items:stretch;flex-direction:column;padding:21px}.requests-hero a{width:100%}.spaces{grid-template-columns:1fr}.request-card{padding:13px}.request-mark{display:none}}
  `, `
    .request-card{grid-template-columns:auto minmax(0,1fr) 105px 125px auto auto}.request-card__link{display:contents;color:inherit;text-decoration:none}.card-discard{color:#b91c1c}.card-discard:hover{background:#fef2f2}
    .discard-backdrop{position:fixed;inset:0;z-index:240;background:rgba(15,23,42,.48);backdrop-filter:blur(2px)}.discard-dialog{position:fixed;z-index:250;top:50%;left:50%;display:grid;width:min(470px,calc(100vw - 32px));gap:16px;padding:22px;transform:translate(-50%,-50%);border:1px solid var(--app-border);border-radius:10px;background:var(--app-surface);box-shadow:0 24px 70px rgba(15,23,42,.28)}.discard-dialog header{display:flex;align-items:center;gap:12px}.discard-dialog header>mat-icon{display:grid;place-items:center;width:42px;height:42px;color:#b91c1c;font-size:26px}.discard-dialog header div{display:grid;gap:2px}.discard-dialog header span{color:#b91c1c;font-size:9px;font-weight:900;text-transform:uppercase}.discard-dialog h2{margin:0;font-size:19px}.discard-dialog p{margin:0;color:var(--app-text-muted);font-size:12px;line-height:1.55}.discard-dialog footer{display:flex;justify-content:flex-end;gap:8px}
  `]
})
export class MaintenanceRequestsComponent implements OnInit {
  readonly auth = inject(AuthFacade);
  private readonly imports = inject(ImportService);
  private readonly toast = inject(ToastService);

  readonly spaces = [
    { key: 'mine' as const, label: 'My change sets', description: 'Private drafts you own', icon: 'edit_note' },
    { key: 'approval' as const, label: 'Needs approval', description: 'Waiting for a decision', icon: 'approval' },
    { key: 'approved' as const, label: 'Ready to publish', description: 'Approved change sets', icon: 'rocket_launch' },
    { key: 'history' as const, label: 'History', description: 'Published and returned', icon: 'history' }
  ];
  readonly definitions: Record<RequestSpace, { eyebrow: string; title: string; empty: string }> = {
    mine: { eyebrow: 'Private preparation', title: 'My maintenance work', empty: 'Create a change set to maintain individual or grouped records.' },
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

  get requests(): MaintenanceRequestCard[] {
    const groups = new Map<string, ImportJob[]>();
    for (const job of this.jobs.filter(item => item.fileExtension.toLowerCase() === '.hmi')) {
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

  ngOnInit(): void { this.load(); }
  count(space: RequestSpace): number { return this.requests.filter(request => this.inSpace(request, space)).length; }
  datasetIcon(type: number): string { return type === 1 ? 'inventory_2' : type === 2 ? 'payments' : type === 3 ? 'translate' : 'currency_exchange'; }
  canDiscard(request: MaintenanceRequestCard): boolean {
    return request.ownerId === this.auth.userId
      && request.status === 'Private draft'
      && this.auth.hasCapability('imports.correct_own');
  }

  closeDiscard(): void { if (!this.discarding) this.discardCandidate = null; }

  discard(): void {
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
    this.imports.getJobs(1, 100).pipe(finalize(() => this.loading = false)).subscribe({ next: result => this.jobs = result.items });
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
