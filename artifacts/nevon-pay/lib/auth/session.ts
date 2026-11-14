import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env";

export type AuthenticatedUser = { supabase: SupabaseUser; profileId: string };

/**
 * Utilizador autenticado a partir dos cookies de sessão (SSR).
 * Usa `getUser()` (valida o token junto do Supabase) e não `getSession()`,
 * que confia apenas no cookie e não serve para decisões de autorização.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (!getSupabaseConfig()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { supabase: data.user, profileId: data.user.id };
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    const error = new Error("Sessão inválida ou expirada.");
    (error as Error & { code?: string }).code = "UNAUTHENTICATED";
    throw error;
  }
  return user;
}
