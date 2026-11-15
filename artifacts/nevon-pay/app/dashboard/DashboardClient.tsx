"use client";

import {
  Activity, AlertCircle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote,
  Bell, Check, CircleHelp, Clock3, Code2, CreditCard, Download,
  LayoutDashboard, LifeBuoy, LoaderCircle, RefreshCw, Search,
  Settings, ShieldCheck, Smartphone, Users, Wallet, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  DashboardChartPoint, DashboardCustomer, DashboardMethod, DashboardPayload, DashboardPayment,
} from "@/lib/dashboard-types";
import { createClient } from "@/lib/supabase/client";
import LogoutButton from "./logout-button";
import "./dashboard.css";

type ViewKey = "overview" | "transactions" | "customers" | "methods" | "reports" | "integrations" | "settings" | "support";
type ApiResponse = { success: true; data: DashboardPayload } | { success: false; error: { code: string; message: string } };
type LoadState = "loading" | "ready" | "error";
type ApiKeyRow = { id: string; name: string; environment: "TEST" | "LIVE"; active: boolean; createdAt: string };

const navigation: Array<{ id: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { id: "transactions", label: "Transacções", icon: ArrowLeftRight },
  { id: "customers", label: "Clientes", icon: Users },
  { id: "methods", label: "Métodos de Pagamento", icon: CreditCard },
  { id: "reports", label: "Relatórios", icon: Activity },
  { id: "integrations", label: "Integrações API", icon: Code2 },
  { id: "settings", label: "Configurações", icon: Settings },
  { id: "support", label: "Suporte", icon: LifeBuoy },
];

const currencyFormat = (amount: string | number, currency = "MZN") => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-MZ", {
    style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
};
const dateFormat = (value: string, withTime = false) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-MZ", withTime
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" }).format(date);
};
const initials = (name?: string | null) =>
  (name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("") || "?").toUpperCase();
const providerName = (provider: string | null | undefined) => {
  const normalized = provider?.toLowerCase() ?? "";
  if (normalized.includes("mpesa") || normalized.includes("m-pesa")) return "M-Pesa";
  if (normalized.includes("emola") || normalized.includes("e-mola")) return "e-Mola";
  if (["card", "credit", "debit", "visa", "mastercard"].some((part) => normalized.includes(part))) return "Cartão bancário";
  if (normalized.includes("bank")) return "Banco";
  return provider ? provider.replace(/[_-]/g, " ") : "Não identificado";
};
const statusLabel: Record<string, string> = {
  COMPLETED: "Concluído", OPEN: "Aberto", PENDING: "Pendente", PROCESSING: "Em processamento",
  FAILED: "Falhado", CANCELLED: "Cancelado", EXPIRED: "Expirado",
};
const statusClass = (status: string) => `np-status np-status-${status.toLowerCase()}`;

