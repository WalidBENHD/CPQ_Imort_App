import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PublicationApprovalDraft } from './publication-readiness.component';

export interface PublicationConfirmDialogData {
  datasetLabel: string;
  originalFileName: string;
  approval: PublicationApprovalDraft;
}

@Component({
  selector: 'app-publication-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-shell">
      <div class="dialog-icon"><mat-icon>publish</mat-icon></div>
      <div class="dialog-copy">
        <div class="eyebrow">Final publication gate</div>
        <h2>Publish this update to CPQ?</h2>
        <p><strong>{{ data.originalFileName }}</strong> has been approved. This action now applies its impact to {{ data.datasetLabel }}.</p>
      </div>
      <div class="impact">
        <div><strong>{{ data.approval.newRows }}</strong><span>rows added</span></div>
        <div><strong>{{ data.approval.modifiedRows }}</strong><span>rows updated</span></div>
        <div class="danger"><strong>{{ data.approval.missingRows }}</strong><span>scoped rows removed</span></div>
      </div>
      <div class="warning"><mat-icon>warning_amber</mat-icon><span>Publication changes CPQ and establishes this upload as the new active baseline.</span></div>
      <div class="actions">
        <button mat-button mat-dialog-close>Not yet</button>
        <button mat-raised-button class="confirm" [mat-dialog-close]="true"><mat-icon>publish</mat-icon> Confirm publication</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { max-width: 620px; padding: 26px; color: #0f172a; background: #fff; }
    .dialog-icon { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 14px; color: #fff; background: linear-gradient(135deg,#4338ca,#2563eb); }
    .dialog-copy { margin: 16px 0; } .eyebrow { color:#4338ca; font-size:11px; font-weight:900; letter-spacing:.09em; text-transform:uppercase; }
    h2 { margin: 4px 0 8px; font-size: 24px; } p { margin: 0; color:#475569; line-height:1.55; }
    .impact { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:18px 0; }
    .impact div { display:grid; gap:3px; padding:13px; border:1px solid #dbe4f0; border-radius:12px; background:#f8fafc; }
    .impact strong { font-size:22px; } .impact span { color:#64748b; font-size:12px; }
    .impact .danger { border-color:#fecaca; background:#fef2f2; }
    .warning { display:flex; gap:9px; padding:12px; border-radius:10px; color:#7f1d1d; background:#fef2f2; font-weight:700; line-height:1.4; }
    .warning mat-icon { color:#dc2626; flex:0 0 auto; }
    .actions { display:flex; justify-content:flex-end; gap:8px; margin-top:22px; }
    .actions button { border-radius:999px; font-weight:800; } .confirm { color:#fff !important; background:#4338ca !important; }
    :host-context(html.theme-dark) .dialog-shell { color:#f8fafc; background:#0f172a; }
    :host-context(html.theme-dark) p { color:#cbd5e1; } :host-context(html.theme-dark) .eyebrow { color:#a5b4fc; }
    :host-context(html.theme-dark) .impact div { border-color:rgba(148,163,184,.24); background:#111c32; }
    :host-context(html.theme-dark) .impact span { color:#94a3b8; }
    :host-context(html.theme-dark) .impact .danger,:host-context(html.theme-dark) .warning { color:#fecaca; border-color:rgba(248,113,113,.35); background:rgba(127,29,29,.22); }
    @media (max-width: 560px) { .dialog-shell { padding:20px; } .impact { grid-template-columns:1fr; } .actions { flex-direction:column-reverse; } .actions button { width:100%; } }
  `]
})
export class PublicationConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: PublicationConfirmDialogData) {}
}
