import type { User as SupabaseUser } from "@supabase/supabase-js";
import { db } from "@/lib/db";

export async function syncSupabaseUser(user: SupabaseUser) {
  if (!user.email) throw new Error("A conta autenticada não tem um endereço de email.");

  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const name = typeof metadataName === "string" ? metadataName : null;

  return db.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email,
      name,
      role: "USER"
    },
    update: {
      email: user.email,
      name
    }
  });
}
