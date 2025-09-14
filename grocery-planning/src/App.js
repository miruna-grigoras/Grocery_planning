import React from "react";
import "./App.css";

import { Amplify } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import awsExports from "./aws-exports";
import Header from "./Header";           // butonul My Account -> <Link to="/account">
import RecipesPage from "./RecipesPage"; // pagina ta principală
import AccountPanel from "./AccountPanel"; // pagina cu datele contului + schimbare parolă

Amplify.configure(awsExports);

export default function App() {
  return (
    <BrowserRouter>
      <Authenticator>
        {({ user, signOut }) =>
          user ? (
            <div className="main-page">
              {/* Header primește doar onSignOut. My Account navighează la /account */}
              <Header onSignOut={signOut} />

              <main style={{ padding: "2rem" }}>
                <Routes>
                  <Route path="/" element={<RecipesPage />} />
                  <Route path="/account" element={<AccountPanel />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          ) : (
            <div className="auth-page">
              <div className="auth-box">
                <div className="welcome-message">
                  <h1>
                    Welcome to <span className="brand">NoWasteFood</span>
                  </h1>
                </div>
              </div>
            </div>
          )
        }
      </Authenticator>
    </BrowserRouter>
  );
}
