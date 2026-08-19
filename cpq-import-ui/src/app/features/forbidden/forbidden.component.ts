import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { AuthFacade } from '../../core/auth/auth.facade';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatCardModule],
  template: `
    <div class="center">
      <mat-card class="forbidden-card">
        <mat-icon color="warn" class="icon">lock</mat-icon>
        <h2>Access Denied</h2>
        <p>Your current access does not include this page.</p>
        <a mat-raised-button color="primary" [routerLink]="auth.homeRoute">Back to my workspace</a>
      </mat-card>
    </div>
  `,
  styles: [`
    .center { display: flex; justify-content: center; align-items: center; padding: 80px 16px; }
    .forbidden-card { text-align: center; padding: 40px; max-width: 360px; }
    .icon { font-size: 64px; height: 64px; width: 64px; }
  `]
})
export class ForbiddenComponent {
  readonly auth = inject(AuthFacade);
}
