# Entra SSO Setup Guide (CPQ Import App)

Use this guide to connect the app to your organization login.

## 0) What you will create

- One Entra App Registration for the API
- One Entra App Registration for the Angular SPA
- One app role: `cpq-approver`
- One API scope: `cpq.import.access`

## 1) Create API app registration

1. Go to Entra Admin Center -> App registrations -> New registration.
2. Name: `CPQ Import API`.
3. Accounts: choose your org default (single tenant is usually correct).
4. Register.

After creation, note these values:
- API_CLIENT_ID = Application (client) ID
- TENANT_ID = Directory (tenant) ID

## 2) Expose API scope

In the API app:
1. Open Expose an API.
2. Set Application ID URI if not set:
   - `api://<API_CLIENT_ID>`
3. Add a scope:
   - Scope name: `cpq.import.access`
   - Who can consent: Admins and users
   - Display name: `Access CPQ Import API`
   - Description: `Allows access to CPQ Import API`
   - State: Enabled

Resulting scope string:
- `api://<API_CLIENT_ID>/cpq.import.access`

## 3) Add app role (approver)

In the API app:
1. Open App roles -> Create app role.
2. Display name: `CPQ Approver`
3. Allowed member types: Users/Groups
4. Value: `cpq-approver`
5. Description: `Can approve and commit imports`
6. Enable role and save.

## 4) Create SPA app registration

1. App registrations -> New registration.
2. Name: `CPQ Import UI`.
3. Accounts: same as API app.
4. Register.

Note:
- SPA_CLIENT_ID = Application (client) ID

## 5) Configure SPA authentication

In SPA app -> Authentication:
1. Add platform -> Single-page application.
2. Add redirect URIs:
   - `http://localhost:4200/`
   - production URL root (for example `https://cpq-import.company.com/`)
3. Front-channel logout URL (optional): production root URL.
4. Enable Access tokens and ID tokens for implicit/hybrid only if your tenant policy requires it.
   - For authorization code + PKCE (current app), this is usually not required.

## 6) Grant SPA permission to API scope

In SPA app -> API permissions:
1. Add permission -> My APIs -> select `CPQ Import API`.
2. Delegated permissions -> select `cpq.import.access`.
3. Add OpenID permissions if missing: `openid`, `profile`, `email`, `offline_access`.
4. Click Grant admin consent for your organization.

## 7) Assign users/groups and approver role

In Entra -> Enterprise applications:
1. Open enterprise app for `CPQ Import UI` (and/or API if your org assigns there).
2. Users and groups -> Add user/group for normal access.
3. Assign the `CPQ Approver` app role to approver users/group.

## 8) Fill project configuration values

## Frontend dev config
File: `cpq-import-ui/src/environments/environment.ts`
- `auth.issuer` = `https://login.microsoftonline.com/<TENANT_ID>/v2.0`
- `auth.clientId` = `<SPA_CLIENT_ID>`
- `auth.scope` = `openid profile email offline_access api://<API_CLIENT_ID>/cpq.import.access`

## Frontend prod config
File: `cpq-import-ui/src/environments/environment.prod.ts`
- Same values as above, production URLs already use `window.location.origin`.

## API config
File: `src/CPQ_Import_App.API/appsettings.json`
- `Auth:Authority` = `https://login.microsoftonline.com/<TENANT_ID>/v2.0`
- `Auth:Audience` = `api://<API_CLIENT_ID>`

## Dev auth flag
File: `src/CPQ_Import_App.API/appsettings.Development.json`
- Keep `Auth:DisableAuth` = `false`

## 9) Run and validate

1. Start API and UI.
2. Open app in private/incognito window.
3. Expect redirect to organization login page.
4. After login, app should load.
5. Test role behavior:
   - non-approver user cannot commit/reject
   - approver user can commit/reject

## 10) Troubleshooting quick fixes

- 401 from API:
  - Verify `Auth:Audience` exactly matches API Application ID URI.
  - Verify SPA requests include API scope in `auth.scope`.

- Login works but approver blocked:
  - Confirm app role value is exactly `cpq-approver`.
  - Confirm role is assigned to user/group.

- Redirect loop:
  - Redirect URI in Entra must exactly match app URL (including trailing slash).

- CORS errors:
  - Ensure frontend origin is included in `Cors:AllowedOrigins` in API config.
