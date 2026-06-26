export const environment = {
  production: true,
  apiUrl: '/api',
  disableAuth: false,
  auth: {
    issuer: 'https://YOUR_ISSUER',
    clientId: 'YOUR_CLIENT_ID',
    scope: 'openid profile email api://YOUR_API_CLIENT_ID/cpq.import.access offline_access',
    responseType: 'code',
    redirectUri: window.location.origin + '/',
    silentRefreshRedirectUri: window.location.origin + '/silent-refresh.html',
    postLogoutRedirectUri: window.location.origin + '/'
  }
};
