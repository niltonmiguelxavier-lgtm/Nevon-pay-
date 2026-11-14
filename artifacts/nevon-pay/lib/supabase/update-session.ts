import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/env";
import { requestOrigin } from "@/lib/http";

/** Rotas que exigem sessão. */
const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Rotas de autenticação onde um utilizador com sessão é enviado para o
 * dashboard. `/auth/redefinir` fica de fora porque a sessão de recuperação é
 * autenticada e tem de poder definir a nova palavra-passe.
 */
const AUTH_ROUTES = ["/login"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function withPath(request: NextRequest, pathname: string, query?: Record<string, string>) {
  const current = request.nextUrl;
  const suffix = PROTECTED_PREFIXES.find((prefix) => current.pathname.includes(prefix));
  const prefix = suffix ? current.pathname.slice(0, current.pathname.indexOf(suffix)) : "";
  const url = new URL(`${prefix}${pathname}`, requestOrigin(request));
  if (query) for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url;
}

/**
 * Renova a sessão Supabase (rotação de refresh token) e aplica a protecção de
 * rotas. Devolver sempre o `response` com os cookies renovados é essencial para
 * que a sessão persista entre pedidos.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  const pathname = request.nextUrl.pathname;

  if (!config) {
    return isProtected(pathname) ? NextResponse.redirect(withPath(request, "/login", { error: "supabase" })) : response;
  }

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const authenticated = Boolean(claims?.sub) && !error;

  if (isProtected(pathname) && !authenticated) {
    const redirect = NextResponse.redirect(withPath(request, "/login", { next: "/dashboard" }));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  // Sessão activa não deve voltar ao formulário de login.
  if (isAuthRoute(pathname) && authenticated && !request.nextUrl.searchParams.has("message")) {
    const redirect = NextResponse.redirect(withPath(request, "/dashboard"));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}
