import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { LocalAuthService } from './local-auth.service';
import { isLocalAuthMode } from './auth-mode';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = isLocalAuthMode()
    ? inject(LocalAuthService).token
    : inject(OAuthService).getAccessToken();

  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req);
};
