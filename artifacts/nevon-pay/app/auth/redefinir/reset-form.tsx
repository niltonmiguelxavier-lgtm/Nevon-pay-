"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";

function getAppPath(path: string) {
  const pathname = window.location.pathname;
  const base = pathname.replace(/\/auth\/redefinir\/?$/, "");
  return `${base}${path}`;
}

/**
 * Definição da nova palavra-passe depois de o link de recuperação ter criado
 * a sessão de recuperação em /auth/callback. Confirma no cliente que existe
 * sessão activa antes de mostrar o formulário.
 */
export default function ResetForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function check() {
      if (!configured) {
        setSessionChecked(true);
        return;
      }
      const { data } = await createClient().auth.getSession();
      if (!mounted) return;
      setHasSession(Boolean(data.session));
      setSessionChecked(true);
    }
    void check();
    return () => {
      mounted = false;
    };
  }, [configured]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("A palavra-passe tem de ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("A confirmação não coincide com a nova palavra-passe.");
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      await createClient().auth.signOut();
      setTimeout(() => router.replace(getAppPath("/login?message=palavra_passe_alterada")), 1200);
    } catch (caught) {
      setError(authErrorMessage(caught as { message?: string; code?: string }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="reset-heading">
        <Link className="auth-brand" href="/">
          <span className="auth-brand-mark">N</span>
          <span>Nevon<span>Pay</span></span>
        </Link>

        <p className="auth-eyebrow">NOVA PALAVRA-PASSE</p>
        <h1 id="reset-heading">Definir palavra-passe</h1>

        {!sessionChecked ? (
          <p className="auth-description">A validar o link de recuperação…</p>
        ) : success ? (
          <p className="auth-success" role="status">
            Palavra-passe actualizada com sucesso. A redireccionar para o início de sessão…
          </p>
        ) : !hasSession ? (
          <>
            <p className="auth-error" role="alert">
              O link de recuperação expirou ou já foi utilizado. Peça um novo email para continuar.
            </p>
            <Link className="auth-back" href="/auth/recuperar">Pedir novo link</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label className="auth-label" htmlFor="new-password">Nova palavra-passe</label>
            <input
              className="auth-input"
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <label className="auth-label" htmlFor="confirm-password">Confirmar palavra-passe</label>
            <input
              className="auth-input"
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "A guardar..." : "Guardar nova palavra-passe"}
            </button>
          </form>
        )}

        <Link className="auth-back" href="/login">Voltar ao início de sessão</Link>
      </section>
    </main>
  );
}
