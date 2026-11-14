"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";

function getAppPath(path: string) {
  const pathname = window.location.pathname;
  const base = pathname.replace(/\/auth\/recuperar\/?$/, "");
  return `${base}${path}`;
}

export default function RecoverForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!configured) {
      setError("A ligação ao Supabase ainda não está configurada.");
      return;
    }

    setBusy(true);
    try {
      const { error: authError } = await createClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}${getAppPath("/auth/callback")}`,
      });
      if (authError) throw authError;
      // Não revelamos se o email existe (evita enumeração de contas).
      setSent(true);
    } catch (caught) {
      setError(authErrorMessage(caught as { message?: string; code?: string }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="recover-heading">
        <Link className="auth-brand" href="/">
          <span className="auth-brand-mark">N</span>
          <span>Nevon<span>Pay</span></span>
        </Link>

        <p className="auth-eyebrow">RECUPERAÇÃO DE ACESSO</p>
        <h1 id="recover-heading">Redefinir palavra-passe</h1>
        <p className="auth-description">
          Indique o email da sua conta. Enviamos um link válido por tempo limitado para escolher uma nova
          palavra-passe.
        </p>

        {sent ? (
          <p className="auth-success" role="status">
            Se existir uma conta com <strong>{email}</strong>, enviámos um link para redefinir a palavra-passe.
            Verifique a caixa de entrada e a pasta de spam.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label className="auth-label" htmlFor="email">Email</label>
            <input
              className="auth-input"
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={busy || !configured}>
              {busy ? "A enviar..." : "Enviar link de recuperação"}
            </button>
          </form>
        )}

        <Link className="auth-back" href="/login">Voltar ao início de sessão</Link>
      </section>
    </main>
  );
}
