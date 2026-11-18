"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Building2, Check, Clock3, CreditCard, LoaderCircle, RefreshCw, ShieldCheck, Users } from "lucide-react";
import LogoutButton from "@/app/dashboard/logout-button";
import "./admin.css";

type Merchant = { id: string; name: string; email: string; status: "PENDING" | "ACTIVE" | "SUSPENDED"; createdAt: string; _count: { payments: number; users: number } };
type UserRow = { id: string; name: string | null; email: string; role: string; createdAt: string };
type PaymentRow = { id: string; reference: string; amount: string; currency: string; status: string; provider: string | null; createdAt: string; merchant: { id: string; name: string } };
type AuditRow = { id: string; actorId: string | null; merchantId: string | null; action: string; resource: string | null; resourceId: string | null; requestId: string | null; createdAt: string };
type Payload = { admin: { email: string; name: string | null }; summary: { users: number; merchants: number; payments: number; pendingMerchants: number; paymentStatuses: Array<{ status: string; count: number }> }; merchants: Merchant[]; users: UserRow[]; payments: PaymentRow[]; auditLogs: AuditRow[] };
type View = "overview" | "merchants" | "users" | "payments" | "audit";
const sections: Array<{ id: View; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Visão geral", icon: Activity },
  { id: "merchants", label: "Comerciantes", icon: Building2 },
  { id: "users", label: "Utilizadores", icon: Users },
  { id: "payments", label: "Pagamentos", icon: CreditCard },
  { id: "audit", label: "Auditoria", icon: ShieldCheck },
];
const date = (value: string) => new Intl.DateTimeFormat("pt-MZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const statusLabel: Record<string, string> = { PENDING: "Pendente", ACTIVE: "Activo", SUSPENDED: "Suspenso", OPEN: "Aberto", PROCESSING: "Em processamento", COMPLETED: "Concluído", FAILED: "Falhado", CANCELLED: "Cancelado", EXPIRED: "Expirado" };

export default function AdminPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "Falha ao carregar a área administrativa.");
      setData(result as Payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao carregar os dados.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeMerchantStatus(merchant: Merchant, status: Merchant["status"]) {
    const verb = status === "ACTIVE" ? "activar" : status === "SUSPENDED" ? "suspender" : "marcar como pendente";
    if (!window.confirm(`Confirma ${verb} o comerciante “${merchant.name}”?`)) return;
    setUpdatingId(merchant.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/merchants/${encodeURIComponent(merchant.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "Não foi possível alterar o comerciante.");
      setNotice(`Estado de “${merchant.name}” actualizado para ${statusLabel[status]}.`);
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao actualizar o comerciante.");
    } finally { setUpdatingId(null); }
  }

  const title = sections.find((item) => item.id === view)?.label || "Visão geral";
  return <main className="np-admin">
    <header className="na-header">
      <div className="na-brand"><span className="na-brand-mark"><ShieldCheck size={19} /></span><span><strong>Nevon Pay</strong><small>Área administrativa reservada</small></span></div>
      <div className="na-account"><div className="na-account-copy"><strong>{data?.admin.name || "Administrador"}</strong><span>{data?.admin.email || "A validar sessão…"}</span></div><LogoutButton /></div>
    </header>
    <nav className="na-nav" aria-label="Secções de administração">{sections.map(({ id, label, icon: Icon }) => <button type="button" key={id} className="na-nav-button" aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}><Icon size={16} /><span>{label}</span></button>)}</nav>
    <div className="na-content">
      <div className="na-title-row"><div><p className="na-overline">NEVON PAY · ADMIN</p><h1>{title}</h1><p className="na-subtitle">Dados operacionais reais; acções privilegiadas registadas em auditoria.</p></div><button type="button" className="na-refresh" onClick={() => void load(true)} disabled={refreshing || loading}><RefreshCw size={15} className={refreshing ? "na-spin" : ""} />Actualizar</button></div>
      {error && <div className="na-alert na-error" role="alert">{error}</div>}{notice && <div className="na-alert na-success" role="status">{notice}</div>}
      {loading ? <div className="na-loading"><LoaderCircle className="na-spin" size={20} />A carregar informação administrativa…</div> : data ? <>
        {view === "overview" && <>
          <section className="na-stats" aria-label="Indicadores"><Stat icon={Users} label="Utilizadores" value={data.summary.users} /><Stat icon={Building2} label="Comerciantes" value={data.summary.merchants} /><Stat icon={Clock3} label="A aguardar revisão" value={data.summary.pendingMerchants} /><Stat icon={CreditCard} label="Registos de pagamento" value={data.summary.payments} /></section>
          <section className="na-grid"><div className="na-card"><div className="na-card-head"><div><h2>Comerciantes recentes</h2><p>Estado registado na base de dados.</p></div><button className="na-text-button" onClick={() => setView("merchants")}>Ver todos</button></div><MerchantTable rows={data.merchants.slice(0, 6)} busyId={updatingId} onStatus={changeMerchantStatus} /></div><div className="na-card"><div className="na-card-head"><div><h2>Pagamentos recentes</h2><p>Consulta; nenhum estado financeiro é alterado aqui.</p></div><button className="na-text-button" onClick={() => setView("payments")}>Ver todos</button></div><PaymentTable rows={data.payments.slice(0, 6)} /></div></section>
        </>}
        {view === "merchants" && <section className="na-card"><div className="na-card-head"><div><h2>Comerciantes</h2><p>Até 100 registos mais recentes. Alterar estado grava uma linha de auditoria.</p></div></div><MerchantTable rows={data.merchants} busyId={updatingId} onStatus={changeMerchantStatus} /></section>}
        {view === "users" && <section className="na-card"><div className="na-card-head"><div><h2>Utilizadores</h2><p>Consulta apenas; os papéis não são editáveis nesta versão.</p></div></div><div className="na-table-scroll"><table className="na-table"><thead><tr><th>Nome</th><th>Email</th><th>Papel</th><th>Criado</th></tr></thead><tbody>{data.users.map((row) => <tr key={row.id}><td>{row.name || "—"}</td><td>{row.email}</td><td><span className="na-pill">{row.role}</span></td><td>{date(row.createdAt)}</td></tr>)}</tbody></table></div></section>}
        {view === "payments" && <section className="na-card"><div className="na-card-head"><div><h2>Pagamentos</h2><p>Consulta apenas; não confirma nem simula pagamentos.</p></div></div><PaymentTable rows={data.payments} /></section>}
        {view === "audit" && <section className="na-card"><div className="na-card-head"><div><h2>Registo de auditoria</h2><p>Últimos 100 eventos armazenados.</p></div></div><div className="na-table-scroll"><table className="na-table"><thead><tr><th>Data</th><th>Acção</th><th>Recurso</th><th>ID recurso</th><th>Actor</th><th>Pedido</th></tr></thead><tbody>{data.auditLogs.map((row) => <tr key={row.id}><td>{date(row.createdAt)}</td><td>{row.action}</td><td>{row.resource || "—"}</td><td className="na-mono">{row.resourceId || "—"}</td><td className="na-mono">{row.actorId || "—"}</td><td className="na-mono">{row.requestId || "—"}</td></tr>)}</tbody></table></div></section>}
      </> : null}
      <footer className="na-footer">Acesso restrito a contas com papel ADMIN validado no servidor. Este endereço não é ligado à navegação pública.</footer>
    </div>
  </main>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return <article className="na-stat"><span className="na-stat-icon"><Icon size={17} /></span><span className="na-stat-label">{label}</span><strong>{value.toLocaleString("pt-MZ")}</strong></article>;
}
function MerchantTable({ rows, busyId, onStatus }: { rows: Merchant[]; busyId: string | null; onStatus: (merchant: Merchant, status: Merchant["status"]) => void }) {
  return <div className="na-table-scroll"><table className="na-table"><thead><tr><th>Comerciante</th><th>Estado</th><th>Contas</th><th>Pagamentos</th><th>Registado</th><th>Acções</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.email}</small></td><td><span className={`na-pill na-${row.status.toLowerCase()}`}>{statusLabel[row.status]}</span></td><td>{row._count.users}</td><td>{row._count.payments}</td><td>{date(row.createdAt)}</td><td><div className="na-row-actions">{row.status !== "ACTIVE" && <button disabled={busyId === row.id} onClick={() => onStatus(row, "ACTIVE")}>{busyId === row.id ? "A guardar…" : "Activar"}</button>}{row.status !== "SUSPENDED" && <button className="na-danger-button" disabled={busyId === row.id} onClick={() => onStatus(row, "SUSPENDED")}>Suspender</button>}</div></td></tr>)}</tbody></table>{rows.length === 0 && <p className="na-empty">Não existem comerciantes para apresentar.</p>}</div>;
}
function PaymentTable({ rows }: { rows: PaymentRow[] }) {
  return <div className="na-table-scroll"><table className="na-table"><thead><tr><th>Referência</th><th>Comerciante</th><th>Montante</th><th>Estado</th><th>Provedor</th><th>Data</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td className="na-mono">{row.reference}</td><td>{row.merchant.name}</td><td>{new Intl.NumberFormat("pt-MZ", { style: "currency", currency: row.currency }).format(Number(row.amount))}</td><td><span className="na-pill">{statusLabel[row.status] || row.status}</span></td><td>{row.provider || "—"}</td><td>{date(row.createdAt)}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="na-empty">Não existem pagamentos registados.</p>}</div>;
}
