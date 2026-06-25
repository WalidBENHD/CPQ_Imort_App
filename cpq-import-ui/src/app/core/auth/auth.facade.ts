import { Injectable, inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly oauthService = inject(OAuthService);

  get userName(): string {
    if (environment.disableAuth) {
      return 'Local Test User';
    }

    const claims = this.oauthService.getIdentityClaims() as Record<string, unknown>;
    return (claims?.['name'] as string) || (claims?.['preferred_username'] as string) || 'User';
  }

  get isApprover(): boolean {
    if (environment.disableAuth) {
      return true;
    }

    const claims = this.oauthService.getIdentityClaims() as Record<string, unknown>;
    const roles = (claims?.['roles'] as string[]) ?? [];
    return roles.includes('cpq-approver');
  }

  logout(): void {
    if (environment.disableAuth) {
      return;
    }

    this.oauthService.logOut();
  }
}
