import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { map } from 'rxjs/operators';
import { mergeClaims, readAccessTokenClaims, readCapabilities, readRoles, TokenClaims } from './token-claims';
import { LocalAuthService } from './local-auth.service';
import { isLocalAuthMode } from './auth-mode';

export const authGuard: CanActivateFn = () => {
  if (isLocalAuthMode()) {
    const localAuth = inject(LocalAuthService);
    const router = inject(Router);
    return localAuth.ensureUserLoaded().pipe(map(user => user ? true : router.parseUrl('/login')));
  }

  const oauthService = inject(OAuthService);
  if (oauthService.hasValidAccessToken()) return true;
  oauthService.initCodeFlow();
  return false;
};

export function capabilityGuard(capability: string): CanActivateFn {
  return () => {
    const router = inject(Router);
    if (isLocalAuthMode()) {
      const localAuth = inject(LocalAuthService);
      return localAuth.ensureUserLoaded().pipe(map(user => {
        if (!user) return router.parseUrl('/login');
        return user.capabilities?.includes(capability) ? true : router.parseUrl('/forbidden');
      }));
    }

    const oauthService = inject(OAuthService);
    if (!oauthService.hasValidAccessToken()) {
      oauthService.initCodeFlow();
      return false;
    }

    const identityClaims = oauthService.getIdentityClaims() as TokenClaims | null;
    const claims = mergeClaims(identityClaims, readAccessTokenClaims(oauthService.getAccessToken()));
    const capabilities = readCapabilities(claims);
    const roles = readRoles(claims);
    if (capabilities.includes(capability) || legacyRoleAllows(roles, capability)) return true;
    return router.parseUrl('/forbidden');
  };
}

function legacyRoleAllows(roles: string[], capability: string): boolean {
  if (roles.includes('cpq-admin')) return true;
  if (capability === 'tools.evolis') return roles.includes('cpq-internal-tools');
  if (['imports.approve', 'imports.reject', 'imports.return_to_review', 'imports.publish'].includes(capability))
    return roles.includes('cpq-approver') || roles.includes('cpq-internal-tools');
  return false;
}

export const approverGuard = capabilityGuard('imports.approve');
export const internalToolsGuard = capabilityGuard('tools.evolis');
export const adminGuard = capabilityGuard('users.manage');
