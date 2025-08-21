import React from 'react';
import './Header.css';

function Header({ onSignOut }) {
  return (
    <header className="app-header">
      <div className="logo">🍽️ RețeteDelicioase</div>
      <input 
        type="text" 
        placeholder="Caută rețete..." 
        className="search-bar"
      />
      <div className="account-section">
        <button className="account-btn">My Account</button>
        <button className="signout-btn" onClick={onSignOut}>Sign Out</button>
      </div>
    </header>
  );
}

export default Header;
