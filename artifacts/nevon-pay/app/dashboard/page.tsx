import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import { syncSupabaseUser } from "@/lib/auth/sync-user";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  if (!getSupabaseConfig()) redirect("/login?error=supabase");

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=/dashboard");

  // O perfil tem de existir em PostgreSQL antes de o dashboard pedir dados.
  // Antes o erro era ignorado e o utilizador via um dashboard vazio sem saber
  // que a sincronização com a base de dados tinha falhado.
  try {
    await syncSupabaseUser(user);
  } catch (syncError) {
    const code = (syncError as { code?: string }).code;
    redirect(code === "EMAIL_IN_USE" ? "/login?error=account_conflict" : "/login?error=database");
  }

  return <DashboardClient />;
}
