export const environment = {
  production: false,
  apiUrl: 'http://localhost:5294/api',
  disableAuth: true,
  auth: {
    // Fill in once your OIDC provider is known.
    // Example for Azure Entra ID:
    //   issuer: 'https://login.microsoftonline.com/{tenant-id}/v2.0'
    //   clientId: '{client-id}'
    //   scope: 'openid profile email api://{api-client-id}/cpq.import.access offline_access'
    issuer: 'https://YOUR_ISSUER',
    clientId: 'YOUR_CLIENT_ID',
    scope: 'openid profile email api://YOUR_API_CLIENT_ID/cpq.import.access offline_access',
    responseType: 'code',
    redirectUri: 'http://localhost:4200/',
    silentRefreshRedirectUri: 'http://localhost:4200/silent-refresh.html',
    postLogoutRedirectUri: 'http://localhost:4200/'
  }
};
