import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';
import { LocalAuthService } from './local-auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = environment.disableAuth
    ? inject(LocalAuthService).token
    : inject(OAuthService).getAccessToken();

  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req);
};
