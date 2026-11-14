/**
 * Resolução e validação central das variáveis de ambiente.
 *
 * Regras (documentadas em README.md e .env.example):
 *  - `DATABASE_URL` é a variável canónica usada pelo Prisma (CLI e runtime).
 *  - `SUPABASE_DATABASE_URL` só é usada como alternativa quando `DATABASE_URL`
 *    não está definida. Isto evita o conflito anterior, em que a aplicação
 *    ignorava silenciosamente `DATABASE_URL` e escrevia noutra base de dados.
 *  - Se ambas estiverem definidas e apontarem para servidores diferentes,
 *    a aplicação reporta um aviso explícito (sem expor credenciais) em
 *    `/api/health` e nos logs de arranque.
 */

export type DatabaseConfig = {
  url: string;
  source: "DATABASE_URL" | "SUPABASE_DATABASE_URL";
  host: string;
  database: string;
  warning: string | null;
};

function parseDatabaseUrl(raw: string) {
  const parsed = new URL(raw);
  if (!parsed.protocol.startsWith("postgres")) {
    throw new Error(`A ligação à base de dados tem de ser PostgreSQL (recebido "${parsed.protocol}").`);
  }
  return {
    host: parsed.hostname,
    database: parsed.pathname.replace(/^\//, "") || "postgres",
  };
}

export function getDatabaseConfig(): DatabaseConfig | null {
  const primary = process.env.DATABASE_URL?.trim();
  const secondary = process.env.SUPABASE_DATABASE_URL?.trim();

  if (!primary && !secondary) return null;

  const source: DatabaseConfig["source"] = primary ? "DATABASE_URL" : "SUPABASE_DATABASE_URL";
  const url = (primary || secondary) as string;
  const { host, database } = parseDatabaseUrl(url);

  let warning: string | null = null;
  if (primary && secondary) {
    try {
      const other = parseDatabaseUrl(secondary);
      if (other.host !== host || other.database !== database) {
        warning =
          `DATABASE_URL e SUPABASE_DATABASE_URL apontam para bases de dados diferentes ` +
          `(${host}/${database} vs ${other.host}/${other.database}). ` +
          `A aplicação usa DATABASE_URL. Remova ou alinhe SUPABASE_DATABASE_URL.`;
      }
    } catch {
      warning = "SUPABASE_DATABASE_URL está definida mas não é um URL PostgreSQL válido; foi ignorada.";
    }
  }

  return { url, source, host, database, warning };
}

export type SupabaseConfig = { url: string; publishableKey: string };

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (!url || !publishableKey) return null;
  if (!/^https?:\/\//.test(url)) return null;
  return { url: url.replace(/\/$/, ""), publishableKey };
}

/** Base pública da aplicação, usada para links de email (confirmação/recuperação). */
export function getPublicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export type EmailConfig =
  | { enabled: false; reason: string }
  | { enabled: true; provider: "resend" | "brevo" | "webhook"; apiKey: string; from: string; endpoint?: string };

/**
 * Configuração de envio de email. Enquanto não estiver preenchida, as
 * notificações por email ficam registadas como "não enviadas" — nunca
 * marcamos um email como entregue sem resposta favorável do provedor.
 */
export function getEmailConfig(): EmailConfig {
  const provider = (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  const apiKey = (process.env.EMAIL_API_KEY || "").trim();
  const from = (process.env.EMAIL_FROM || "").trim();

  if (!provider) return { enabled: false, reason: "EMAIL_PROVIDER não está definido." };
  if (!apiKey) return { enabled: false, reason: "EMAIL_API_KEY não está definido." };
  if (!from) return { enabled: false, reason: "EMAIL_FROM não está definido." };

  if (provider === "resend" || provider === "brevo") return { enabled: true, provider, apiKey, from };
  if (provider === "webhook") {
    const endpoint = (process.env.EMAIL_WEBHOOK_URL || "").trim();
    if (!endpoint) return { enabled: false, reason: "EMAIL_WEBHOOK_URL não está definido." };
    return { enabled: true, provider, apiKey, from, endpoint };
  }

  return { enabled: false, reason: `EMAIL_PROVIDER "${provider}" não é suportado (use resend, brevo ou webhook).` };
}

export function getAppEnv() {
  return process.env.APP_ENV || process.env.NODE_ENV || "development";
}
