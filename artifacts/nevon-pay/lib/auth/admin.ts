import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export type AdminIdentity = {
  id: string;
  email: string;
  name: string | null;
};

/** Role is read from PostgreSQL on every request; never trust client metadata. */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const profile = await db.user.findUnique({
      where: { id: data.user.id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!profile || profile.role !== "ADMIN") return null;
    return { id: profile.id, email: profile.email, name: profile.name };
  } catch {
    return null;
  }
}
