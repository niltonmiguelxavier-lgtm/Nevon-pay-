import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

function isDashboardPath(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function withLoginPath(request: NextRequest) {
  const url = request.nextUrl.clone();
  const dashboardIndex = url.pathname.indexOf("/dashboard");
  const prefix = dashboardIndex >= 0 ? url.pathname.slice(0, dashboardIndex) : "";
  url.pathname = `${prefix}/login`;
  url.searchParams.set("next", `${prefix}/dashboard`);
  return url;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();

  if (!config) {
    return isDashboardPath(request.nextUrl.pathname)
      ? NextResponse.redirect(withLoginPath(request))
      : response;
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
      }
    }
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (isDashboardPath(request.nextUrl.pathname) && (error || !claims?.sub)) {
    const redirect = NextResponse.redirect(withLoginPath(request));
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}
