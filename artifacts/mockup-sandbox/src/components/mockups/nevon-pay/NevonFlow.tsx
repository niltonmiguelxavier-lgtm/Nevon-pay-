import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  Filter,
  Globe2,
  Layers3,
  LifeBuoy,
  Link2,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import "./NevonFlow.css";

type PaymentStatus = "Concluído" | "A processar" | "Falhou";
type Payment = {
  id: string;
  initials: string;
  customer: string;
  detail: string;
  amount: string;
  time: string;
  status: PaymentStatus;
  tone: string;
};

const initialPayments: Payment[] = [
  { id: "NV-84219", initials: "AM", customer: "Amina Mucavele", detail: "M-Pesa · •••• 4821", amount: "12 450,00 MT", time: "10:42", status: "Concluído", tone: "coral" },
  { id: "NV-84218", initials: "BC", customer: "Bento Cossa", detail: "e-Mola · •••• 1038", amount: "3 200,00 MT", time: "10:38", status: "A processar", tone: "blue" },
  { id: "NV-84217", initials: "SC", customer: "Sofia Chissano", detail: "M-Pesa · •••• 7712", amount: "8 900,00 MT", time: "10:26", status: "Concluído", tone: "lilac" },
  { id: "NV-84216", initials: "JM", customer: "Júlio Matusse", detail: "Visa · •••• 6629", amount: "1 750,00 MT", time: "10:11", status: "Falhou", tone: "mint" },
  { id: "NV-84215", initials: "LN", customer: "Lídia Nhantumbo", detail: "M-Pesa · •••• 2904", amount: "24 000,00 MT", time: "09:54", status: "Concluído", tone: "yellow" },
];

const queueItems = [
  { id: "q1", icon: Link2, title: "Ligar provedor", caption: "M-Pesa ainda não está ligado", action: "Configurar", color: "leaf" },
  { id: "q2", icon: FileText, title: "Completar perfil", caption: "Adicione os dados da empresa", action: "Continuar", color: "amber" },
  { id: "q3", icon: ShieldCheck, title: "Chave de produção", caption: "A sua conta está em sandbox", action: "Ver passos", color: "plum" },
];

const navLinks = [
  { label: "Visão geral", icon: Layers3 },
  { label: "Pagamentos", icon: ArrowDownLeft, count: "24" },
  { label: "Clientes", icon: Globe2 },
  { label: "Integrações", icon: Link2 },
];

const chartSets: Record<string, number[]> = {
  "7 dias": [31, 46, 40, 58, 49, 71, 60, 79, 63, 88, 73, 95],
  "30 dias": [39, 48, 44, 63, 53, 70, 59, 82, 69, 90, 76, 100],
  "90 dias": [25, 34, 31, 46, 43, 57, 54, 75, 65, 86, 80, 100],
};

