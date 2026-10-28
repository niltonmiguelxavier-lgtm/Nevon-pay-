"use client";

import { createClient } from "@/lib/supabase/client";

function getLoginPath() {
  const pathname = window.location.pathname;
  const dashboardIndex = pathname.lastIndexOf("/dashboard");
  const basePath = dashboardIndex >= 0 ? pathname.slice(0, dashboardIndex) : "";
  return `${basePath}/login`;
}

export default function LogoutButton() {
  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign(getLoginPath());
  }

  return <button className="auth-secondary" type="button" onClick={signOut}>Terminar sessão</button>;
}
