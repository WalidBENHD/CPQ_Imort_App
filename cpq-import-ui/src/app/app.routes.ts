import { Routes } from '@angular/router';
import { authGuard, capabilityGuard, internalToolsGuard } from './core/auth/auth.guard';

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
    canActivate: [capabilityGuard('imports.view')],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'datasets',
    canActivate: [capabilityGuard('imports.view')],
    loadComponent: () => import('./features/datasets/datasets.component').then(m => m.DatasetsComponent)
  },
  {
    path: 'business-trace',
    canActivate: [capabilityGuard('imports.view')],
    loadComponent: () => import('./features/business-trace/business-trace.component').then(m => m.BusinessTraceComponent)
  },
  {
    path: 'uploads',
    canActivate: [capabilityGuard('imports.view')],
    loadComponent: () => import('./features/uploads/uploads.component').then(m => m.UploadsComponent)
  },
  {
    path: 'internal-tools/evolis-decryptor',
    canActivate: [internalToolsGuard],
    loadComponent: () => import('./features/internal-tools/evolis-decryptor.component').then(m => m.EvolisDecryptorComponent)
  },
  {
    path: 'import/new',
    canActivate: [capabilityGuard('imports.upload'), capabilityGuard('imports.submit')],
    loadComponent: () => import('./features/import-wizard/import-wizard.component').then(m => m.ImportWizardComponent)
  },
  {
    path: 'import/:id',
    canActivate: [capabilityGuard('imports.view')],
    loadComponent: () => import('./features/import-preview/import-preview.component').then(m => m.ImportPreviewComponent)
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./features/forbidden/forbidden.component').then(m => m.ForbiddenComponent)
  },
  {
    path: 'admin/users',
    canActivate: [capabilityGuard('users.manage'), capabilityGuard('users.assign_roles')],
    loadComponent: () => import('./features/admin/people-studio.component').then(m => m.PeopleStudioComponent)
  },
  {
    path: 'admin/activity',
    canActivate: [capabilityGuard('audit.view')],
    loadComponent: () => import('./features/admin/activity-monitor.component').then(m => m.ActivityMonitorComponent)
  },
  {
    path: 'admin/access-studio',
    canActivate: [capabilityGuard('roles.manage')],
    loadComponent: () => import('./features/admin/access-studio.component').then(m => m.AccessStudioComponent)
  },
  {
    path: 'admin/maintenance',
    canActivate: [capabilityGuard('system.maintenance')],
    loadComponent: () => import('./features/admin/maintenance.component').then(m => m.MaintenanceComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
