import { z } from "zod";
import { db } from "@/lib/db";
import { corsPreflight, json, requestId } from "@/lib/http";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { authErrorMessage } from "@/lib/auth/errors";
import { handleApiError } from "@/lib/api/errors";
import { syncSupabaseUser } from "@/lib/auth/sync-user";

const schema = z.object({
  name: z.string().min(2, "O nome tem de ter pelo menos 2 caracteres.").max(120),
  email: z.string().email("Email inválido.").optional(),
  currency: z.string().length(3).default("MZN"),
});

/**
 * Lista os espaços de trabalho do utilizador autenticado.
 * Antes esta rota só aceitava POST anónimo, o que permitia criar comerciantes
 * sem autenticação nenhuma.
 */
export async function GET(req: Request) {
  const rid = requestId(req);
  try {
    const { supabase } = await requireAuthenticatedUser(req);
    const links = await db.merchantUser.findMany({
      where: { userId: supabase.id },
      orderBy: { createdAt: "asc" },
      select: {
        merchant: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            createdAt: true,
            wallets: { select: { currency: true, balance: true } },
            _count: { select: { apiKeys: true, payments: true } },
          },
        },
      },
    });
    return json({ success: true, data: links.map((link) => link.merchant) }, 200, rid);
  } catch (error) {
    if ((error as { code?: string }).code === "UNAUTHENTICATED") {
      return json(
        { success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão para consultar os espaços de trabalho." } },
        401,
        rid
      );
    }
    return handleApiError(error, rid);
  }
}

/**
 * Cria um espaço de trabalho (comerciante) para o utilizador autenticado.
 * Exige sessão Supabase válida e garante o perfil em PostgreSQL antes de criar
 * as relações — o que faltava no fluxo de registo (a conta ficava sem espaço).
 */
export async function POST(req: Request) {
  const rid = requestId(req);
  try {
    const { supabase } = await requireAuthenticatedUser(req);
    const input = schema.parse(await req.json());

    const profile = await syncSupabaseUser(supabase);

    const merchant = await db.merchant.create({
      data: {
        name: input.name,
        email: (input.email || profile.email).toLowerCase(),
        status: "ACTIVE",
        users: { create: { userId: profile.id } },
        wallets: { create: { currency: input.currency.toUpperCase() } },
      },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });

    await db.auditLog.create({
      data: {
        actorId: profile.id,
        merchantId: merchant.id,
        action: "merchant.created",
        resource: "Merchant",
        resourceId: merchant.id,
        requestId: rid,
      },
    });

    return json({ success: true, merchant }, 201, rid);
  } catch (error) {
    if ((error as { code?: string }).code === "UNAUTHENTICATED") {
      return json(
        { success: false, error: { code: "UNAUTHENTICATED", message: "Inicie sessão para criar um espaço de trabalho." } },
        401,
        rid
      );
    }
    if ((error as { code?: string }).code === "EMAIL_IN_USE") {
      return json(
        { success: false, error: { code: "PROFILE_CONFLICT", message: authErrorMessage(error as { message?: string; code?: string }) } },
        409,
        rid
      );
    }
    return handleApiError(error, rid);
  }
}

export function OPTIONS() {
  return corsPreflight("GET, POST, OPTIONS");
}
