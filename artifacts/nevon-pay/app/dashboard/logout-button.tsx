"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Logout: termina a sessão no browser e no servidor (rota /auth/logout), que
 * limpa os cookies SSR. Antes só o cliente fazia `signOut()`, pelo que um
 * refresh imediato podia reabrir o dashboard com a sessão ainda válida.
 */
export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // A rota do servidor trata do resto mesmo que o cliente falhe.
    } finally {
      window.location.assign("/auth/logout");
    }
  }

  return (
    <button className="auth-secondary np-logout-button" style={{ whiteSpace: "nowrap", minHeight: 36, padding: "0 11px", fontSize: 12 }} type="button" onClick={signOut} disabled={busy} data-testid="logout-button" aria-label={busy ? "A terminar sessão" : "Terminar sessão"} title="Terminar sessão">
      <LogOut size={15} aria-hidden="true" />
      <span>{busy ? "A terminar sessão…" : "Terminar sessão"}</span>
    </button>
  );
}
