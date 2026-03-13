import { useState } from "react";
import { api } from "../api/client.js";
import { generateUserKeyBundle, unlockPrivateKey } from "../crypto/accountCrypto.js";

export const AuthCard = ({ onAuthenticated }) => {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [status, setStatus] = useState({ loading: false, error: "" });

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: "" });

    try {
      let response;

      if (mode === "register") {
        const keyBundle = await generateUserKeyBundle(form.password);
        response = await api.register({
          name: form.name,
          email: form.email,
          password: form.password,
          publicKeyJwk: keyBundle.publicKeyJwk,
          encryptedPrivateKeyBundle: keyBundle.encryptedPrivateKeyBundle
        });
      } else {
        response = await api.login({
          email: form.email,
          password: form.password
        });
      }

      const privateKey = await unlockPrivateKey(response.user.encryptedPrivateKeyBundle, form.password);
      onAuthenticated({
        token: response.token,
        user: response.user,
        password: form.password,
        privateKey
      });
      setStatus({ loading: false, error: "" });
    } catch (error) {
      setStatus({ loading: false, error: error.message });
    }
  };

  return (
    <section className="card auth-card">
      <div className="eyebrow">Zero-knowledge access starts in the browser</div>
      <h1>SecureVault</h1>
      <p className="muted">
        Register once to generate your ECDH key pair locally. Your encrypted private key can be stored on the
        backend, but the backend never sees the plaintext key.
      </p>

      <form className="stack" onSubmit={submit}>
        {mode === "register" ? (
          <label className="field">
            <span>Name</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ada Lovelace"
            />
          </label>
        ) : null}

        <label className="field">
          <span>Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="you@example.com"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            required
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Strong passphrase"
          />
        </label>

        {status.error ? <p className="error">{status.error}</p> : null}

        <button className="primary" disabled={status.loading} type="submit">
          {status.loading ? "Working..." : mode === "register" ? "Create secure account" : "Unlock dashboard"}
        </button>
      </form>

      <button className="link-button" onClick={() => setMode((current) => (current === "login" ? "register" : "login"))} type="button">
        {mode === "login" ? "Need an account? Generate one now" : "Already registered? Sign in instead"}
      </button>
    </section>
  );
};

