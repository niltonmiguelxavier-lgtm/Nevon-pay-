import { db } from "@/lib/db";
import { apiError, json, requestId } from "@/lib/http";
import { getAdminIdentity } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rid = requestId(req);
  const admin = await getAdminIdentity();
  if (!admin) return apiError("FORBIDDEN", "Acesso administrativo não autorizado.", 403, rid);

  try {
    const [userCount, merchantCount, paymentCount, pendingMerchantCount, merchants, users, payments, auditLogs, paymentGroups] = await Promise.all([
      db.user.count(),
      db.merchant.count(),
      db.payment.count(),
      db.merchant.count({ where: { status: "PENDING" } }),
      db.merchant.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, status: true, createdAt: true, _count: { select: { payments: true, users: true } } },
      }),
      db.user.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      db.payment.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        select: { id: true, reference: true, amount: true, currency: true, status: true, provider: true, createdAt: true, merchant: { select: { id: true, name: true } } },
      }),
      db.auditLog.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        select: { id: true, actorId: true, merchantId: true, action: true, resource: true, resourceId: true, requestId: true, createdAt: true },
      }),
      db.payment.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    return json({
      success: true,
      admin: { email: admin.email, name: admin.name },
      summary: {
        users: userCount,
        merchants: merchantCount,
        payments: paymentCount,
        pendingMerchants: pendingMerchantCount,
        paymentStatuses: paymentGroups.map((row) => ({ status: row.status, count: row._count._all })),
      },
      merchants: merchants.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      users: users.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      payments: payments.map((row) => ({ ...row, amount: row.amount.toFixed(2), createdAt: row.createdAt.toISOString() })),
      auditLogs: auditLogs.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    }, 200, rid);
  } catch (error) {
    console.error(`[admin-dashboard][${rid}]`, error);
    return apiError("ADMIN_DATA_UNAVAILABLE", "Não foi possível carregar os dados administrativos.", 503, rid);
  }
}
