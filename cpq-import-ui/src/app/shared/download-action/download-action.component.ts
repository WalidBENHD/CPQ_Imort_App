import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-download-action',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <span class="motion" *ngIf="loading; else idleIcon" aria-hidden="true">
      <mat-icon>arrow_downward</mat-icon>
    </span>
    <ng-template #idleIcon><mat-icon>{{ icon }}</mat-icon></ng-template>
    <span class="label" *ngIf="label">{{ label }}</span>
  `,
  styles: [`
    :host { display:inline-flex; align-items:center; justify-content:center; gap:7px; }
    mat-icon { width:18px; height:18px; margin:0 !important; font-size:18px; }
    .motion { position:relative; display:inline-grid; place-items:center; width:21px; height:21px; border-radius:50%; }
    .motion::before { content:''; position:absolute; inset:0; border:2px solid currentColor; border-right-color:transparent; border-bottom-color:color-mix(in srgb,currentColor 22%,transparent); border-radius:inherit; opacity:.9; animation:download-orbit .85s linear infinite; }
    .motion mat-icon { width:13px; height:13px; font-size:13px; animation:download-transfer .85s ease-in-out infinite; }
    .label { white-space:nowrap; }
    @keyframes download-orbit { to { transform:rotate(360deg); } }
    @keyframes download-transfer {
      0%, 100% { opacity:.45; transform:translateY(-2px); }
      50% { opacity:1; transform:translateY(2px); }
    }
    @media (prefers-reduced-motion:reduce) {
      .motion::before, .motion mat-icon { animation-duration:1.8s; }
    }
  `]
})
export class DownloadActionComponent {
  @Input() loading = false;
  @Input() icon = 'download';
  @Input() label = '';
}
