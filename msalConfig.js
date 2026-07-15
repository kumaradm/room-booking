import { PublicClientApplication } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: "10126d5f-6b01-491d-9eb1-2d1b27298605", // Paste your copied string here
    authority: "https://login.microsoftonline.com/common", // "common" allows personal accounts
    redirectUri: "http://localhost:5174",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  }
};

export const msalInstance = new PublicClientApplication(msalConfig);
await msalInstance.initialize(); // Initialize instance engine