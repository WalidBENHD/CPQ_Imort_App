import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { mergeClaims, readAccessTokenClaims, readCapabilities, readRoles, TokenClaims } from './token-claims';
import { LocalAuthService } from './local-auth.service';
import { isLocalAuthMode } from './auth-mode';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly oauthService = inject(OAuthService);
  private readonly localAuth = inject(LocalAuthService);
  private readonly router = inject(Router);

  private get mergedClaims(): TokenClaims {
    const identityClaims = this.oauthService.getIdentityClaims() as TokenClaims | null;
    const accessTokenClaims = readAccessTokenClaims(this.oauthService.getAccessToken());
    return mergeClaims(identityClaims, accessTokenClaims);
  }

  get userName(): string {
    if (isLocalAuthMode()) {
      const tokenClaims = readAccessTokenClaims(this.localAuth.token);
      return this.localAuth.currentUser?.displayName
        ?? this.localAuth.currentUser?.userName
        ?? (tokenClaims['name'] as string)
        ?? (tokenClaims['preferred_username'] as string)
        ?? 'User';
    }

    const claims = this.mergedClaims;
    return (claims['name'] as string)
      || (claims['preferred_username'] as string)
      || (claims['upn'] as string)
      || (claims['email'] as string)
      || 'User';
  }

  get userId(): string {
    if (isLocalAuthMode()) {
      return this.localAuth.currentUser?.id
        ?? (readAccessTokenClaims(this.localAuth.token)['sub'] as string)
        ?? (readAccessTokenClaims(this.localAuth.token)['nameid'] as string)
        ?? '';
    }

    const claims = this.mergedClaims;
    return (claims['sub'] as string)
      || (claims['nameid'] as string)
      || (claims['oid'] as string)
      || '';
  }

  get isApprover(): boolean {
    return this.hasCapability('imports.approve') || this.hasCapability('imports.publish');
  }

  get isAdmin(): boolean {
    return this.hasCapability('users.manage');
  }

  get isInternalTools(): boolean {
    return this.hasCapability('tools.evolis');
  }

  hasCapability(capability: string): boolean {
    if (isLocalAuthMode()) {
      const current = this.localAuth.currentUser?.capabilities;
      if (current) return current.includes(capability);
      const claims = readAccessTokenClaims(this.localAuth.token);
      return readCapabilities(claims).includes(capability) || this.legacyRoleAllows(readRoles(claims), capability);
    }

    const claims = this.mergedClaims;
    return readCapabilities(claims).includes(capability) || this.legacyRoleAllows(readRoles(claims), capability);
  }

  private legacyRoleAllows(roles: string[], capability: string): boolean {
    if (roles.includes('cpq-admin')) return true;
    if (capability === 'tools.evolis') return roles.includes('cpq-internal-tools');
    if (['imports.approve', 'imports.reject', 'imports.return_to_review', 'imports.publish'].includes(capability))
      return roles.includes('cpq-approver') || roles.includes('cpq-internal-tools');
    return false;
  }

  get isAuthenticated(): boolean {
    if (isLocalAuthMode()) {
      return this.localAuth.isAuthenticated();
    }

    return this.oauthService.hasValidAccessToken();
  }

  initializeLocalSession(): void {
    if (!isLocalAuthMode()) {
      return;
    }

    this.localAuth.ensureUserLoaded().subscribe();
  }

  logout(): void {
    if (isLocalAuthMode()) {
      this.localAuth.logout();
      this.router.navigateByUrl('/login');
      return;
    }

    this.oauthService.logOut();
  }
}
