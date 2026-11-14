import { db } from "@/lib/db";
import { expireSessionIfNeeded } from "@/lib/payments";
import CancelCheckoutButton from "./cancel-button";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  OPEN: "Aguarda pagamento",
  PENDING: "Pendente",
  PROCESSING: "Em processamento",
  COMPLETED: "Concluído",
  FAILED: "Falhado",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
};

export default async function Checkout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Expira a sessão no servidor; antes o estado só mudava se alguém chamasse a API.
  await expireSessionIfNeeded(id);

  const session = await db.checkoutSession.findUnique({
    where: { id },
    include: { merchant: { select: { name: true } } },
  });

  if (!session) {
    return (
      <main className="form">
        <h1>Checkout não encontrado</h1>
        <p className="muted">Esta ligação de pagamento não existe ou já não está disponível.</p>
      </main>
    );
  }

  const open = session.status === "OPEN" || session.status === "PENDING";
  const expired = session.status === "EXPIRED";

  return (
    <main className="form">
      <h1>{session.merchant.name}</h1>
      <p className="muted">Pagamento Nevon Pay · {session.paymentId.slice(0, 8)}</p>
      <h2>
        {session.amount.toString()} {session.currency}
      </h2>
      <p>
        Estado: <strong>{statusLabel[session.status] ?? session.status}</strong>
      </p>

      {open && (
        <>
          <p className="muted">
            Prazo para pagamento:{" "}
            {new Intl.DateTimeFormat("pt-MZ", { dateStyle: "short", timeStyle: "short" }).format(session.expiresAt)}
          </p>
          <p className="muted">
            Os métodos de pagamento reais serão activados quando os provedores oficiais (M-Pesa / e-Mola) estiverem
            configurados. Esta página não simula nem confirma pagamentos.
          </p>
          {session.cancelToken && <CancelCheckoutButton sessionId={session.id} cancelToken={session.cancelToken} />}
        </>
      )}

      {expired && <p className="muted">O prazo desta sessão terminou. Peça ao comerciante uma nova ligação de pagamento.</p>}
      {session.status === "CANCELLED" && <p className="muted">Esta sessão de pagamento foi cancelada.</p>}
      {session.status === "COMPLETED" && <p className="muted">Pagamento concluído.</p>}

      {session.cancelUrl && (
        <p className="muted">
          <a href={session.cancelUrl}>Voltar ao site do comerciante</a>
        </p>
      )}
    </main>
  );
}
