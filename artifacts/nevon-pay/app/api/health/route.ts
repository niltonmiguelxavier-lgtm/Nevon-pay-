import { databaseProvider, db } from "@/lib/db";
import { json, requestId } from "@/lib/http";

export async function GET(req: Request) {
  const id = requestId(req);
  try {
    await db.$queryRaw`SELECT 1`;
    return json({
      success: true,
      application: "healthy",
      database: "healthy",
      database_provider: databaseProvider,
      supabase_auth_configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      environment: process.env.APP_ENV || "development"
    }, 200, id);
  } catch {
    return json({ success: false, application: "healthy", database: "unavailable" }, 503, id);
  }
}