function Chart({ points }: { points: DashboardChartPoint[] }) {
  const values = points.map((point) => Number(point.received)).filter(Number.isFinite);
  const maximum = Math.max(...values, 1);
  const coords = points.map((point, index) => {
    const x = points.length <= 1 ? 50 : 30 + (index * 540) / (points.length - 1);
    const val = Number(point.received);
    const y = 174 - (Number.isFinite(val) ? (val / maximum) * 142 : 0);
    return { x, y, point };
  });
  const path = coords.map(({ x, y }, i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const area = `${path} L 570 178 L 30 178 Z`;
  const latest = points.at(-1);
  return (
    <div className="np-chart-wrap" aria-label="Gráfico de valores recebidos nos últimos seis meses">
      <div className="np-chart-tooltip" aria-live="polite">
        <strong>{latest?.label ?? "—"}</strong><br />
        {latest ? currencyFormat(latest.received) : "Sem dados"}
      </div>
      <svg className="np-chart-svg" viewBox="0 0 600 210" role="img" aria-label="Valores mensais recebidos">
        <defs><linearGradient id="np-chart-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#32a777" stopOpacity=".2" /><stop offset="100%" stopColor="#32a777" stopOpacity="0" /></linearGradient></defs>
        {[32, 80, 128, 178].map((y) => <line key={y} x1="30" x2="570" y1={y} y2={y} className="np-chart-gridline" />)}
        <path d={area} className="np-chart-area" />
        <path d={path} className="np-chart-line" />
        {coords.map(({ x, y, point }) => <g key={point.month}><circle className="np-chart-point" cx={x} cy={y} r="4" /><text className="np-chart-label" x={x} y="199" textAnchor="middle">{point.label}</text></g>)}
      </svg>
    </div>
  );
}

function TransactionRows({ rows }: { rows: DashboardPayment[] }) {
  return <div className="np-table-scroll"><table className="np-table" data-testid="transactions-table">
    <thead><tr><th>Cliente</th><th>Referência</th><th>Método</th><th>Data</th><th>Valor</th><th>Estado</th></tr></thead>
    <tbody>{rows.map((tx) => <tr key={tx.id} data-testid={`transaction-row-${tx.id}`}>
      <td><div className="np-tx-person"><span className="np-mini-avatar">{initials(tx.customerName)}</span><span><span className="np-person-name">{tx.customerName || "Cliente não identificado"}</span><span className="np-person-email">{tx.customerEmail || "Sem contacto registado"}</span></span></div></td>
      <td>{tx.reference}</td><td>{providerName(tx.provider)}</td><td>{dateFormat(tx.createdAt, true)}</td>
      <td className="np-amount">{currencyFormat(tx.amount, tx.currency)}</td><td><span className={statusClass(tx.status)}>{statusLabel[tx.status] ?? tx.status}</span></td>
    </tr>)}</tbody>
  </table></div>;
}

function EmptyPanel({ title, detail, icon: Icon = Wallet }: { title: string; detail: string; icon?: typeof Wallet }) {
  return <div className="np-centered-state"><div className="np-state-content"><span className="np-state-icon"><Icon size={22} /></span><h2>{title}</h2><p>{detail}</p></div></div>;
}

export default function DashboardClient() {
  const router = useRouter();
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewKey>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [txQuery, setTxQuery] = useState("");
  const [txStatus, setTxStatus] = useState("ALL");
  const [customerQuery, setCustomerQuery] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeySecret, setApiKeySecret] = useState<string | null>(null);
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [apiKeyError, setApiKeyError] = useState("");
  const [apiKeyNotice, setApiKeyNotice] = useState("");
  const hasPayload = useRef(false);

  const loadDashboard = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else if (!hasPayload.current) setLoadState("loading");
    try {
      const response = await fetch("/api/dashboard", { method: "GET", cache: "no-store", credentials: "include" });
      const result = await response.json() as ApiResponse;
      if (!response.ok || !result.success) {
        const message = !result.success ? result.error.message : "Não foi possível carregar os dados da conta.";
        throw new Error(message);
      }
      setPayload(result.data);
      hasPayload.current = true;
      setProfileName(result.data.user.name ?? "");
      setLastUpdated(result.data.updatedAt);
      setError("");
      setLoadState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ocorreu um erro ao consultar o dashboard.");
      if (!hasPayload.current) setLoadState("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const timer = window.setInterval(() => { void loadDashboard(true); }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const activeMerchantId = payload?.workspaces[0]?.id;

  const activeWorkspace = payload?.workspaces[0];
  const workspaceLabel = payload?.workspaces.length === 1
    ? activeWorkspace?.name
    : payload?.workspaces.length
      ? `${payload.workspaces.length} espaços de trabalho`
      : "Conta de comerciante";
  const workspaceData = payload && payload.workspaces.length > 0;
  const filteredTransactions = useMemo(() => (payload?.transactions ?? []).filter((tx) => {
    const matchesQuery = `${tx.reference} ${tx.customerName ?? ""} ${tx.customerEmail ?? ""} ${providerName(tx.provider)}`.toLowerCase().includes(txQuery.toLowerCase());
    return matchesQuery && (txStatus === "ALL" || tx.status === txStatus);
  }), [payload?.transactions, txQuery, txStatus]);
  const filteredCustomers = useMemo(() => (payload?.customers ?? []).filter((customer) =>
    `${customer.name ?? ""} ${customer.email ?? ""} ${customer.phone ?? ""}`.toLowerCase().includes(customerQuery.toLowerCase()),
  ), [payload?.customers, customerQuery]);

  function selectView(next: ViewKey) {
    setView(next);
    setNoticeOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileMessage("");
    setProfileError("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: profileName.trim() }),
      });
      const result = await response.json() as { success: boolean; error?: { message: string } };
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Não foi possível actualizar o perfil.");
      setProfileMessage("O nome da conta foi actualizado.");
      setPayload((current) => current ? { ...current, user: { ...current.user, name: profileName.trim() } } : current);
      router.refresh();
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : "Não foi possível actualizar o perfil.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceBusy(true);
    setWorkspaceError("");
    try {
      const response = await fetch("/api/v1/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: workspaceName.trim() }),
      });
      const result = await response.json() as { success: boolean; error?: { message: string } };
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Não foi possível criar o espaço de trabalho.");
      setWorkspaceName("");
      await loadDashboard(true);
    } catch (cause) {
      setWorkspaceError(cause instanceof Error ? cause.message : "Erro ao criar o espaço de trabalho.");
    } finally {
      setWorkspaceBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordMessage("");
    setPasswordError("");
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.next,
          confirmPassword: passwordForm.confirm,
        }),
      });
      const result = await response.json() as { success: boolean; error?: { code?: string; message: string } };
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Não foi possível alterar a palavra-passe.");
      setPasswordForm({ current: "", next: "", confirm: "" });
      setPasswordMessage("Palavra-passe alterada com sucesso.");
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : "Erro ao alterar a palavra-passe.");
    } finally {
      setPasswordBusy(false);
    }
  }

  const loadApiKeys = useCallback(async (merchantId: string) => {
    setApiKeyError("");
    try {
      const response = await fetch(`/api/v1/api-keys?merchantId=${encodeURIComponent(merchantId)}`, { credentials: "include", cache: "no-store" });
      const result = await response.json() as { success: boolean; data?: ApiKeyRow[]; error?: { message: string } };
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Não foi possível listar as chaves.");
      setApiKeys(result.data ?? []);
    } catch (cause) {
      setApiKeyError(cause instanceof Error ? cause.message : "Erro ao listar as chaves.");
    }
  }, []);

  async function createApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeMerchantId) return;
    setApiKeyBusy(true);
    setApiKeyError("");
    setApiKeyNotice("");
    setApiKeySecret(null);
    try {
      const response = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ merchantId: activeMerchantId, name: apiKeyName.trim() || "Chave de teste", environment: "TEST" }),
      });
      const result = await response.json() as { success: boolean; api_key?: { key: string }; error?: { message: string } };
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Não foi possível criar a chave.");
      setApiKeySecret(result.api_key?.key ?? null);
      setApiKeyName("");
      setApiKeyNotice("Chave criada. Copie-a agora: não volta a ser mostrada.");
      await loadApiKeys(activeMerchantId);
    } catch (cause) {
      setApiKeyError(cause instanceof Error ? cause.message : "Erro ao criar a chave.");
    } finally {
      setApiKeyBusy(false);
    }
  }

  async function revokeApiKey(id: string) {
    if (!activeMerchantId) return;
    setApiKeyBusy(true);
    setApiKeyError("");
    try {
      const response = await fetch(`/api/v1/api-keys/${id}`, { method: "DELETE", credentials: "include" });
      const result = await response.json() as { success: boolean; error?: { message: string } };
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Não foi possível revogar a chave.");
      await loadApiKeys(activeMerchantId);
    } catch (cause) {
      setApiKeyError(cause instanceof Error ? cause.message : "Erro ao revogar a chave.");
    } finally {
      setApiKeyBusy(false);
    }
  }

  async function markNotificationsRead() {
    try {
      await fetch("/api/notifications", { method: "POST", credentials: "include" });
      setPayload((current) => current ? {
        ...current,
        notificationsUnread: 0,
        notifications: current.notifications.map((item) => ({ ...item, read: true })),
      } : current);
    } catch {
      // O próximo ciclo de actualização volta a tentar.
    }
  }

  async function markNotificationRead(id: string) {
    setPayload((current) => current ? {
      ...current,
      notificationsUnread: Math.max(0, current.notificationsUnread - 1),
      notifications: current.notifications.map((item) => (item.id === id ? { ...item, read: true } : item)),
    } : current);
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST", credentials: "include" });
    } catch {
      // Ignora; o estado volta a ser sincronizado na próxima consulta.
    }
  }

  useEffect(() => {
    if (view === "integrations" && activeMerchantId) void loadApiKeys(activeMerchantId);
  }, [view, activeMerchantId, loadApiKeys]);

  function exportTransactions() {
    if (!payload) return;
    const columns = ["referencia", "estado", "valor", "moeda", "provedor", "data", "cliente", "email"];
    const rows = filteredTransactions.map((tx) => [tx.reference, tx.status, tx.amount, tx.currency, providerName(tx.provider), tx.createdAt, tx.customerName ?? "", tx.customerEmail ?? ""]);
    const csv = [columns, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    link.download = "nevon-pay-transaccoes.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const title = navigation.find((item) => item.id === view)?.label ?? "Visão Geral";
  const noWorkspace = loadState === "ready" && payload?.workspaces.length === 0;

  function renderOverview() {
    if (!payload || !workspaceData) return null;
    const summary = payload.summary;
    const stats = [
      { label: "Saldo disponível", value: currencyFormat(summary.availableBalance), foot: "Saldo agregado dos espaços ligados", icon: Wallet, color: "#087b57", soft: "#e5f3eb" },
      { label: "Total recebido", value: currencyFormat(summary.receivedTotal), foot: `${summary.completedTransactions.toLocaleString("pt-MZ")} pagamentos concluídos`, icon: ArrowDownLeft, color: "#286fa4", soft: "#eaf3fb" },
      { label: "Transacções", value: summary.totalTransactions.toLocaleString("pt-MZ"), foot: `${summary.pendingTransactions.toLocaleString("pt-MZ")} por acompanhar`, icon: ArrowLeftRight, color: "#9a7330", soft: "#f8f0df" },
      { label: "Montante pendente", value: currencyFormat(summary.pendingAmount), foot: `${summary.pendingTransactions.toLocaleString("pt-MZ")} transacções pendentes`, icon: Clock3, color: "#bd7046", soft: "#fbede5" },
    ];
    return <>
      <div className="np-stats-grid">{stats.map(({ label, value, foot, icon: Icon, color, soft }) => <article className="np-stat-card" key={label} style={{ "--stat-color": color, "--stat-soft": soft } as CSSProperties} data-testid={`summary-${label.toLowerCase().replaceAll(" ", "-")}`}>
        <div className="np-stat-top"><span>{label}</span><span className="np-stat-icon"><Icon size={15} /></span></div><p className="np-stat-value">{value}</p><p className="np-stat-foot">{foot}</p>
      </article>)}</div>
      <div className="np-main-grid">
        <section className="np-panel"><div className="np-panel-heading"><div><h2>Movimento de pagamentos</h2><p>Valores recebidos · últimos seis meses</p></div><span className="np-chart-legend"><i /> Recebido</span></div><Chart points={payload.chart} /></section>
        <section className="np-panel"><div className="np-panel-heading"><div><h2>A acompanhar</h2><p>Actividade que pode precisar da sua atenção</p></div><Bell size={16} color="#899994" /></div>
          {payload.notifications.length ? <div className="np-activity-list">{payload.notifications.slice(0, 4).map((notice) => <article className="np-activity-row" key={notice.id}><span className="np-activity-icon"><AlertCircle size={14} /></span><div><div className="np-activity-title">{notice.title}</div><div className="np-activity-description">{notice.description}</div><div className="np-activity-time">{dateFormat(notice.createdAt, true)}</div></div></article>)}</div> : <div className="np-empty-inline">Sem notificações neste momento. A actividade será apresentada aqui quando existir.</div>}
        </section>
      </div>
      <div className="np-bottom-grid">
        <section className="np-panel np-table-panel"><div className="np-table-head"><h2>Transacções recentes</h2><button type="button" className="np-text-button" onClick={() => selectView("transactions")}>Ver todas <ArrowUpRight size={13} /></button></div>
          {payload.transactions.length ? <TransactionRows rows={payload.transactions.slice(0, 5)} /> : <div className="np-empty-inline">Ainda não há transacções para este espaço de trabalho.</div>}
        </section>
        <section className="np-panel"><div className="np-panel-heading"><div><h2>Métodos registados</h2><p>Actividade observada nos dados recebidos</p></div><CreditCard size={16} color="#899994" /></div>
          {payload.methods.length ? <MethodList methods={payload.methods.slice(0, 4)} /> : <div className="np-empty-inline">Os métodos serão apresentados quando houver pagamentos registados.</div>}
        </section>
      </div>
    </>;
  }

  function renderContent() {
    if (loadState === "loading" && !payload) return <div className="np-stats-grid" aria-label="A carregar o dashboard" data-testid="dashboard-loading">{[1, 2, 3, 4].map((n) => <div className="np-stat-card" key={n}><div className="np-skeleton" style={{ height: 12, width: "55%" }} /><div className="np-skeleton" style={{ height: 25, width: "75%", marginTop: 18 }} /><div className="np-skeleton" style={{ height: 9, width: "60%", marginTop: 12 }} /></div>)}</div>;
    if (loadState === "error" && !payload) return <section className="np-panel"><EmptyPanel title="Não foi possível carregar o dashboard" detail={error} icon={AlertCircle} /><div style={{ textAlign: "center", paddingBottom: 22 }}><button className="np-primary-button" type="button" onClick={() => void loadDashboard(true)} disabled={refreshing}><RefreshCw size={14} /> Tentar novamente</button></div></section>;
    if (noWorkspace) return <section className="np-panel"><EmptyPanel title="Crie o seu espaço de trabalho" detail="A sua conta ainda não tem espaços de comerciante. Crie um para começar a registar pagamentos e gerar chaves de API." icon={Wallet} /><form className="np-form" style={{ padding: "0 24px 24px", maxWidth: 420, margin: "0 auto" }} onSubmit={createWorkspace}><div className="np-field"><label htmlFor="workspace-name">Nome do espaço</label><input id="workspace-name" data-testid="workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} minLength={2} maxLength={120} required placeholder="Ex.: A minha loja" /></div>{workspaceError && <p className="np-alert np-alert-error" role="alert"><AlertCircle size={15} />{workspaceError}</p>}<button className="np-primary-button" type="submit" disabled={workspaceBusy || workspaceName.trim().length < 2} data-testid="create-workspace">{workspaceBusy ? <LoaderCircle size={14} className="np-spin" /> : <Check size={14} />} Criar espaço de trabalho</button></form></section>;
    if (loadState === "error" && payload) return <section className="np-panel"><EmptyPanel title="Dados temporariamente indisponíveis" detail={error} icon={AlertCircle} /><div style={{ textAlign: "center", paddingBottom: 22 }}><button className="np-primary-button" type="button" onClick={() => void loadDashboard(true)} disabled={refreshing}><RefreshCw size={14} /> Tentar novamente</button></div></section>;
    if (!payload) return null;
    if (view === "overview") return renderOverview();
    if (view === "transactions") return <section className="np-section-layout">
      <div className="np-panel"><div className="np-panel-heading"><div><h2>Histórico de transacções</h2><p>Até 50 pagamentos mais recentes nos espaços ligados.</p></div><button className="np-primary-button" type="button" onClick={exportTransactions}><Download size={14} /> Exportar CSV</button></div>
        <div className="np-toolbar" style={{ marginBottom: 14 }}><label className="np-search" style={{ display: "flex", alignItems: "center", gap: 8 }}><Search size={14} color="#82918c" /><input aria-label="Pesquisar transacções" data-testid="transaction-search" value={txQuery} onChange={(event) => setTxQuery(event.target.value)} placeholder="Pesquisar referência ou cliente" style={{ border: 0, outline: 0, width: "100%", background: "transparent", fontSize: 11 }} /></label><select className="np-select" aria-label="Filtrar por estado" value={txStatus} onChange={(event) => setTxStatus(event.target.value)}><option value="ALL">Todos os estados</option>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
        {filteredTransactions.length ? <TransactionRows rows={filteredTransactions} /> : <EmptyPanel title="Nenhuma transacção encontrada" detail={payload.transactions.length ? "Ajuste a pesquisa ou o filtro de estado." : "As transacções aparecerão aqui quando forem registadas."} icon={ArrowLeftRight} />}
      </div>
    </section>;
    if (view === "customers") return <section className="np-section-layout"><div className="np-panel"><div className="np-panel-heading"><div><h2>Clientes</h2><p>Contactos identificados nas sessões de pagamento.</p></div><span className="np-updated">{payload.customers.length} registos</span></div><label className="np-search" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 15 }}><Search size={14} color="#82918c" /><input aria-label="Pesquisar clientes" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Pesquisar nome, email ou telefone" style={{ border: 0, outline: 0, width: "100%", background: "transparent", fontSize: 11 }} /></label>
      {filteredCustomers.length ? <div className="np-customer-grid">{filteredCustomers.map((customer, index) => <div key={customer.id} data-testid={`customer-card-${index}`}><CustomerCard customer={customer} /></div>)}</div> : <EmptyPanel title="Sem clientes para apresentar" detail={payload.customers.length ? "Não encontrámos clientes com estes termos." : "Os dados de cliente serão apresentados quando existirem pagamentos com contacto registado."} icon={Users} />}</div></section>;
    if (view === "methods") return <section className="np-section-layout"><div className="np-panel"><div className="np-panel-heading"><div><h2>Métodos de pagamento observados</h2><p>Dados agregados dos pagamentos actualmente registados.</p></div></div>{payload.methods.length ? <div className="np-method-grid">{payload.methods.map((method) => <MethodCard key={`${method.provider}:${method.currency}`} method={method} />)}</div> : <EmptyPanel title="Ainda sem métodos registados" detail="M-Pesa, e-Mola ou métodos bancários surgirão nesta página apenas quando estiverem presentes nos dados de pagamento." icon={CreditCard} />}</div></section>;
    if (view === "reports") return <section className="np-section-layout"><div className="np-panel"><div className="np-panel-heading"><div><h2>Relatório de recebimentos</h2><p>Resumo mensal baseado nos pagamentos concluídos em MZN.</p></div><button className="np-primary-button" type="button" onClick={exportTransactions}><Download size={14} /> Exportar transacções</button></div><Chart points={payload.chart} /><div className="np-bars">{payload.chart.map((point) => { const maximum = Math.max(...payload.chart.map((item) => Number(item.received)), 1); const amount = Number(point.received); const height = Number.isFinite(amount) ? Math.max(3, amount / maximum * 105) : 3; return <div className="np-bar-group" key={point.month}><span className="np-bar-value">{currencyFormat(point.received)}</span><div className="np-bar" style={{ height }} /><span className="np-bar-label">{point.label}</span></div>; })}</div></div><div className="np-stats-grid"><MiniMetric title="Total recebido" value={currencyFormat(payload.summary.receivedTotal)} icon={ArrowDownLeft} /><MiniMetric title="Concluídas" value={payload.summary.completedTransactions.toLocaleString("pt-MZ")} icon={Check} /><MiniMetric title="Pendentes" value={payload.summary.pendingTransactions.toLocaleString("pt-MZ")} icon={Clock3} /><MiniMetric title="Total de transacções" value={payload.summary.totalTransactions.toLocaleString("pt-MZ")} icon={ArrowLeftRight} /></div></section>;
    if (view === "integrations") return <section className="np-section-layout"><div className="np-integration-banner"><span className="np-integration-banner-icon"><ShieldCheck size={21} /></span><div><h2>Acompanhamento não é processamento</h2><p>Este dashboard apresenta registos de pagamentos existentes. O processamento de pagamentos por M-Pesa, e-Mola e bancos ainda não está configurado nesta aplicação. Não é possível cobrar pagamentos por aqui.</p></div></div><div className="np-panel"><div className="np-panel-heading"><div><h2>Estado por método</h2><p>Apenas métodos que constam dos dados devolvidos pela conta.</p></div></div>{payload.methods.length ? <div className="np-integration-list">{payload.methods.map((method) => <IntegrationCard method={method} key={`${method.provider}:${method.currency}`} />)}</div> : <EmptyPanel title="Sem métodos de pagamento detectados" detail="Quando houver registos de pagamentos associados a um provedor, o respectivo método será listado aqui." icon={Code2} />}</div><div className="np-panel"><div className="np-panel-heading"><div><h2>Chaves de API</h2><p>Autenticam pedidos a /api/v1. Só o prefixo fica guardado; a chave completa é mostrada uma única vez.</p></div></div>{apiKeyError && <p className="np-alert np-alert-error" role="alert"><AlertCircle size={15} />{apiKeyError}</p>}{apiKeyNotice && <p className="np-alert np-alert-success" role="status"><Check size={15} />{apiKeyNotice}</p>}{apiKeySecret && <div className="np-alert np-alert-info"><Code2 size={15} /><span>Chave de teste: <code style={{ wordBreak: "break-all" }} data-testid="api-key-secret">{apiKeySecret}</code></span></div>}{activeMerchantId ? <><form className="np-form" onSubmit={createApiKey}><div className="np-field"><label htmlFor="api-key-name">Nome da chave</label><input id="api-key-name" value={apiKeyName} onChange={(event) => setApiKeyName(event.target.value)} maxLength={60} placeholder="Ex.: Integração loja online" /></div><button className="np-primary-button" type="submit" disabled={apiKeyBusy} data-testid="create-api-key">{apiKeyBusy ? <LoaderCircle size={14} className="np-spin" /> : <Check size={14} />} Gerar chave de teste</button></form>{apiKeys.length ? <div className="np-table-scroll" style={{ marginTop: 16 }}><table className="np-table"><thead><tr><th>Nome</th><th>Ambiente</th><th>Criada</th><th>Estado</th><th /></tr></thead><tbody>{apiKeys.map((key) => <tr key={key.id}><td>{key.name}</td><td>{key.environment}</td><td>{dateFormat(key.createdAt)}</td><td><span className={statusClass(key.active ? "COMPLETED" : "CANCELLED")}>{key.active ? "Activa" : "Revogada"}</span></td><td>{key.active && <button type="button" className="np-text-button" onClick={() => void revokeApiKey(key.id)} data-testid={`revoke-key-${key.id}`}>Revogar</button>}</td></tr>)}</tbody></table></div> : <div className="np-empty-inline">Ainda não existem chaves de API para este espaço.</div>}</> : <div className="np-empty-inline">Crie um espaço de trabalho para poder gerar chaves de API.</div>}</div><div className="np-alert np-alert-info"><ShieldCheck size={16} /> Não introduza credenciais de provedor nesta página. A ligação de processamento exige configuração técnica e credenciais oficiais fora do dashboard.</div></section>;
    if (view === "settings") return <div className="np-settings-grid"><section className="np-panel"><div className="np-panel-heading"><div><h2>Perfil da conta</h2><p>Actualize o nome associado à sua conta autenticada.</p></div></div>{profileMessage && <p className="np-alert np-alert-success" role="status"><Check size={15} />{profileMessage}</p>}{profileError && <p className="np-alert np-alert-error" role="alert"><AlertCircle size={15} />{profileError}</p>}<form className="np-form" onSubmit={saveProfile}><div className="np-field"><label htmlFor="profile-name">Nome completo</label><input id="profile-name" data-testid="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={120} placeholder="O seu nome" /></div><div className="np-field"><label htmlFor="profile-email">Email</label><input id="profile-email" value={payload.user.email} readOnly /><small>O email de autenticação não pode ser alterado aqui.</small></div><button className="np-primary-button" type="submit" disabled={profileSaving || !profileName.trim()}>{profileSaving ? <LoaderCircle size={14} className="np-spin" /> : <Check size={14} />} Guardar alterações</button></form></section><section className="np-panel"><div className="np-panel-heading"><div><h2>Espaços de trabalho</h2><p>Contas de comerciante ligadas ao seu utilizador.</p></div></div>{payload.workspaces.map((workspace) => <div className="np-workspace-card" key={workspace.id}><div><strong>{workspace.name}</strong><span>Identificador · {workspace.id}</span></div><span className="np-status-pill">{workspace.status === "ACTIVE" ? "Activo" : workspace.status === "PENDING" ? "Pendente" : "Suspenso"}</span></div>)}</section><section className="np-panel"><div className="np-panel-heading"><div><h2>Palavra-passe</h2><p>Altere a palavra-passe da conta autenticada. É pedida a palavra-passe actual.</p></div></div>{passwordMessage && <p className="np-alert np-alert-success" role="status"><Check size={15} />{passwordMessage}</p>}{passwordError && <p className="np-alert np-alert-error" role="alert"><AlertCircle size={15} />{passwordError}</p>}<form className="np-form" onSubmit={changePassword}><div className="np-field"><label htmlFor="current-password">Palavra-passe actual</label><input id="current-password" data-testid="current-password" type="password" autoComplete="current-password" value={passwordForm.current} onChange={(event) => setPasswordForm({ ...passwordForm, current: event.target.value })} required /></div><div className="np-field"><label htmlFor="new-password">Nova palavra-passe</label><input id="new-password" data-testid="new-password" type="password" autoComplete="new-password" minLength={8} value={passwordForm.next} onChange={(event) => setPasswordForm({ ...passwordForm, next: event.target.value })} required /><small>Mínimo de 8 caracteres.</small></div><div className="np-field"><label htmlFor="confirm-password">Confirmar nova palavra-passe</label><input id="confirm-password" data-testid="confirm-password" type="password" autoComplete="new-password" minLength={8} value={passwordForm.confirm} onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })} required /></div><button className="np-primary-button" type="submit" disabled={passwordBusy || !passwordForm.current || passwordForm.next.length < 8} data-testid="change-password">{passwordBusy ? <LoaderCircle size={14} className="np-spin" /> : <ShieldCheck size={14} />} Alterar palavra-passe</button></form></section></div>;
    return <section className="np-support-grid"><article className="np-panel np-support-card"><CircleHelp size={21} /><h2>Precisa de ajuda?</h2><p>Consulte os dados de transacções e métodos registados. Para questões de acesso à conta ou de configuração técnica, contacte o administrador da sua organização.</p></article><article className="np-panel np-support-card"><ShieldCheck size={21} /><h2>Dados e segurança</h2><p>O dashboard mostra dados associados aos seus espaços de comerciante ligados. Nunca partilhe palavras-passe ou credenciais de provedores por email.</p></article><article className="np-panel np-support-card"><Activity size={21} /><h2>Actualização dos dados</h2><p>Os dados são consultados ao abrir o dashboard e actualizados automaticamente a cada 30 segundos. Pode também actualizar manualmente.</p></article><article className="np-panel np-support-card"><Code2 size={21} /><h2>Integrações</h2><p>O processamento de pagamentos ainda não está configurado. Consulte a secção Integrações API para mais detalhes sobre as limitações actuais.</p></article></section>;
  }

  return <main className="np-dashboard">
    <div className="np-shell">
      <aside className="np-sidebar" aria-label="Navegação principal">
        <div className="np-brand"><span className="np-brand-mark"><Wallet size={19} /></span><span className="np-brand-name">nevon<span>pay</span></span></div>
        <div className="np-workspace-label">Espaço de trabalho</div>
        {payload?.workspaces.length ? <div className="np-workspace-select" aria-label={`${payload.workspaces.length} espaços de trabalho ligados`}>
          {payload.workspaces.length === 1 ? payload.workspaces[0].name : `${payload.workspaces.length} espaços ligados`}
          {payload.workspaces.length > 1 && <span style={{ display: "block", color: "#9ab1ab", fontSize: 9, marginTop: 4 }}>Os totais incluem todos os espaços</span>}
        </div> : <div className="np-workspace-select" style={{ color: "#a9bfba" }}>Sem espaço ligado</div>}
        <nav className="np-nav">{navigation.map(({ id, label, icon: Icon }) => <button type="button" key={id} className="np-nav-button" onClick={() => selectView(id)} aria-current={view === id ? "page" : undefined} data-testid={`nav-${id}`}><Icon size={16} /><span>{label}</span></button>)}</nav>
        <div className="np-sidebar-bottom"><div className="np-live-note"><span className="np-live-dot" /><span>Dados da conta actualizados periodicamente. Sem processamento de pagamentos activo.</span></div></div>
      </aside>
      <div className="np-main">
        <header className="np-topbar">
          <div className="np-topbar-left"><span className="np-top-eyebrow">Painel do comerciante <span style={{ color: "#bcc9c4", padding: "0 5px" }}>/</span> {title}</span><div className="np-mobile-header"><span className="np-brand-mark"><Wallet size={16} /></span><span className="np-brand-name">nevon<span style={{ color: "var(--np-green)" }}>pay</span></span></div></div>
          <div className="np-top-actions"><button type="button" className="np-icon-button" aria-label={payload?.notificationsUnread ? `Ver notificações (${payload.notificationsUnread} não lidas)` : "Ver notificações"} onClick={() => setNoticeOpen((open) => !open)} data-testid="notifications-button"><Bell size={16} />{Boolean(payload?.notificationsUnread) && <span className="np-notification-count" data-testid="notifications-badge" />}</button><button type="button" className="np-refresh-button" onClick={() => void loadDashboard(true)} disabled={refreshing} aria-label="Actualizar dashboard" data-testid="refresh-dashboard">{refreshing ? <LoaderCircle size={15} className="np-spin" /> : <RefreshCw size={15} />} Actualizar</button><div className="np-top-user"><span className="np-avatar">{initials(payload?.user.name || payload?.user.email)}</span><span><span className="np-user-name">{payload?.user.name || "Conta Nevon Pay"}</span><span className="np-user-email">{payload?.user.email}</span></span></div><div className="np-top-logout"><LogoutButton /></div></div>
        </header>
        <nav className="np-mobile-nav" aria-label="Navegação móvel">{navigation.map(({ id, label, icon: Icon }) => <button type="button" key={id} className="np-nav-button" onClick={() => selectView(id)} aria-current={view === id ? "page" : undefined} data-testid={`mobile-nav-${id}`}><Icon size={14} />{label}</button>)}</nav>
        <div className="np-content">
           <div className="np-page-heading"><div><p className="np-overline">Nevon Pay · {workspaceLabel}</p><h1>{view === "overview" && payload?.user.name ? `Bom dia, ${payload.user.name.split(" ")[0]}` : title}</h1><p>{view === "overview" ? "Acompanhe o estado das suas cobranças e dos seus recebimentos." : sectionSubtitle(view)}</p></div><span className="np-updated" data-testid="last-updated">{lastUpdated ? `Actualizado ${dateFormat(lastUpdated, true)}` : "A obter dados…"}</span></div>
          {error && payload && loadState === "ready" && <div className="np-alert np-alert-error" role="alert"><AlertCircle size={16} />{error} Os valores apresentados correspondem à última consulta bem-sucedida.</div>}
           {noticeOpen && <section className="np-panel" style={{ marginBottom: 15 }}><div className="np-panel-heading"><div><h2>Notificações</h2><p>{payload?.notificationsUnread ? `${payload.notificationsUnread} por ler · ` : ""}Alertas gerados pelas operações da sua conta. Actualizam a cada 30 segundos.</p></div><div style={{ display: "flex", gap: 8 }}>{Boolean(payload?.notificationsUnread) && <button type="button" className="np-text-button" onClick={() => void markNotificationsRead()} data-testid="mark-all-read">Marcar todas como lidas</button>}<button type="button" className="np-icon-button" aria-label="Fechar notificações" data-testid="close-notifications" onClick={() => setNoticeOpen(false)}><X size={15} /></button></div></div>{payload?.notifications.length ? <div className="np-activity-list">{payload.notifications.map((item) => <article className="np-activity-row" key={item.id} data-testid={`notification-${item.id}`} onClick={() => { if (!item.read) void markNotificationRead(item.id); }} style={{ cursor: item.read ? "default" : "pointer", opacity: item.read ? 0.72 : 1 }}><span className="np-activity-icon"><AlertCircle size={14} /></span><div><div className="np-activity-title">{item.title}{!item.read && <span className="np-notification-count" style={{ position: "static", display: "inline-block", marginLeft: 6, verticalAlign: "middle" }} />}</div><div className="np-activity-description">{item.description}</div><div className="np-activity-time">{dateFormat(item.createdAt, true)}{item.read ? " · lida" : " · não lida"}</div></div></article>)}</div> : <div className="np-empty-inline">Não há notificações para apresentar.</div>}{payload?.emailNotifications && <div className="np-alert np-alert-info" style={{ marginTop: 14 }}><Bell size={15} />{payload.emailNotifications.configured ? `Notificações por email activas (${payload.emailNotifications.status}).` : `Notificações por email ainda não configuradas: ${payload.emailNotifications.status}`}</div>}</section>}
          {renderContent()}
        </div>
      </div>
    </div>
  </main>;
}

