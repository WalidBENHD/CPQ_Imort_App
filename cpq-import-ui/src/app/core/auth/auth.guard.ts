import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { map } from 'rxjs/operators';
import { mergeClaims, readAccessTokenClaims, readRoles, TokenClaims } from './token-claims';
import { LocalAuthService } from './local-auth.service';
import { isLocalAuthMode } from './auth-mode';

export const authGuard: CanActivateFn = () => {
  if (isLocalAuthMode()) {
    const localAuth = inject(LocalAuthService);
    const router = inject(Router);

    return localAuth.ensureUserLoaded().pipe(
      map((user) => user ? true : router.parseUrl('/login'))
    );
  }

  const oauthService = inject(OAuthService);

  if (oauthService.hasValidAccessToken()) {
    return true;
  }

  oauthService.initCodeFlow();
  return false;
};

export const approverGuard: CanActivateFn = () => {
  if (isLocalAuthMode()) {
    const localAuth = inject(LocalAuthService);
    const router = inject(Router);

    return localAuth.ensureUserLoaded().pipe(
      map((user) => {
        if (!user) return router.parseUrl('/login');
        if (user.role === 'cpq-approver' || user.isAdmin) return true;
        return router.parseUrl('/forbidden');
      })
    );
  }

  const oauthService = inject(OAuthService);
  const router = inject(Router);

  if (!oauthService.hasValidAccessToken()) {
    oauthService.initCodeFlow();
    return false;
  }

  const identityClaims = oauthService.getIdentityClaims() as TokenClaims | null;
  const accessTokenClaims = readAccessTokenClaims(oauthService.getAccessToken());
  const claims = mergeClaims(identityClaims, accessTokenClaims);
  const roles = readRoles(claims);
  if (roles.includes('cpq-approver')) return true;

  router.navigate(['/forbidden']);
  return false;
};

export const adminGuard: CanActivateFn = () => {
  if (isLocalAuthMode()) {
    const localAuth = inject(LocalAuthService);
    const router = inject(Router);

    return localAuth.ensureUserLoaded().pipe(
      map((user) => {
        if (!user) return router.parseUrl('/login');
        if (user.isAdmin) return true;
        return router.parseUrl('/forbidden');
      })
    );
  }

  const oauthService = inject(OAuthService);
  const router = inject(Router);

  if (!oauthService.hasValidAccessToken()) {
    oauthService.initCodeFlow();
    return false;
  }

  const identityClaims = oauthService.getIdentityClaims() as TokenClaims | null;
  const accessTokenClaims = readAccessTokenClaims(oauthService.getAccessToken());
  const claims = mergeClaims(identityClaims, accessTokenClaims);
  const roles = readRoles(claims);
  if (roles.includes('cpq-admin')) return true;

  router.navigate(['/forbidden']);
  return false;
};
