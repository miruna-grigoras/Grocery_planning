import React, { useEffect, useState } from "react";
import {
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
  updatePassword,
  signOut,
} from "aws-amplify/auth";
import "./AccountPanel.css";

function Field({ label, children }) {
  return (
    <div className="ap-field">
      <div className="ap-field-label">{label}</div>
      <div className="ap-field-value">{children ?? "—"}</div>
    </div>
  );
}

export default function AccountPanel() {
  const [loading, setLoading] = useState(true);
  const [userCore, setUserCore] = useState(null);
  const [attrs, setAttrs] = useState(null);
  const [provider, setProvider] = useState("COGNITO");
  const [err, setErr] = useState("");

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const current = await getCurrentUser();
        setUserCore(current);

        const attributes = await fetchUserAttributes();
        setAttrs(attributes);

        const { tokens } = await fetchAuthSession();
        let isFederated = false;
        try {
          const p = tokens?.idToken?.payload;
          if (p?.identities || (Array.isArray(p?.amr) && p.amr.includes("federated"))) {
            isFederated = true;
          }
        } catch (_) {}
        setProvider(isFederated ? "FEDERATED" : "COGNITO");
      } catch {
        setErr("Couldn't load account data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg("");

    if (!oldPwd || !newPwd || !confirmPwd) {
      setPwdMsg("Please fill in all fields.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg("New password and confirmation do not match.");
      return;
    }
    if (newPwd.length < 8) {
      setPwdMsg("New password must be at least 8 characters.");
      return;
    }

    setPwdBusy(true);
    try {
      await updatePassword({ oldPassword: oldPwd, newPassword: newPwd });
      setPwdMsg("✅ Password updated successfully.");
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e) {
      const msg = e?.message || "Couldn't update the password.";
      setPwdMsg(`❌ ${msg}`);
    } finally {
      setPwdBusy(false);
    }
  };

  const disabledPw = provider !== "COGNITO";

  return (
    <div className="ap-wrap">
      <div className="ap-topbar">
        <h2 className="ap-title">My Account</h2>
        <button className="ap-btn ghost" onClick={() => signOut()}>Sign out</button>
      </div>

      {loading && <div className="ap-info">Loading…</div>}
      {err && <div className="ap-alert">{err}</div>}

      {!loading && !err && (
        <>
          <div className="ap-card">
            <div className="ap-card-header">Account Information</div>
            <div className="ap-card-body">
              <Field label="Email">{attrs?.email}</Field>
              <Field label="Email verified">{String(attrs?.email_verified ?? false)}</Field>
              <Field label="Username (Cognito)">{userCore?.username}</Field>
              <Field label="User ID (sub)">{userCore?.userId}</Field>
              <Field label="Auth Provider">
                {provider === "COGNITO" ? "Cognito (username + password)" : "Federated (Google/Apple/etc.)"}
              </Field>
            </div>
          </div>

          <div className="ap-card">
            <div className="ap-card-header">Change Password</div>
            <div className="ap-card-body">
              {disabledPw && (
                <div className="ap-note">
                  Your account is signed in with an external identity provider. Change your password in the provider's account.
                </div>
              )}

              <form onSubmit={handleChangePassword} className="ap-form">
                <div className="ap-input-group">
                  <span>Current password</span>
                  <input
                    className="ap-input"
                    type="password"
                    value={oldPwd}
                    onChange={(e) => setOldPwd(e.target.value)}
                    disabled={disabledPw || pwdBusy}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="ap-input-group">
                  <span>New password</span>
                  <input
                    className="ap-input"
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    disabled={disabledPw || pwdBusy}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="ap-input-group">
                  <span>Confirm new password</span>
                  <input
                    className="ap-input"
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    disabled={disabledPw || pwdBusy}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="ap-actions">
                  <button type="submit" className="ap-btn solid" disabled={disabledPw || pwdBusy}>
                    {pwdBusy ? "Updating…" : "Update password"}
                  </button>
                </div>
              </form>

              {pwdMsg && <div className="ap-msg">{pwdMsg}</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