function sectionSubtitle(view: ViewKey) {
  const text: Record<ViewKey, string> = {
    overview: "Acompanhe o estado das suas cobranças e dos seus recebimentos.",
    transactions: "Consulte, filtre e exporte o histórico de pagamentos registados.",
    customers: "Veja os clientes identificados a partir dos dados de pagamento.",
    methods: "Acompanhe os métodos que constam dos dados da sua conta.",
    reports: "Leia a evolução dos valores recebidos e das transacções.",
    integrations: "Estado das integrações e capacidades de processamento.",
    settings: "Gerencie o seu perfil e os espaços de trabalho ligados.",
    support: "Informação útil sobre a sua conta e os dados apresentados.",
  };
  return text[view];
}

function MethodList({ methods }: { methods: DashboardMethod[] }) {
  return <div className="np-method-list">{methods.map((method) => <div className="np-method-row" key={`${method.provider}:${method.currency}`}><span className="np-method-symbol"><ProviderIcon provider={method.provider} /></span><span><span className="np-method-name">{providerName(method.provider)}</span><span className="np-method-sub">{method.completedTransactions} concluídas · {method.transactions} registos</span></span><span className="np-method-total">{currencyFormat(method.received, method.currency)}<small>{method.currency}</small></span></div>)}</div>;
}

