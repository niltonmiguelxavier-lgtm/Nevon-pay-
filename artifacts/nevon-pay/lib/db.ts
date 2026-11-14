import { PrismaClient } from "@prisma/client";
import { getDatabaseConfig } from "./env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaUrl?: string;
};

const config = getDatabaseConfig();

if (!config) {
  throw new Error(
    "Nenhuma ligação à base de dados configurada. Defina DATABASE_URL " +
      "(ou SUPABASE_DATABASE_URL) com a connection string PostgreSQL do Supabase."
  );
}

if (config.warning) {
  console.warn(`[nevon-pay][env] ${config.warning}`);
}

/** Fonte efectiva da ligação, exposta em /api/health para diagnóstico. */
export const databaseProvider = config.source === "DATABASE_URL" ? "database_url" : "supabase_database_url";
export const databaseTarget = `${config.host}/${config.database}`;
export const databaseWarning = config.warning;

// Reutiliza a instância em desenvolvimento para não esgotar ligações ao Postgres.
const cachedClient = globalForPrisma.prismaUrl === config.url ? globalForPrisma.prisma : undefined;

export const db =
  cachedClient ??
  new PrismaClient({
    datasources: { db: { url: config.url } },
    log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaUrl = config.url;
}

/** Confirma que o Postgres responde e que as tabelas do Nevon Pay existem. */
export async function checkDatabase() {
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    return {
      database: "unavailable" as const,
      detail: error instanceof Error ? error.message.split("\n")[0] : "Erro desconhecido",
      schema: "unknown" as const,
    };
  }

  try {
    const rows = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('User', 'Merchant', 'Payment', 'CheckoutSession', 'Notification')
    `;
    const count = Number(rows[0]?.count ?? 0);
    return {
      database: "healthy" as const,
      detail: null,
      schema: count === 5 ? ("ready" as const) : ("missing_tables" as const),
      tables: count,
    };
  } catch (error) {
    return {
      database: "healthy" as const,
      detail: error instanceof Error ? error.message.split("\n")[0] : "Erro desconhecido",
      schema: "unknown" as const,
    };
  }
}
