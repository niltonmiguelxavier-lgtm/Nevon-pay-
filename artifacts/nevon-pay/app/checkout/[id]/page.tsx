import { db } from "@/lib/db";

export default async function Checkout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await db.checkoutSession.findUnique({ where: { id }, include: { merchant: true } });
  if (!session) return <main className="form"><h1>Checkout não encontrado</h1></main>;
  return <main className="form">
    <h1>{session.merchant.name}</h1>
    <p className="muted">Pagamento Nevon Pay</p>
    <h2>{session.amount.toString()} {session.currency}</h2>
    <p>Estado: {session.status}</p>
    <p className="muted">Os métodos de pagamento reais serão activados através dos provedores oficiais configurados.</p>
  </main>;
}
