import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import AdminPanel from "./panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Nevon Pay", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=/admin");

  // Independent server-side guard: direct URL access is not permission.
  const profile = await db.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (!profile || profile.role !== "ADMIN") redirect("/dashboard");

  return <AdminPanel />;
}
