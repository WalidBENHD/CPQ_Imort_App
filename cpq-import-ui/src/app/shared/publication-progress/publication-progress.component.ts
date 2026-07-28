import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-publication-progress',
  standalone: true,
  template: `
    <span class="publication-progress" role="status" aria-live="polite">
      <span class="publication-progress__pipeline" aria-hidden="true">
        <i></i><i></i><i></i>
        <b></b>
      </span>
      <span>{{ label }}</span>
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .publication-progress {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      white-space: nowrap;
    }

    .publication-progress__pipeline {
      position: relative;
      width: 46px;
      height: 16px;
      display: block;
    }

    .publication-progress__pipeline::before {
      content: '';
      position: absolute;
      top: 7px;
      left: 4px;
      right: 4px;
      height: 2px;
      border-radius: 999px;
      background: rgba(255, 255, 255, .32);
    }

    .publication-progress__pipeline i {
      position: absolute;
      top: 4px;
      z-index: 1;
      width: 8px;
      height: 8px;
      border: 2px solid rgba(255, 255, 255, .76);
      border-radius: 50%;
      box-sizing: border-box;
      background: #3156cb;
      animation: publication-node 1.35s ease-in-out infinite;
    }

    .publication-progress__pipeline i:nth-child(1) { left: 0; }
    .publication-progress__pipeline i:nth-child(2) { left: 19px; animation-delay: .22s; }
    .publication-progress__pipeline i:nth-child(3) { right: 0; animation-delay: .44s; }

    .publication-progress__pipeline b {
      position: absolute;
      top: 4px;
      left: 0;
      z-index: 2;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #99f6e4;
      box-shadow: 0 0 0 4px rgba(153, 246, 228, .16), 0 0 10px rgba(153, 246, 228, .8);
      animation: publication-transfer 1.35s cubic-bezier(.4, 0, .2, 1) infinite;
    }

    @keyframes publication-transfer {
      0% { left: 0; opacity: 0; transform: scale(.65); }
      10% { opacity: 1; transform: scale(1); }
      46% { left: 19px; }
      88% { opacity: 1; transform: scale(1); }
      100% { left: 38px; opacity: 0; transform: scale(.65); }
    }

    @keyframes publication-node {
      0%, 100% { border-color: rgba(255, 255, 255, .62); }
      42% { border-color: #ccfbf1; box-shadow: 0 0 0 3px rgba(153, 246, 228, .12); }
    }

    @media (prefers-reduced-motion: reduce) {
      .publication-progress__pipeline i { animation: none; }
      .publication-progress__pipeline b {
        left: 38px;
        animation: none;
        opacity: 1;
        transform: none;
      }
    }
  `]
})
export class PublicationProgressComponent {
  @Input() label = 'Publishing securely';
}
