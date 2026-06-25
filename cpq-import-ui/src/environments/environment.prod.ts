export const environment = {
  production: true,
  apiUrl: '/api',
  auth: {
    issuer: 'https://YOUR_ISSUER',
    clientId: 'YOUR_CLIENT_ID',
    scope: 'openid profile email',
    responseType: 'code',
    redirectUri: window.location.origin + '/',
    silentRefreshRedirectUri: window.location.origin + '/silent-refresh.html',
    postLogoutRedirectUri: window.location.origin + '/'
  }
};
