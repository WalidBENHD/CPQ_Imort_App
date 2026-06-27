import { environment } from '../../../environments/environment';

export function isLocalAuthMode(): boolean {
  if (environment.disableAuth) {
    return true;
  }

  const issuer = (environment.auth?.issuer ?? '').toUpperCase();
  const clientId = (environment.auth?.clientId ?? '').toUpperCase();

  // Safety fallback: if OIDC values are placeholders, force local auth mode.
  return issuer.includes('YOUR_ISSUER') || clientId.includes('YOUR_CLIENT_ID');
}
