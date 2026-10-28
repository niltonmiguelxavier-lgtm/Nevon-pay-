import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import { syncSupabaseUser } from "@/lib/auth/sync-user";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export default async function Dashboard() {
  if (!getSupabaseConfig()) redirect("/login?setup=supabase");

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  try {
    await syncSupabaseUser(user);
  } catch {
    // Keep the authenticated dashboard available; the data API renders the
    // database connection error without substituting fictitious figures.
  }

  return <DashboardClient />;
}
