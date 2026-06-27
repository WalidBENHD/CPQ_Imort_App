import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { mergeClaims, readAccessTokenClaims, readRoles, TokenClaims } from './token-claims';
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

  get isApprover(): boolean {
    if (isLocalAuthMode()) {
      const tokenClaims = readAccessTokenClaims(this.localAuth.token);
      const tokenRoles = readRoles(tokenClaims);
      const role = this.localAuth.currentUser?.role ?? '';
      return role === 'cpq-approver'
        || tokenRoles.includes('cpq-approver')
        || this.localAuth.currentUser?.isAdmin === true
        || tokenRoles.includes('cpq-admin');
    }

    const roles = readRoles(this.mergedClaims);
    return roles.includes('cpq-approver');
  }

  get isAdmin(): boolean {
    if (isLocalAuthMode()) {
      const tokenClaims = readAccessTokenClaims(this.localAuth.token);
      const tokenRoles = readRoles(tokenClaims);
      return this.localAuth.currentUser?.isAdmin === true || tokenRoles.includes('cpq-admin');
    }

    const roles = readRoles(this.mergedClaims);
    return roles.includes('cpq-admin');
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
