import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export class ProfileSyncError extends Error {
  code: "MISSING_EMAIL" | "EMAIL_IN_USE" | "DATABASE";
  constructor(code: ProfileSyncError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "ProfileSyncError";
  }
}

/**
 * Mantém a tabela `User` (PostgreSQL) alinhada com o utilizador do Supabase Auth.
 *
 * O upsert anterior usava `where: { id }` sobre uma coluna `email` única: quando
 * já existia um perfil com o mesmo email mas outro id (conta apagada e recriada,
 * ou perfil criado manualmente), o Prisma lançava um erro de constraint que era
 * engolido por um `catch` vazio — o utilizador entrava mas ficava sem perfil.
 * Aqui o conflito é detectado e reportado com um código próprio.
 */
export async function syncSupabaseUser(user: SupabaseUser) {
  if (!user.email) {
    throw new ProfileSyncError("MISSING_EMAIL", "A conta autenticada não tem um endereço de email.");
  }

  const email = user.email.toLowerCase();
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const name = typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : null;

  try {
    const existingById = await db.user.findUnique({ where: { id: user.id } });
    const existingByEmail = await db.user.findUnique({ where: { email } });

    if (existingByEmail && existingByEmail.id !== user.id) {
      throw new ProfileSyncError(
        "EMAIL_IN_USE",
        `Já existe um perfil (${existingByEmail.id}) com o email ${email}, diferente do utilizador autenticado (${user.id}).`
      );
    }

    if (existingById) {
      const needsUpdate = existingById.email !== email || (name && existingById.name !== name);
      if (!needsUpdate) return existingById;
      return await db.user.update({ where: { id: user.id }, data: { email, ...(name ? { name } : {}) } });
    }

    return await db.user.create({
      data: { id: user.id, email, name, role: "USER" },
    });
  } catch (error) {
    if (error instanceof ProfileSyncError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ProfileSyncError("EMAIL_IN_USE", `O email ${email} já está associado a outro perfil.`);
    }
    throw new ProfileSyncError(
      "DATABASE",
      error instanceof Error ? error.message : "Não foi possível sincronizar o perfil com a base de dados."
    );
  }
}

/** Espaços de trabalho (comerciantes) a que o utilizador pertence. */
export async function getUserMerchants(userId: string) {
  return db.merchantUser.findMany({
    where: { userId },
    select: { merchant: { select: { id: true, name: true, status: true } } },
    orderBy: { createdAt: "asc" },
  });
}
