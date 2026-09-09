import { AuthConfig } from 'angular-oauth2-oidc';

export const authConfig: AuthConfig = {
  clientId: '83e6cc0c-00d8-4255-b61c-ff4bad49a6ac',
  issuer: 'https://login.microsoftonline.com/6d0b30ef-e3c7-4b3b-aad9-f4b5a6bef04e/v2.0',
  redirectUri: window.location.origin + '/callback',
  postLogoutRedirectUri: window.location.origin,
  responseType: 'code',
  scope: 'openid profile email',
  strictDiscoveryDocumentValidation: false,
  useHashLocationStrategy: true,
  skipIssuerCheck: false,
  oidc: true,
};
