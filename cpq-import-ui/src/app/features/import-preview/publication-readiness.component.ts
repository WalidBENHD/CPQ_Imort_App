import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface PublicationApprovalDraft {
  approvedAt: string;
  approvedBy: string;
  newRows: number;
  modifiedRows: number;
  missingRows: number;
}

@Component({
  selector: 'app-publication-readiness',
  standalone: true,
  imports: [CommonModule, DatePipe, MatButtonModule, MatIconModule],
  template: `
    <section class="publication-shell" aria-labelledby="publication-title">
      <div class="workflow" aria-label="Controlled publication workflow">
        <div class="workflow-step workflow-step--complete">
          <span class="step-marker"><mat-icon>check</mat-icon></span>
          <div><small>1. Review</small><strong>Impact checked</strong></div>
        </div>
        <span class="workflow-line workflow-line--complete"></span>
        <div class="workflow-step workflow-step--complete">
          <span class="step-marker"><mat-icon>check</mat-icon></span>
          <div><small>2. Approval</small><strong>Signed off</strong></div>
        </div>
        <span class="workflow-line"></span>
        <div class="workflow-step workflow-step--current">
          <span class="step-marker">3</span>
          <div><small>3. Publication</small><strong>Ready for CPQ</strong></div>
        </div>
      </div>

      <div class="publication-main">
        <div class="publication-icon"><mat-icon>rocket_launch</mat-icon></div>
        <div class="publication-copy">
          <div class="eyebrow">Publication gate</div>
          <h3 id="publication-title">Approved and ready to publish</h3>
          <p>
            {{ approval.approvedBy }} approved this impact on
            {{ approval.approvedAt | date:'dd/MM/yyyy HH:mm' }}. CPQ has not been changed yet.
          </p>
        </div>
        <div class="prototype-badge"><mat-icon>lock</mat-icon> Persisted approval</div>
      </div>

      <div class="impact-strip">
        <div><span class="impact-dot impact-dot--new"></span><strong>{{ approval.newRows }}</strong><small>to add</small></div>
        <div><span class="impact-dot impact-dot--modified"></span><strong>{{ approval.modifiedRows }}</strong><small>to update</small></div>
        <div><span class="impact-dot impact-dot--missing"></span><strong>{{ approval.missingRows }}</strong><small>to remove</small></div>
      </div>

      <div class="publication-warning">
        <mat-icon>database</mat-icon>
        <div>
          <strong>Publishing applies the approved impact to CPQ.</strong>
          <span>New and modified rows will be written, and only the approved scoped missing rows will be removed.</span>
        </div>
      </div>

      <div class="publication-actions">
        <button *ngIf="canReturnToReview" mat-button type="button" (click)="returnToReview.emit()" [disabled]="publishing">
          <mat-icon>undo</mat-icon> Return to review
        </button>
        <button *ngIf="canPublish" mat-raised-button type="button" class="publish-button" (click)="publish.emit()" [disabled]="publishing">
          <mat-icon>{{ publishing ? 'hourglass_top' : 'publish' }}</mat-icon>
          {{ publishing ? 'Publishing...' : 'Publish to CPQ' }}
        </button>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .publication-shell { border: 1px solid #c7d2fe; border-radius: 18px; overflow: hidden; background: linear-gradient(145deg,#fff 0%,#f7f8ff 100%); box-shadow: 0 12px 30px rgba(30,41,59,.08); }
    .workflow { display: grid; grid-template-columns: auto minmax(28px,1fr) auto minmax(28px,1fr) auto; align-items: center; padding: 17px 22px; border-bottom: 1px solid #e0e7ff; background: rgba(238,242,255,.7); }
    .workflow-step { display: flex; align-items: center; gap: 9px; min-width: 0; color: #64748b; }
    .workflow-step div { display: grid; gap: 2px; }
    .workflow-step small { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .workflow-step strong { color: #334155; font-size: 13px; white-space: nowrap; }
    .step-marker { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; border: 2px solid #cbd5e1; background: #fff; font-size: 12px; font-weight: 900; }
    .step-marker mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .workflow-step--complete .step-marker { color: #fff; border-color: #16a34a; background: #16a34a; }
    .workflow-step--current .step-marker { color: #fff; border-color: #4f46e5; background: #4f46e5; box-shadow: 0 0 0 5px rgba(79,70,229,.12); }
    .workflow-step--current strong { color: #312e81; }
    .workflow-line { height: 2px; margin: 0 12px; background: #cbd5e1; }
    .workflow-line--complete { background: #22c55e; }
    .publication-main { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 14px; align-items: center; padding: 22px 22px 14px; }
    .publication-icon { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg,#4f46e5,#2563eb); box-shadow: 0 8px 18px rgba(37,99,235,.25); }
    .publication-copy { min-width: 0; }
    .eyebrow { color: #4338ca; font-size: 11px; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
    h3 { margin: 3px 0 5px; color: #0f172a; font-size: 20px; }
    p { margin: 0; color: #475569; line-height: 1.5; }
    .prototype-badge { align-self: start; display:flex; align-items:center; gap:4px; padding: 5px 9px; border: 1px solid #a5b4fc; border-radius: 999px; color: #4338ca; background: #eef2ff; font-size: 11px; font-weight: 800; }
    .prototype-badge mat-icon { width:13px; height:13px; font-size:13px; }
    .impact-strip { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin: 0 22px 16px; }
    .impact-strip > div { display: grid; grid-template-columns: auto auto 1fr; align-items: baseline; gap: 7px; padding: 11px 13px; border: 1px solid #e2e8f0; border-radius: 12px; background: rgba(255,255,255,.75); }
    .impact-strip strong { color: #0f172a; font-size: 18px; }
    .impact-strip small { color: #64748b; font-weight: 700; }
    .impact-dot { width: 7px; height: 7px; align-self: center; border-radius: 50%; }
    .impact-dot--new { background: #16a34a; } .impact-dot--modified { background: #2563eb; } .impact-dot--missing { background: #f97316; }
    .publication-warning { display: flex; gap: 12px; margin: 0 22px; padding: 14px; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 12px; color: #7f1d1d; background: #fef2f2; }
    .publication-warning mat-icon { flex: 0 0 auto; color: #dc2626; }
    .publication-warning div { display: grid; gap: 3px; }
    .publication-warning span { font-size: 13px; line-height: 1.45; }
    .publication-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 18px 22px 22px; }
    .publication-actions button { border-radius: 999px; font-weight: 800; }
    .publish-button { color: #fff !important; background: linear-gradient(135deg,#4338ca,#2563eb) !important; box-shadow: 0 7px 16px rgba(37,99,235,.28); }
    :host-context(html.theme-dark) .publication-shell { border-color: rgba(129,140,248,.35); background: linear-gradient(145deg,#111a31,#0b1224); box-shadow: 0 14px 32px rgba(0,0,0,.3); }
    :host-context(html.theme-dark) .workflow { border-bottom-color: rgba(129,140,248,.22); background: rgba(30,41,75,.52); }
    :host-context(html.theme-dark) .workflow-step strong { color: #cbd5e1; }
    :host-context(html.theme-dark) .workflow-step--current strong { color: #c7d2fe; }
    :host-context(html.theme-dark) .step-marker { border-color: #475569; background: #172033; }
    :host-context(html.theme-dark) h3,:host-context(html.theme-dark) .impact-strip strong { color: #f8fafc; }
    :host-context(html.theme-dark) p { color: #aebbd0; }
    :host-context(html.theme-dark) .eyebrow { color: #a5b4fc; }
    :host-context(html.theme-dark) .prototype-badge { color: #c7d2fe; border-color: rgba(165,180,252,.5); background: rgba(67,56,202,.2); }
    :host-context(html.theme-dark) .impact-strip > div { border-color: rgba(148,163,184,.2); background: rgba(15,23,42,.72); }
    :host-context(html.theme-dark) .impact-strip small { color: #94a3b8; }
    :host-context(html.theme-dark) .publication-warning { color: #fecaca; border-color: rgba(248,113,113,.35); border-left-color: #ef4444; background: rgba(127,29,29,.2); }
    :host-context(html.theme-dark) .publication-warning mat-icon { color: #f87171; }
    @media (max-width: 700px) {
      .workflow { grid-template-columns: 1fr; gap: 10px; padding: 14px 16px; }
      .workflow-line { display: none; }
      .workflow-step { padding: 7px 0; }
      .publication-main { grid-template-columns: auto 1fr; padding: 18px 16px 12px; }
      .prototype-badge { grid-column: 2; justify-self: start; }
      .impact-strip { grid-template-columns: 1fr; margin: 0 16px 14px; gap: 7px; }
      .publication-warning { margin: 0 16px; }
      .publication-actions { flex-direction: column-reverse; padding: 16px; }
      .publication-actions button { width: 100%; }
    }
  `]
})
export class PublicationReadinessComponent {
  @Input({ required: true }) approval!: PublicationApprovalDraft;
  @Input() publishing = false;
  @Input() canPublish = false;
  @Input() canReturnToReview = false;
  @Output() publish = new EventEmitter<void>();
  @Output() returnToReview = new EventEmitter<void>();
}
