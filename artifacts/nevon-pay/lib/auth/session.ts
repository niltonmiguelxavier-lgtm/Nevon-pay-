import { createClient as createSupabaseJsClient, type SupabaseClient, type User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig, type SupabaseConfig } from "@/lib/env";

export type AuthenticatedUser = {
  supabase: SupabaseUser;
  profileId: string;
};

export type AuthenticatedAuthContext = AuthenticatedUser & {
  client: SupabaseClient;
  bearerToken: string | null;
  config: SupabaseConfig;
};

export function extractBearerToken(req?: Request): string | null {
  const header = req?.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

/**
 * Resolve o utilizador autenticado a partir de `Authorization: Bearer <jwt>`
 * (usado pela app móvel) ou pelos cookies de sessão SSR (usados pelo site).
 * Valida sempre o token junto do servidor Supabase Auth com `getUser()`.
 */
export async function getAuthenticatedAuthContext(req?: Request): Promise<AuthenticatedAuthContext | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    const bearerToken = extractBearerToken(req);
    const client = bearerToken
      ? createSupabaseJsClient(config.url, config.publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        })
      : await createClient();

    const { data, error } = bearerToken
      ? await client.auth.getUser(bearerToken)
      : await client.auth.getUser();

    if (error || !data.user) return null;

    return {
      supabase: data.user,
      profileId: data.user.id,
      client,
      bearerToken,
      config,
    };
  } catch {
    return null;
  }
}

export async function requireAuthenticatedAuthContext(req?: Request): Promise<AuthenticatedAuthContext> {
  const context = await getAuthenticatedAuthContext(req);
  if (!context) {
    const error = new Error("Sessão inválida ou expirada.");
    (error as Error & { code?: string }).code = "UNAUTHENTICATED";
    throw error;
  }
  return context;
}

export async function getAuthenticatedUser(req?: Request): Promise<AuthenticatedUser | null> {
  const context = await getAuthenticatedAuthContext(req);
  if (!context) return null;
  return { supabase: context.supabase, profileId: context.profileId };
}

export async function requireAuthenticatedUser(req?: Request): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    const error = new Error("Sessão inválida ou expirada.");
    (error as Error & { code?: string }).code = "UNAUTHENTICATED";
    throw error;
  }
  return user;
}
