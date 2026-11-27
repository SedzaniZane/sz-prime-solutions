"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import "../../login/login.css";

type Enrollment = { id: string; qr: string; secret: string };
export default function SecuritySettings() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(()=>{
    void createClient().auth.mfa.listFactors().then(({data,error})=>{
      if(error) {setMessage("Unable to load security settings.");return;}
      setEnabled(data.totp.some(f=>f.status==='verified'));setReady(true);
    });
  },[]);
  async function enroll() {
    setBusy(true);setMessage("");
    try {
      const client=createClient();
      const {data:factors,error:factorError}=await client.auth.mfa.listFactors();
      if(factorError) throw factorError;
      if(factors.totp.some(f=>f.status==='verified')) {setEnabled(true);return;}
      // Remove only unfinished TOTP setups to allow a safe retry after navigating away.
      for(const factor of factors.all.filter(f=>f.factor_type==='totp' && f.status==='unverified')) {
        const {error}=await client.auth.mfa.unenroll({factorId:factor.id});if(error) throw error;
      }
      const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'SZ Prime Operations',issuer:'SZ Prime Solutions'});
      if(error) throw error;
      setEnrollment({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret});
    } catch {setMessage("Unable to start authenticator setup. Please retry.");}
    finally {setBusy(false);}
  }
  async function verify(e:FormEvent) {
    e.preventDefault();if(!enrollment) return;setBusy(true);setMessage("");
    try {
      const {error}=await createClient().auth.mfa.challengeAndVerify({factorId:enrollment.id,code});
      if(error) {setMessage("Code not accepted. Check the current code and try again.");return;}
      setEnrollment(null);setCode("");setEnabled(true);setMessage("Authenticator enabled. Future sign-ins require your password and authenticator code.");
    } finally {setBusy(false);}
  }
  return <main className="login-shell"><section className="login-card">
    <p className="login-eyebrow">ACCOUNT SECURITY</p><h1>Protect staff access</h1>
    {enabled ? <p>Authenticator protection is enabled.</p> : <><p>Add SZ Prime Operations to your authenticator app, then confirm a code to activate it. Keep secure access to your authenticator backup; account recovery requires the administrator.</p>
      {!enrollment && <button disabled={busy||!ready} onClick={enroll}>{busy?'Preparing…':'Set up authenticator'}</button>}
      {enrollment && <><p>Scan this QR code in your authenticator. Keep the QR and setup key private.</p>
        {/* The QR remains in this browser session and is never logged or stored in app tables. */}
        <img src={enrollment.qr} alt="Authenticator setup QR code" width={220} height={220}/>
        <details><summary>Enter a setup key instead</summary><code style={{overflowWrap:'anywhere'}}>{enrollment.secret}</code></details>
        <form onSubmit={verify}><label>Six-digit authenticator code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} required/></label>
        <button disabled={busy}>{busy?'Verifying…':'Enable authenticator'}</button></form></>}
    </>}
    <p role="status">{message}</p><Link href="/ops">Back to Operations</Link>
  </section></main>;
}