function MethodCard({ method }: { method: DashboardMethod }) {
  return <article className="np-method-card"><span className="np-method-symbol"><ProviderIcon provider={method.provider} /></span><h3>{providerName(method.provider)}</h3><p>{method.currency} · {method.transactions} transacções registadas</p><strong>{currencyFormat(method.received, method.currency)}</strong><small>{method.completedTransactions} pagamentos concluídos</small></article>;
}
function IntegrationCard({ method }: { method: DashboardMethod }) {
  return <article className="np-integration-card"><h3>{providerName(method.provider)}</h3><p>{method.currency} · {method.transactions} registos, dos quais {method.completedTransactions} concluídos.</p><span className="np-track-state is-present">Presente nos dados</span></article>;
}
function ProviderIcon({ provider }: { provider: string }) {
  const normalized = provider.toLowerCase();
  if (normalized.includes("bank")) return <Banknote size={16} />;
  if (normalized.includes("mpesa") || normalized.includes("m-pesa") || normalized.includes("emola") || normalized.includes("e-mola")) return <Smartphone size={16} />;
  return <CreditCard size={16} />;
}
function CustomerCard({ customer }: { customer: DashboardCustomer }) {
  return <article className="np-customer-card"><span className="np-mini-avatar">{initials(customer.name)}</span><div style={{ minWidth: 0, flex: 1 }}><div className="np-person-name">{customer.name || "Cliente sem nome"}</div><div className="np-customer-detail">{customer.email || "Sem email registado"}<br />{customer.phone || "Sem telefone registado"}</div><div className="np-customer-meta"><span>{customer.transactionCount} transacções</span><span>Último pagamento {dateFormat(customer.lastPaymentAt)}</span></div></div></article>;
}
function MiniMetric({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Wallet }) {
  return <article className="np-stat-card"><div className="np-stat-top">{title}<span className="np-stat-icon"><Icon size={15} /></span></div><p className="np-stat-value">{value}</p></article>;
}