function buildPath(values: number[], width: number, height: number) {
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - (value / 110) * height;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export function NevonFlow() {
  const [activeNav, setActiveNav] = useState("Visão geral");
  const [range, setRange] = useState("30 dias");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [payments, setPayments] = useState(initialPayments);
  const [dismissedQueue, setDismissedQueue] = useState<string[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showCharge, setShowCharge] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeName, setChargeName] = useState("");
  const [toast, setToast] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [exported, setExported] = useState(false);

  const filteredPayments = useMemo(() => payments.filter((payment) => {
    const byStatus = statusFilter === "Todos" || payment.status === statusFilter;
    const needle = searchValue.toLocaleLowerCase("pt");
    const bySearch = !needle || `${payment.customer} ${payment.id} ${payment.detail}`.toLocaleLowerCase("pt").includes(needle);
    return byStatus && bySearch;
  }), [payments, statusFilter, searchValue]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function submitCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(chargeAmount.replace(",", "."));
    if (!chargeName.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify("Indique o cliente e um valor válido.");
      return;
    }
    const next: Payment = {
      id: `NV-${84220 + payments.length - initialPayments.length}`,
      initials: chargeName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
      customer: chargeName.trim(),
      detail: "Link de pagamento · novo",
      amount: `${amount.toLocaleString("pt-MZ", { minimumFractionDigits: 2 })} MT`,
      time: "Agora",
      status: "A processar",
      tone: "blue",
    };
    setPayments((current) => [next, ...current]);
    setShowCharge(false);
    setChargeAmount("");
    setChargeName("");
    setStatusFilter("Todos");
    notify("Cobrança criada. Link pronto para partilhar.");
  }

  function exportPayments() {
    const header = "Referência,Cliente,Valor,Estado,Hora";
    const rows = filteredPayments.map((item) => `${item.id},${item.customer},${item.amount},${item.status},${item.time}`);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "nevon-pagamentos.csv";
    link.click();
    URL.revokeObjectURL(href);
    setExported(true);
    window.setTimeout(() => setExported(false), 2400);
  }

  const activeQueue = queueItems.filter((item) => !dismissedQueue.includes(item.id));
  const title = activeNav === "Visão geral" ? "A operação, em movimento." : activeNav;

  return (
    <div className="nf-shell">
      <aside className={`nf-sidebar ${mobileNavOpen ? "nf-sidebar-open" : ""}`}>
        <div className="nf-brand">
          <div className="nf-mark"><span>n</span><i /></div>
          <span className="nf-brand-name">nevon<span>pay</span></span>
          <button className="nf-mobile-close" aria-label="Fechar navegação" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
        </div>
        <div className="nf-workspace">
          <div className="nf-workspace-icon">M</div>
          <div className="nf-workspace-copy"><strong>Mapiko Studio</strong><span>Workspace principal</span></div>
          <ChevronDown size={15} />
        </div>
        <div className="nf-nav-label">WORKSPACE</div>
        <nav className="nf-nav">
          {navLinks.map(({ label, icon: Icon, count }) => (
            <button key={label} className={`nf-nav-item ${activeNav === label ? "is-active" : ""}`} onClick={() => { setActiveNav(label); setMobileNavOpen(false); }}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {count && <span className="nf-nav-count">{count}</span>}
              {activeNav === label && <span className="nf-nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="nf-nav-label nf-nav-label-tools">DESENVOLVEDOR</div>
        <nav className="nf-nav">
          <button className={`nf-nav-item ${activeNav === "API & webhooks" ? "is-active" : ""}`} onClick={() => setActiveNav("API & webhooks")}><Command size={17} strokeWidth={1.8} /><span>API &amp; webhooks</span></button>
          <button className={`nf-nav-item ${activeNav === "Relatórios" ? "is-active" : ""}`} onClick={() => setActiveNav("Relatórios")}><Activity size={17} strokeWidth={1.8} /><span>Relatórios</span></button>
        </nav>
        <div className="nf-sidebar-bottom">
          <div className="nf-env-card">
            <div className="nf-env-heading"><span className="nf-env-dot" /> Ambiente sandbox</div>
            <p>Teste o fluxo antes de receber pagamentos reais.</p>
            <button onClick={() => notify("Guia de produção aberto em breve.")}>Preparar produção <ArrowRight size={13} /></button>
          </div>
          <button className="nf-nav-item nf-help" onClick={() => notify("A equipa Nevon responde em dias úteis.")}><LifeBuoy size={17} strokeWidth={1.8} /><span>Ajuda e suporte</span><CircleHelp size={14} className="nf-help-mark" /></button>
          <div className="nf-user">
            <div className="nf-avatar">AM</div>
            <div className="nf-user-copy"><strong>Amélia Mucavele</strong><span>Administradora</span></div>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button className="nf-scrim nf-mobile-scrim" aria-label="Fechar navegação" onClick={() => setMobileNavOpen(false)} />}

      <main className="nf-main">
        <header className="nf-topbar">
          <button className="nf-menu-toggle" aria-label="Abrir navegação" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="nf-breadcrumb"><span>Mapiko Studio</span><ChevronRight size={14} /><strong>{activeNav}</strong></div>
          <div className="nf-top-actions">
            <div className="nf-top-search">
              {searchOpen && <input autoFocus value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Pesquisar pagamentos…" aria-label="Pesquisar pagamentos" />}
              <button aria-label={searchOpen ? "Fechar pesquisa" : "Pesquisar"} onClick={() => { setSearchOpen((open) => !open); setSearchValue(""); }}><Search size={17} /></button>
              {!searchOpen && <kbd>⌘ K</kbd>}
            </div>
            <div className="nf-notification-wrap">
              <button className="nf-icon-button" aria-label="Notificações" onClick={() => setNotificationsOpen((open) => !open)}><Bell size={17} /><i /></button>
              {notificationsOpen && <div className="nf-popover"><strong>Está tudo em dia.</strong><span>As notificações recentes aparecem aqui.</span></div>}
            </div>
            <button className="nf-icon-button nf-settings-button" aria-label="Definições" onClick={() => { setActiveNav("Definições"); notify("Definições do workspace."); }}><Settings2 size={17} /></button>
          </div>
        </header>

        <div className="nf-content">
          <section className="nf-welcome">
            <div>
              <div className="nf-date"><span className="nf-live-dot" /> QUARTA-FEIRA, 12 DE JUNHO DE 2025</div>
              <h1>{title}</h1>
              <p>Veja o que está a acontecer com os seus pagamentos agora.</p>
            </div>
            <div className="nf-welcome-actions">
              <div className="nf-sandbox-pill"><span /> Sandbox <ChevronDown size={13} /></div>
              <button className="nf-charge-button" onClick={() => setShowCharge(true)}><Plus size={16} strokeWidth={2.3} /> Nova cobrança</button>
            </div>
          </section>

          <section className="nf-overview" aria-label="Resumo dos pagamentos">
            <div className="nf-overview-left">
              <div className="nf-overview-eyebrow"><span className="nf-overview-dot" /> VOLUME PROCESSADO <span className="nf-eyebrow-divider">/</span> ÚLTIMOS {range.toUpperCase()}</div>
              <div className="nf-amount-line">
                <strong>{range === "7 dias" ? "428 930" : range === "90 dias" ? "2 486 210" : "1 284 560"}<small>,00</small></strong>
                <span className="nf-currency">MZN</span>
                <span className="nf-growth"><ArrowUpRight size={14} /> 18,6%</span>
              </div>
              <div className="nf-overview-sub">vs. período anterior <span>·</span> 846 pagamentos concluídos</div>
              <div className="nf-chart" aria-label={`Gráfico de volume dos últimos ${range}`}>
                <div className="nf-chart-grid"><i /><i /><i /><i /></div>
                <svg viewBox="0 0 520 120" preserveAspectRatio="none" role="img" aria-label="Volume crescente de pagamentos">
                  <defs><linearGradient id="nf-area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#b5e36b" stopOpacity=".24" /><stop offset="100%" stopColor="#b5e36b" stopOpacity="0" /></linearGradient></defs>
                  <path d={`${buildPath(chartSets[range], 520, 110)} L 520 120 L 0 120 Z`} fill="url(#nf-area-fill)" />
                  <path d={buildPath(chartSets[range], 520, 110)} fill="none" stroke="#c3ed80" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="520" cy={`${110 - (chartSets[range][11] / 110) * 110}`} r="4.2" fill="#c3ed80" stroke="#163a30" strokeWidth="3" />
                </svg>
                <div className="nf-chart-labels"><span>13 Mai</span><span>20 Mai</span><span>27 Mai</span><span>03 Jun</span><span>12 Jun</span></div>
              </div>
            </div>
            <div className="nf-overview-right">
              <div className="nf-range-tabs" role="tablist" aria-label="Período do gráfico">
                {Object.keys(chartSets).map((label) => <button role="tab" aria-selected={range === label} key={label} className={range === label ? "is-selected" : ""} onClick={() => setRange(label)}>{label}</button>)}
              </div>
              <div className="nf-side-metric">
                <span className="nf-side-icon"><ArrowDownLeft size={16} /></span>
                <div><span>Pagamentos</span><strong>846</strong></div>
                <span className="nf-side-change">+12,4%</span>
              </div>
              <div className="nf-side-rule" />
              <div className="nf-side-metric">
                <span className="nf-side-icon nf-side-icon-lime"><Activity size={15} /></span>
                <div><span>Taxa de sucesso</span><strong>96,8<span className="nf-side-percent">%</span></strong></div>
                <span className="nf-side-change">+2,1%</span>
              </div>
              <button className="nf-overview-link" onClick={() => setActiveNav("Relatórios")}>Relatório detalhado <ArrowRight size={14} /></button>
            </div>
          </section>

          <div className="nf-lower-grid">
            <section className="nf-payment-panel">
              <div className="nf-section-header">
                <div><div className="nf-section-kicker">ACTIVIDADE AO VIVO</div><h2>Pagamentos recentes <span>{payments.length}</span></h2></div>
                <button className={`nf-export-button ${exported ? "is-exported" : ""}`} onClick={exportPayments}>{exported ? <Check size={14} /> : <Download size={14} />}{exported ? "Exportado" : "Exportar"}</button>
              </div>
              <div className="nf-table-toolbar">
                <div className="nf-filter-tabs" role="tablist" aria-label="Filtrar pagamentos">
                  {["Todos", "Concluído", "A processar", "Falhou"].map((filter) => <button key={filter} className={statusFilter === filter ? "is-current" : ""} onClick={() => setStatusFilter(filter)}>{filter}{filter === "Todos" && <span>{payments.length}</span>}</button>)}
                </div>
                <button className="nf-filter-button" aria-label="Opções de filtro" onClick={() => notify("Filtros avançados estarão disponíveis em breve.")}><SlidersHorizontal size={15} /><span>Filtros</span><Filter size={12} /></button>
              </div>
              <div className="nf-payment-list">
                {filteredPayments.length ? filteredPayments.slice(0, 5).map((payment) => (
                  <button className="nf-payment-row" key={payment.id} onClick={() => setSelectedPayment(payment)}>
                    <span className={`nf-customer-avatar ${payment.tone}`}>{payment.initials}</span>
                    <span className="nf-customer-data"><strong>{payment.customer}</strong><small>{payment.detail}</small></span>
                    <span className="nf-payment-reference">{payment.id}</span>
                    <span className="nf-payment-status"><i className={`status-${payment.status === "Concluído" ? "done" : payment.status === "Falhou" ? "failed" : "pending"}`} />{payment.status}</span>
                    <span className="nf-payment-amount">{payment.amount}<small>{payment.time}</small></span>
                    <ChevronRight className="nf-row-chevron" size={15} />
                  </button>
                )) : <div className="nf-no-results"><Search size={18} /><strong>Nenhum pagamento encontrado</strong><span>Altere os filtros ou tente outro termo.</span></div>}
              </div>
              <button className="nf-view-all" onClick={() => { setActiveNav("Pagamentos"); setStatusFilter("Todos"); setSearchValue(""); }}>Ver todos os pagamentos <ArrowRight size={14} /></button>
            </section>

            <aside className="nf-right-rail">
              <section className="nf-queue-panel">
                <div className="nf-section-header nf-queue-header"><div><div className="nf-section-kicker">PRÓXIMO PASSO</div><h2>Deixe tudo pronto <span className="nf-queue-count">{activeQueue.length}</span></h2></div><button className="nf-more-button" aria-label="Mais opções" onClick={() => notify("Checklist de configuração")}><Ellipsis size={20} /></button></div>
                <p className="nf-queue-intro">Pequenos passos para começar a receber.</p>
                <div className="nf-queue-list">
                  {activeQueue.length ? activeQueue.map(({ id, icon: Icon, title: itemTitle, caption, action, color }) => (
                    <div className="nf-queue-item" key={id}>
                      <span className={`nf-queue-icon ${color}`}><Icon size={15} /></span>
                      <div className="nf-queue-copy"><strong>{itemTitle}</strong><span>{caption}</span></div>
                      <button onClick={() => setDismissedQueue((items) => [...items, id])} aria-label={`Concluir ${itemTitle}`}><ChevronRight size={16} /></button>
                    </div>
                  )) : <div className="nf-queue-clear"><CheckCircle2 size={19} /><span>Está tudo pronto para começar.</span></div>}
                </div>
                <button className="nf-setup-link" onClick={() => setActiveNav("Integrações")}>Ver guia de configuração <ArrowRight size={13} /></button>
              </section>
              <section className="nf-tip-card">
                <div className="nf-tip-top"><span className="nf-tip-spark"><Sparkles size={15} /></span><span>DICA NEVON</span><button aria-label="Mais sobre esta dica" onClick={() => notify("Dicas para otimizar o checkout.")}><ExternalLink size={13} /></button></div>
                <h3>Menos passos.<br /><em>Mais pagamentos.</em></h3>
                <p>Um checkout curto pode ajudar a reduzir desistências antes do pagamento.</p>
                <button className="nf-tip-cta" onClick={() => notify("Guia de checkout aberto em breve.")}>Explorar o checkout <ArrowRight size={14} /></button>
                <div className="nf-tip-orbit" />
              </section>
            </aside>
          </div>
          <footer className="nf-footer"><span>© 2025 Nevon Pay</span><span><i /> Sistemas operacionais</span><button onClick={() => notify("Documentação de integração.")}>Documentação <ArrowRight size={12} /></button></footer>
        </div>
      </main>

      {showCharge && <div className="nf-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setShowCharge(false); }}>
        <form className="nf-charge-modal" onSubmit={submitCharge}>
          <div className="nf-modal-heading"><span className="nf-modal-icon"><WalletCards size={19} /></span><button type="button" aria-label="Fechar" onClick={() => setShowCharge(false)}><X size={18} /></button></div>
          <div className="nf-section-kicker">COBRAR UM CLIENTE</div>
          <h2>Crie um link de pagamento.</h2>
          <p>O cliente recebe uma página segura para pagar como preferir.</p>
          <label>Nome do cliente<input autoFocus value={chargeName} onChange={(event) => setChargeName(event.target.value)} placeholder="Ex.: Ana Macuácua" /></label>
          <label>Valor a cobrar<div className="nf-amount-input"><input inputMode="decimal" value={chargeAmount} onChange={(event) => setChargeAmount(event.target.value)} placeholder="0,00" /><span>MZN</span></div></label>
          <div className="nf-modal-info"><ShieldCheck size={15} /> O link expira em 7 dias. Sem custos até receber.</div>
          <button className="nf-charge-submit" type="submit">Criar cobrança <ArrowRight size={15} /></button>
          <span className="nf-modal-cancel" onClick={() => setShowCharge(false)}>Cancelar</span>
        </form>
      </div>}

      {selectedPayment && <div className="nf-drawer-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setSelectedPayment(null); }}>
        <aside className="nf-payment-drawer">
          <div className="nf-drawer-top"><span>DETALHES DO PAGAMENTO</span><button aria-label="Fechar detalhes" onClick={() => setSelectedPayment(null)}><X size={18} /></button></div>
          <div className={`nf-drawer-avatar ${selectedPayment.tone}`}>{selectedPayment.initials}</div>
          <h2>{selectedPayment.customer}</h2><span className="nf-drawer-id">{selectedPayment.id}</span>
          <div className="nf-drawer-total"><span>Valor</span><strong>{selectedPayment.amount}</strong></div>
          <div className="nf-drawer-meta"><span>Estado</span><strong className={`nf-drawer-status ${selectedPayment.status === "Concluído" ? "green" : selectedPayment.status === "Falhou" ? "red" : ""}`}><i />{selectedPayment.status}</strong></div>
          <div className="nf-drawer-meta"><span>Método</span><strong>{selectedPayment.detail.split(" · ")[0]}</strong></div>
          <div className="nf-drawer-meta"><span>Data e hora</span><strong>Hoje, {selectedPayment.time}</strong></div>
          <div className="nf-drawer-meta"><span>Referência</span><strong>{selectedPayment.id}</strong></div>
          <div className="nf-drawer-note"><Clock3 size={15} /> Actualizado há instantes</div>
          <button className="nf-drawer-action" onClick={() => { navigator.clipboard?.writeText(selectedPayment.id); notify("Referência copiada."); }}>Copiar referência <Link2 size={14} /></button>
          <button className="nf-drawer-secondary" onClick={() => setSelectedPayment(null)}>Fechar detalhes</button>
        </aside>
      </div>}

      {toast && <div className="nf-toast"><CheckCircle2 size={17} />{toast}<button aria-label="Fechar aviso" onClick={() => setToast("")}><X size={14} /></button></div>}
    </div>
  );
}

export default NevonFlow;
