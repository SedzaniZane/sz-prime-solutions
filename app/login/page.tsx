"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/ops";
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="login-eyebrow">SZ PRIME SOLUTIONS</p>
        <h1>Operations sign in</h1>
        <p className="login-copy">
          Staff access to customers, service requests, quotations, payments and partner workflows.
        </p>

        <form onSubmit={signIn}>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>

          {message && <p className="login-message">{message}</p>}
        </form>
      </section>
    </main>
  );
}
