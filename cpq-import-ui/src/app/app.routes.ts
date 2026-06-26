import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent)
  },
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
  {
    path: 'admin/users',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/user-approval.component').then(m => m.UserApprovalComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
