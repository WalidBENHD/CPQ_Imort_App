import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';

export const authGuard: CanActivateFn = () => {
  if (environment.disableAuth) {
    return true;
  }

  const oauthService = inject(OAuthService);
  const router = inject(Router);

  if (oauthService.hasValidAccessToken()) {
    return true;
  }

  oauthService.initCodeFlow();
  return false;
};

export const approverGuard: CanActivateFn = () => {
  if (environment.disableAuth) {
    return true;
  }

  const oauthService = inject(OAuthService);
  const router = inject(Router);

  if (!oauthService.hasValidAccessToken()) {
    oauthService.initCodeFlow();
    return false;
  }

  const claims = oauthService.getIdentityClaims() as Record<string, unknown>;
  const roles: string[] = (claims?.['roles'] as string[]) ?? [];
  if (roles.includes('cpq-approver')) return true;

  router.navigate(['/forbidden']);
  return false;
};
