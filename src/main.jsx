import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./msalConfig";
import './index.css'; // <--- ADD THIS LINE FOR STYLING

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  </React.StrictMode>
);