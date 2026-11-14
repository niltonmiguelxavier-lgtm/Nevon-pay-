import { db } from "@/lib/db";
import { renderNotificationEmail, sendEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/env";

export type NotificationSeverity = "info" | "attention" | "critical";

export type NotificationInput = {
  merchantId: string;
  type: string;
  title: string;
  description: string;
  severity?: NotificationSeverity;
};

/**
 * Cria a notificação para todos os utilizadores ligados ao comerciante e tenta
 * o envio por email. Nunca inventa sucesso: se o provedor não estiver
 * configurado, a notificação fica registada como não enviada.
 */
export async function notifyMerchantUsers(input: NotificationInput) {
  const links = await db.merchantUser.findMany({
    where: { merchantId: input.merchantId },
    select: { user: { select: { id: true, email: true } } },
  });

  if (links.length === 0) return { created: 0, emailed: 0 };

  const created = await db.notification.createManyAndReturn({
    data: links.map(({ user }) => ({
      userId: user.id,
      merchantId: input.merchantId,
      type: input.type,
      title: input.title,
      description: input.description,
      severity: input.severity ?? "info",
    })),
    select: { id: true, userId: true, title: true, description: true },
  });

  let emailed = 0;
  let lastError: string | null = null;
  const appUrl = getPublicAppUrl();

  for (const notification of created) {
    const recipient = links.find((link) => link.user.id === notification.userId)?.user;
    if (!recipient?.email) continue;

    const message = renderNotificationEmail({
      title: notification.title,
      description: notification.description,
      appUrl,
    });
    const result = await sendEmail({ to: recipient.email, ...message });

    if (result.sent) {
      emailed += 1;
      await db.notification.update({
        where: { id: notification.id },
        data: { emailedAt: new Date(), emailError: null },
      });
    } else if (!result.skipped) {
      lastError = result.error;
      await db.notification.update({
        where: { id: notification.id },
        data: { emailError: result.error.slice(0, 500) },
      });
    }
  }

  return { created: created.length, emailed, error: lastError };
}

export async function listNotifications(userId: string, options?: { limit?: number; unreadOnly?: boolean }) {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  return db.notification.findMany({
    where: { userId, ...(options?.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      severity: true,
      readAt: true,
      emailedAt: true,
      createdAt: true,
    },
  });
}

export async function countUnread(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(userId: string, id: string) {
  // O filtro por userId garante que um utilizador não marca notificações alheias.
  const result = await db.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await db.notification.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) return { ok: false as const, reason: "NOT_FOUND" as const };
  }
  return { ok: true as const };
}

export async function markAllNotificationsRead(userId: string) {
  const result = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
