import type { PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { notifyMerchantUsers } from "@/lib/notifications";

export const CANCELLABLE_STATUSES: PaymentStatus[] = ["OPEN", "PENDING"];
export const FINAL_STATUSES: PaymentStatus[] = ["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"];

export function isFinalStatus(status: PaymentStatus) {
  return FINAL_STATUSES.includes(status);
}

/**
 * Marca a sessão (e o pagamento associado) como EXPIRED quando o prazo passou.
 * Antes esta verificação só existia no GET da sessão, pelo que o dashboard
 * continuava a mostrar sessões "abertas" para sempre.
 */
export async function expireSessionIfNeeded(sessionId: string) {
  const session = await db.checkoutSession.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  if (session.status !== "OPEN" && session.status !== "PENDING") return session;
  if (session.expiresAt > new Date()) return session;

  const [updated] = await db.$transaction([
    db.checkoutSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } }),
    db.payment.update({ where: { id: session.paymentId }, data: { status: "EXPIRED" } }),
  ]);

  await notifyMerchantUsers({
    merchantId: session.merchantId,
    type: "checkout.expired",
    title: "Checkout expirado",
    description: `A sessão de ${session.amount.toString()} ${session.currency} expirou sem pagamento.`,
    severity: "info",
  });

  return updated;
}

/** Expira em lote as sessões vencidas de um comerciante (chamado pelo dashboard). */
export async function expireStaleSessions(merchantIds: string[]) {
  if (merchantIds.length === 0) return 0;
  const stale = await db.checkoutSession.findMany({
    where: { merchantId: { in: merchantIds }, status: { in: ["OPEN", "PENDING"] }, expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  for (const { id } of stale) await expireSessionIfNeeded(id);
  return stale.length;
}

export type CancelOutcome =
  | { ok: true; alreadyCancelled: boolean; sessionId: string }
  | { ok: false; code: string; message: string; status: number };

/** Cancela uma sessão respeitando as transições de estado válidas. */
export async function cancelCheckoutSession(sessionId: string): Promise<CancelOutcome> {
  const session = await db.checkoutSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, code: "NOT_FOUND", message: "Checkout não encontrado.", status: 404 };

  const expired = await expireSessionIfNeeded(sessionId);
  const current = expired?.status ?? session.status;

  if (current === "CANCELLED") {
    return { ok: true, alreadyCancelled: true, sessionId };
  }
  if (current === "EXPIRED") {
    return { ok: false, code: "SESSION_EXPIRED", message: "A sessão já expirou e não pode ser cancelada.", status: 409 };
  }
  if (current === "COMPLETED") {
    return {
      ok: false,
      code: "SESSION_COMPLETED",
      message: "O pagamento já foi concluído; o cancelamento não é possível.",
      status: 409,
    };
  }
  if (!CANCELLABLE_STATUSES.includes(current)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Não é possível cancelar uma sessão no estado ${current}.`,
      status: 409,
    };
  }

  await db.$transaction([
    db.checkoutSession.update({ where: { id: sessionId }, data: { status: "CANCELLED" } }),
    db.payment.update({ where: { id: session.paymentId }, data: { status: "CANCELLED" } }),
  ]);

  await notifyMerchantUsers({
    merchantId: session.merchantId,
    type: "checkout.cancelled",
    title: "Checkout cancelado",
    description: `A sessão ${sessionId} (${session.amount.toString()} ${session.currency}) foi cancelada.`,
    severity: "attention",
  });

  return { ok: true, alreadyCancelled: false, sessionId };
}
