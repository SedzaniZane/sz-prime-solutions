"use client";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import "../login.css";

export default function VerifyMfa() {
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const client = createClient();
    void client.auth.mfa.listFactors().then(({data, error}) => {
      if (error) { setMessage("Unable to load your authenticator. Please sign in again."); return; }
      const factor = data.totp.find(f => f.status === "verified");
      if (!factor) { window.location.replace("/ops"); return; }
      setFactorId(factor.id);
    });
  }, []);
  async function verify(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const {error} = await createClient().auth.mfa.challengeAndVerify({factorId, code});
      if (error) { setMessage("Code not accepted. Use the current code from your authenticator."); return; }
      window.location.replace("/ops");
    } finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-card">
    <p className="login-eyebrow">SZ PRIME SOLUTIONS</p><h1>Verify your sign-in</h1>
    <p>Enter the six-digit code from your authenticator app.</p>
    <form onSubmit={verify}><label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} /></label>
      <button disabled={busy || !factorId}>{busy ? "Verifying…" : "Verify"}</button></form>
    <p role="status">{message}</p><button onClick={async()=>{await createClient().auth.signOut();window.location.replace('/login');}}>Sign out</button>
  </section></main>;
}
