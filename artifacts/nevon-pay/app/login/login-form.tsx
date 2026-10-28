"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";

function getAppPath(path: string) {
  const pathname = window.location.pathname;
  const loginSuffix = "/login";
  const basePath = pathname.endsWith(loginSuffix)
    ? pathname.slice(0, -loginSuffix.length)
    : "";
  return `${basePath}${path}`;
}

export default function LoginForm() {
  const router = useRouter();
  const configured = Boolean(getSupabaseConfig());
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!configured) {
      setError("A ligação ao Supabase ainda não está configurada.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace(getAppPath("/dashboard"));
        router.refresh();
        return;
      }

      const callbackPath = getAppPath("/auth/callback");
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${callbackPath}`
        }
      });
      if (authError) throw authError;

      if (data.session) {
        router.replace(getAppPath("/dashboard"));
        router.refresh();
      } else {
        setMessage("Conta criada. Confirme o endereço de email para concluir o registo.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir o pedido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-heading">
        <Link className="auth-brand" href="/">
          <span className="auth-brand-mark">N</span>
          <span>Nevon<span>Pay</span></span>
        </Link>

        <p className="auth-eyebrow">ACESSO SEGURO</p>
        <h1 id="auth-heading">{mode === "login" ? "Bem-vindo de volta" : "Criar conta"}</h1>
        <p className="auth-description">
          {mode === "login"
            ? "Entre na sua conta para aceder ao dashboard."
            : "Registe-se com email e palavra-passe para começar."}
        </p>

        {!configured ? (
          <div className="auth-alert" role="status">
            O Supabase ainda não está configurado neste ambiente. A autenticação ficará disponível
            depois de ligar o projecto Supabase.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="auth-label" htmlFor="email">Email</label>
            <input
              className="auth-input"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label className="auth-label" htmlFor="password">Palavra-passe</label>
            <input
              className="auth-input"
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error && <p className="auth-error" role="alert">{error}</p>}
            {message && <p className="auth-success" role="status">{message}</p>}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "A processar..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        )}

        {configured && (
          <p className="auth-switch">
            {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
            <button
              className="auth-switch-button"
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
                setMessage("");
              }}
            >
              {mode === "login" ? "Criar conta" : "Entrar"}
            </button>
          </p>
        )}

        <Link className="auth-back" href="/">Voltar ao Nevon Pay</Link>
      </section>
    </main>
  );
}
