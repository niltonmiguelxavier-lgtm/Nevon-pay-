import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/update-session";

/**
 * O middleware antes só cobria `/dashboard/:path*`, pelo que a sessão nunca era
 * renovada noutras páginas (a sessão parecia "perder-se" ao voltar ao
 * dashboard depois de algum tempo) e as rotas privadas fora desse prefixo não
 * eram verificadas. Passa a correr em todas as rotas relevantes.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)",
  ],
};
