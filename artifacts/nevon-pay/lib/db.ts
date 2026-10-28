import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const supabaseDatabaseUrl = process.env.SUPABASE_DATABASE_URL;

export const databaseProvider = supabaseDatabaseUrl ? "supabase" : "replit-development";
export const db = globalForPrisma.prisma ?? new PrismaClient(
  supabaseDatabaseUrl ? { datasources: { db: { url: supabaseDatabaseUrl } } } : undefined
);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
