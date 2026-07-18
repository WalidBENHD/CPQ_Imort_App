import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReleasePackage } from '../../core/models/import.models';

@Component({
  selector: 'app-release-withdraw-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <section class="withdraw-dialog">
      <header>
        <span class="dialog-mark"><mat-icon>move_to_inbox</mat-icon></span>
        <div>
          <span class="eyebrow">Coordinated release</span>
          <h2 mat-dialog-title>Withdraw the entire release?</h2>
          <p><strong>{{ data.name }}</strong> is reviewed as one package and cannot be withdrawn file by file.</p>
        </div>
      </header>

      <mat-dialog-content>
        <div class="impact-note">
          <mat-icon>info</mat-icon>
          <p>All {{ data.items.length }} datasets will leave the review queue and return to your private workspace together. The release link is preserved so you can edit and resubmit it.</p>
        </div>

        <div class="dataset-list" aria-label="Datasets that will be withdrawn">
          <div class="dataset" *ngFor="let item of data.items">
            <span><mat-icon>{{ item.isValidationAnchor ? 'inventory_2' : 'request_quote' }}</mat-icon></span>
            <div>
              <strong>{{ item.fileName }}</strong>
              <small>{{ item.datasetName }} · {{ item.totalRows }} rows</small>
            </div>
            <mat-icon class="return-icon">keyboard_return</mat-icon>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="dialogRef.close(false)">Keep in review</button>
        <button mat-flat-button color="primary" (click)="dialogRef.close(true)">
          <mat-icon>undo</mat-icon>
          Withdraw all
        </button>
      </mat-dialog-actions>
    </section>
  `,
  styles: [`
    :host { display: block; color: var(--app-text); }
    .withdraw-dialog { width: min(610px, calc(100vw - 32px)); background: var(--app-surface-elevated); }
    header { display: grid; grid-template-columns: 54px minmax(0, 1fr); gap: 15px; padding: 25px 25px 20px; border-bottom: 1px solid var(--app-border); background: linear-gradient(120deg, color-mix(in srgb, #0f766e 10%, transparent), transparent 74%); }
    .dialog-mark { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 17px; color: white; background: #0f766e; box-shadow: 0 11px 26px color-mix(in srgb, #0f766e 30%, transparent); }
    .dialog-mark mat-icon { width: 28px; height: 28px; font-size: 28px; }
    .eyebrow { color: #0f766e; font-size: 11px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    h2[mat-dialog-title] { margin: 4px 0 5px; padding: 0; color: var(--app-text); font-size: 24px; line-height: 1.2; }
    header p { margin: 0; color: var(--app-text-muted); font-size: 13px; line-height: 1.5; }
    header p strong { color: var(--app-text); }
    mat-dialog-content { display: grid; gap: 16px; padding: 20px 25px 8px; }
    .impact-note { display: flex; gap: 10px; padding: 13px 14px; border: 1px solid color-mix(in srgb, #0f766e 28%, var(--app-border)); border-radius: 14px; background: color-mix(in srgb, #0f766e 7%, var(--app-surface)); }
    .impact-note mat-icon { flex: none; width: 20px; height: 20px; color: #0f766e; font-size: 20px; }
    .impact-note p { margin: 0; color: var(--app-text-muted); font-size: 13px; line-height: 1.5; }
    .dataset-list { display: grid; gap: 8px; }
    .dataset { display: grid; grid-template-columns: 40px minmax(0, 1fr) 24px; gap: 11px; align-items: center; padding: 11px 12px; border: 1px solid var(--app-border); border-radius: 13px; background: var(--app-surface); }
    .dataset > span { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; color: #0f766e; background: color-mix(in srgb, #0f766e 11%, transparent); }
    .dataset > span mat-icon { width: 21px; height: 21px; font-size: 21px; }
    .dataset div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
    .dataset strong { overflow: hidden; color: var(--app-text); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .dataset small { color: var(--app-text-muted); font-size: 11px; }
    .return-icon { color: #0f766e; }
    mat-dialog-actions { gap: 8px; padding: 12px 25px 23px; }
    mat-dialog-actions button { min-height: 42px; border-radius: 12px; font-weight: 800; }
    @media (max-width: 520px) {
      .withdraw-dialog { width: calc(100vw - 20px); }
      header { grid-template-columns: 44px minmax(0, 1fr); padding: 20px 18px 17px; }
      .dialog-mark { width: 44px; height: 44px; border-radius: 14px; }
      h2[mat-dialog-title] { font-size: 20px; }
      mat-dialog-content { padding: 18px 18px 7px; }
      mat-dialog-actions { display: grid; grid-template-columns: 1fr 1fr; padding: 10px 18px 18px; }
      .dataset strong { white-space: normal; overflow-wrap: anywhere; }
    }
  `]
})
export class ReleaseWithdrawDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: ReleasePackage,
    readonly dialogRef: MatDialogRef<ReleaseWithdrawDialogComponent, boolean>
  ) {}
}
