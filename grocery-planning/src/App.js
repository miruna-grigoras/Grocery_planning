
import React from 'react';
import './App.css';

import { Amplify } from 'aws-amplify';
import { Authenticator, withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import awsExports from './aws-exports';
import Header from './Header';
import RecipesPage from './RecipesPage';
Amplify.configure(awsExports);


function App() {
  return (
    <div className="App">
      {/* Authenticator gestionează întreg fluxul de autentificare */}
      <Authenticator>
        {({ signOut, user }) => (
          user ? (
            
            <div className="main-page">
              <Header onSignOut={signOut} />
              <main style={{ padding: '2rem' }}>
                <RecipesPage />
              </main>
            </div>
          ) : (
           
            <div className="auth-page">
              <div className="auth-box">
                <div className="welcome-message">
                  <h1>
                    Bine ați venit la <span className="brand">NoWasteFood</span>
                  </h1>
                </div>
                {/* Formularul standard de autentificare al Amplify */}
              </div>
            </div>
          )
        )}
      </Authenticator>
    </div>
  );
}

export default withAuthenticator(App);
