import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, json, requestId } from "@/lib/http";
import { getAdminIdentity } from "@/lib/auth/admin";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const inputSchema = z.object({ status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]) });

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const rid = requestId(req);
  const admin = await getAdminIdentity();
  if (!admin) return apiError("FORBIDDEN", "Acesso administrativo não autorizado.", 403, rid);

  const limit = rateLimit(`admin-merchant-status:${admin.id}`, { max: 20, windowSeconds: 60 });
  if (!limit.allowed) {
    return Response.json({ success: false, error: { code: "RATE_LIMITED", message: "Demasiadas alterações administrativas. Tente novamente dentro de instantes." }, request_id: rid }, { status: 429, headers: { ...rateLimitHeaders(limit), "X-Request-ID": rid, "Cache-Control": "no-store" } });
  }

  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_STATUS", "Estado de comerciante inválido.", 400, rid);
  const { id } = await context.params;

  try {
    const updated = await db.$transaction(async (tx) => {
      const current = await tx.merchant.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
      if (!current) return null;
      if (current.status === parsed.data.status) return current;
      const merchant = await tx.merchant.update({ where: { id }, data: { status: parsed.data.status }, select: { id: true, name: true, status: true } });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          merchantId: merchant.id,
          action: "merchant.status_changed",
          resource: "Merchant",
          resourceId: merchant.id,
          requestId: rid,
          metadata: { from: current.status, to: merchant.status },
        },
      });
      return merchant;
    });
    if (!updated) return apiError("MERCHANT_NOT_FOUND", "Comerciante não encontrado.", 404, rid);
    return json({ success: true, merchant: updated }, 200, rid);
  } catch (error) {
    console.error(`[admin-merchant-status][${rid}]`, error);
    return apiError("ADMIN_UPDATE_FAILED", "Não foi possível actualizar o estado do comerciante.", 500, rid);
  }
}
