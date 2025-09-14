import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Header.css";

export default function Header({ onSignOut }) {
  const navigate = useNavigate();

  return (
    <header className="nw-header">
      <div className="nw-header-inner">
        {/* Brand centrat */}
        <Link to="/" className="nw-brand" aria-label="Go to homepage">
          <span className="nw-emoji" aria-hidden="true">🥗</span>
          <span className="nw-title">NoWaste</span>
        </Link>

        {/* Butoane în dreapta */}
        <div className="nw-actions" role="navigation" aria-label="Header actions">
          <button
            className="nw-btn outline"
            onClick={() => navigate("/account")}
          >
            My Account
          </button>
          <button className="nw-btn solid" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
