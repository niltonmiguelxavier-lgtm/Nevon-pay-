"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";

function getAppPath(path: string) {
  const pathname = window.location.pathname;
  const loginSuffix = "/login";
  const basePath = pathname.endsWith(loginSuffix) ? pathname.slice(0, -loginSuffix.length) : "";
  return `${basePath}${path}`;
}

type Props = {
  configured: boolean;
  initialEmail?: string;
  initialError?: string;
  initialMessage?: string;
};

export default function LoginForm({ configured, initialEmail = "", initialError = "", initialMessage = "" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState(initialError);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resending, setResending] = useState(false);

  function reset() {
    setError("");
    setMessage("");
    setPendingEmail("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!configured) {
      setError("A ligação ao Supabase ainda não está configurada.");
      return;
    }
    if (mode === "signup") {
      if (name.trim().length < 2) { setError("Indique o seu nome completo (pelo menos 2 caracteres)."); return; }
      if (password.length < 8) { setError("A palavra-passe deve ter pelo menos 8 caracteres."); return; }
      if (password !== confirmPassword) { setError("As palavras-passe não coincidem."); return; }
    }

    setBusy(true);
    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (authError) {
          if (authError.code === "email_not_confirmed" || /email not confirmed/i.test(authError.message)) {
            setPendingEmail(email.trim().toLowerCase());
          }
          throw authError;
        }
        router.replace(getAppPath("/dashboard"));
        router.refresh();
        return;
      }

      const callbackPath = getAppPath("/auth/callback");
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${callbackPath}`,
          data: name.trim() ? { full_name: name.trim() } : undefined,
        },
      });
      if (authError) throw authError;

      if (data.session) {
        router.replace(getAppPath("/dashboard"));
        router.refresh();
        return;
      }

      setPendingEmail(email.trim().toLowerCase());
      setMessage(
        "Conta criada. Enviámos um email de confirmação — abra o link para activar a conta e só depois inicie sessão."
      );
      setPassword("");
    } catch (caught) {
      setError(authErrorMessage(caught as { message?: string; code?: string }));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!pendingEmail) return;
    setResending(true);
    setError("");
    setMessage("");
    try {
      const { error: authError } = await createClient().auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: `${window.location.origin}${getAppPath("/auth/callback")}` },
      });
      if (authError) throw authError;
      setMessage("Email de confirmação reenviado. Verifique a caixa de entrada e a pasta de spam.");
    } catch (caught) {
      setError(authErrorMessage(caught as { message?: string; code?: string }));
    } finally {
      setResending(false);
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
            : "Registe-se com email e palavra-passe. Vai receber um email para confirmar a conta."}
        </p>

        {!configured ? (
          <div className="auth-alert" role="status">
            O Supabase ainda não está configurado neste ambiente. A autenticação ficará disponível depois de
            definir NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {mode === "signup" && (
              <>
                <label className="auth-label" htmlFor="name">Nome completo</label>
                <input
                  className="auth-input"
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </>
            )}

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
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="button" className="auth-switch-button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword} style={{ marginTop: 8 }}>
              {showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
            </button>
            {mode === "signup" && (
              <>
                <p className="auth-description" style={{ margin: "6px 0 0", fontSize: 12 }}>
                  Use pelo menos 8 caracteres. A confirmação da conta será enviada para este email.
                </p>
                <label className="auth-label" htmlFor="confirm-password">Confirmar palavra-passe</label>
                <input className="auth-input" id="confirm-password" name="confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </>
            )}

            {error && <p className="auth-error" role="alert">{error}</p>}
            {message && <p className="auth-success" role="status">{message}</p>}

            {pendingEmail && (
              <button className="auth-secondary" type="button" onClick={resendConfirmation} disabled={resending}
                style={{ marginTop: 12, width: "100%" }}>
                {resending ? "A reenviar..." : "Reenviar email de confirmação"}
              </button>
            )}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "A processar..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        )}

        {configured && (
          <>
            {mode === "login" && (
              <p className="auth-switch" style={{ marginBottom: 0 }}>
                <Link className="auth-switch-button" href="/auth/recuperar">Esqueceu-se da palavra-passe?</Link>
              </p>
            )}
            <p className="auth-switch">
              {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
              <button
                className="auth-switch-button"
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  reset();
                }}
              >
                {mode === "login" ? "Criar conta" : "Entrar"}
              </button>
            </p>
          </>
        )}

        <Link className="auth-back" href="/">Voltar ao Nevon Pay</Link>
      </section>
    </main>
  );
}
