import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env";
import { requestOrigin } from "@/lib/http";

/**
 * Logout do lado do servidor: invalida a sessão no Supabase e limpa os cookies
 * de sessão na resposta. O botão anterior chamava `signOut()` apenas no
 * browser, o que deixava os cookies SSR válidos até expirarem e permitia que
 * um `refresh` reabrisse o dashboard.
 */
export async function POST(request: NextRequest) {
  if (getSupabaseConfig()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Mesmo que o Supabase falhe, limpamos os cookies abaixo.
    }
  }

  const url = new URL(request.url);
  const callbackIndex = url.pathname.lastIndexOf("/auth/logout");
  const prefix = callbackIndex >= 0 ? url.pathname.slice(0, callbackIndex) : "";
  const target = new URL(`${prefix}/login`, requestOrigin(request));
  target.search = "?message=sessao_terminada";

  const response = NextResponse.redirect(target, { status: 303 });
  // Remove todos os cookies sb-* (auth token, refresh token, code verifier).
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
  return response;
}

export async function GET(request: NextRequest) {
  return POST(request);
}
