import { NextResponse, type NextRequest } from "next/server";
import { syncSupabaseUser } from "@/lib/auth/sync-user";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

function appPath(request: NextRequest, destination: string, query = "") {
  const url = new URL(request.url);
  const callbackIndex = url.pathname.lastIndexOf("/auth/callback");
  const prefix = callbackIndex >= 0 ? url.pathname.slice(0, callbackIndex) : "";
  url.pathname = `${prefix}${destination}`;
  url.search = query;
  return url;
}

export async function GET(request: NextRequest) {
  if (!getSupabaseConfig()) {
    return NextResponse.redirect(appPath(request, "/login", "?setup=supabase"));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(appPath(request, "/login", "?error=auth_callback"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(appPath(request, "/login", "?error=auth_callback"));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    try {
      await syncSupabaseUser(user);
    } catch {
      return NextResponse.redirect(appPath(request, "/dashboard?profile=sync_pending"));
    }
  }

  return NextResponse.redirect(appPath(request, "/dashboard"));
}
