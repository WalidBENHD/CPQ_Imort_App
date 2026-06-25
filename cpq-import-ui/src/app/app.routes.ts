import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'import/new',
    canActivate: [authGuard],
    loadComponent: () => import('./features/import-wizard/import-wizard.component').then(m => m.ImportWizardComponent)
  },
  {
    path: 'import/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/import-preview/import-preview.component').then(m => m.ImportPreviewComponent)
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./features/forbidden/forbidden.component').then(m => m.ForbiddenComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
