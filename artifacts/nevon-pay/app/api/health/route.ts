import { json, requestId } from "@/lib/http";
import { checkDatabase, databaseProvider, databaseTarget, databaseWarning } from "@/lib/db";
import { getAppEnv, getEmailConfig, getSupabaseConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = requestId(req);
  const status = await checkDatabase();
  const supabase = getSupabaseConfig();
  const email = getEmailConfig();

  const healthy = status.database === "healthy" && status.schema === "ready";

  const response = json(
    {
      success: healthy,
      application: "healthy",
      database: status.database,
      database_schema: status.schema,
      database_provider: databaseProvider,
      database_target: databaseTarget,
      env_warning: databaseWarning,
      supabase_auth_configured: Boolean(supabase),
      email_configured: email.enabled,
      email_provider: email.enabled ? email.provider : null,
      email_status: email.enabled ? "configured" : email.reason,
      environment: getAppEnv(),
    },
    healthy ? 200 : 503,
    id
  );

  return response;
}
