import { NextResponse, type NextRequest } from "next/server";
import { syncSupabaseUser } from "@/lib/auth/sync-user";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env";
import { absoluteUrl, requestOrigin } from "@/lib/http";

function appPath(request: NextRequest, destination: string, query = "") {
  const url = new URL(request.url);
  const callbackIndex = url.pathname.lastIndexOf("/auth/callback");
  const prefix = callbackIndex >= 0 ? url.pathname.slice(0, callbackIndex) : "";
  // Usa o host público (x-forwarded-host) e não o endereço interno do servidor.
  const target = new URL(`${prefix}${destination}`, requestOrigin(request));
  target.search = query;
  return target;
}

/** Só permite redireccionamentos internos (evita open redirect). */
function safeNext(request: NextRequest, next: string | null, fallback: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export async function GET(request: NextRequest) {
  if (!getSupabaseConfig()) {
    return NextResponse.redirect(appPath(request, "/login", "?error=supabase"));
  }

  const search = request.nextUrl.searchParams;

  // O Supabase devolve os erros na query string (link expirado, já usado, etc.).
  const providerError = search.get("error_code") || search.get("error");
  if (providerError) {
    const code = providerError === "otp_expired" || providerError === "token_expired" ? "link_expired" : "auth_callback";
    return NextResponse.redirect(appPath(request, "/login", `?error=${code}`));
  }

  const code = search.get("code");
  const tokenHash = search.get("token_hash");
  const type = search.get("type");

  const supabase = await createClient();

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return NextResponse.redirect(appPath(request, "/login", "?error=auth_callback"));
    } else if (tokenHash && type) {
      // Suporta os links de email com token_hash (confirmação, recuperação, email change).
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as never });
      if (error) return NextResponse.redirect(appPath(request, "/login", "?error=auth_callback"));
    } else {
      return NextResponse.redirect(appPath(request, "/login", "?error=auth_callback"));
    }
  } catch {
    return NextResponse.redirect(appPath(request, "/login", "?error=auth_callback"));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(appPath(request, "/login", "?error=auth_callback"));
  }

  // Recuperação de palavra-passe: a sessão de recuperação serve para definir a
  // nova palavra-passe, não para entrar directamente no dashboard.
  if (type === "recovery") {
    return NextResponse.redirect(appPath(request, "/auth/redefinir"));
  }

  try {
    await syncSupabaseUser(user);
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.redirect(
      appPath(request, "/login", code === "EMAIL_IN_USE" ? "?error=account_conflict" : "?error=database")
    );
  }

  const next = safeNext(request, search.get("next"), "/dashboard");
  return NextResponse.redirect(appPath(request, next));
}
