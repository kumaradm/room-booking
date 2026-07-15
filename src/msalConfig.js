// src/msalConfig.js
import { PublicClientApplication } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    // Paste the Client ID you copied from Microsoft Entra Portal here:
    clientId: "10126d5f-6b01-491d-9eb1-2d1b27298605", 
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin, // e.g., http://localhost:3000
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: true,
  }
};

export const msalInstance = new PublicClientApplication(msalConfig);