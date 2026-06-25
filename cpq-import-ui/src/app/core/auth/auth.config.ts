import { AuthConfig } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';

export const authConfig: AuthConfig = {
  issuer: environment.auth.issuer,
  clientId: environment.auth.clientId,
  redirectUri: environment.auth.redirectUri,
  silentRefreshRedirectUri: environment.auth.silentRefreshRedirectUri,
  postLogoutRedirectUri: environment.auth.postLogoutRedirectUri,
  scope: environment.auth.scope,
  responseType: environment.auth.responseType,
  showDebugInformation: !environment.production,
  requireHttps: environment.production,
  // PKCE (Proof Key for Code Exchange) — no client secret needed in the SPA
  useSilentRefresh: true,
  silentRefreshTimeout: 5000,
  clearHashAfterLogin: true
};
