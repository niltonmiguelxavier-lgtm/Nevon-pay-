import { useState, type ReactNode } from "react";
import "./nevon-control.css";

type GlyphProps = {
  children: ReactNode;
  size?: number;
  strokeWidth?: number;
};

function Glyph({ children, size = 18, strokeWidth = 1.7 }: GlyphProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const navigation = [
  {
    label: "Visão geral",
    icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  },
  {
    label: "Pagamentos",
    icon: <><path d="M4 6.5h16v12H4z" /><path d="M4 10h16M8 14h3" /><path d="M7 6.5V4h10v2.5" /></>,
  },
  {
    label: "Integrações",
    icon: <><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M7 7h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Z" /><path d="M9 13h6M12 10v6" /></>,
  },
  {
    label: "API e webhooks",
    icon: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></>,
  },
];

export function NevonControl() {
  const [activeNav, setActiveNav] = useState("Visão geral");
  const [modalOpen, setModalOpen] = useState(false);
  const [syncLabel, setSyncLabel] = useState("há 2 min");
  const [notice, setNotice] = useState("");

  const handleNavigation = (label: string) => {
    setActiveNav(label);
    if (label !== "Visão geral") {
      setNotice(`${label} estará disponível nesta conta em breve.`);
      window.setTimeout(() => setNotice(""), 3200);
    }
  };

  return (
    <div className="nevon-shell">
      <aside className="nevon-rail">
        <div className="nevon-brand">
          <span className="nevon-mark" aria-hidden="true"><span /></span>
          <span className="nevon-brand-name">nevon<span>pay</span></span>
        </div>

        <div className="nevon-account">
          <div className="nevon-account-icon">N</div>
          <div className="nevon-account-copy">
            <span>ESPAÇO DE TRABALHO</span>
            <strong>Nevon Comércio</strong>
          </div>
          <Glyph size={15}><path d="m8 10 4 4 4-4" /></Glyph>
        </div>

        <div className="nevon-nav-caption">OPERAÇÃO</div>
        <nav className="nevon-nav" aria-label="Navegação principal">
          {navigation.map((item) => (
            <button
              className={`nevon-nav-item ${activeNav === item.label ? "is-active" : ""}`}
              key={item.label}
              onClick={() => handleNavigation(item.label)}
              type="button"
            >
              <Glyph size={17}>{item.icon}</Glyph>
              <span>{item.label}</span>
              {item.label === "Pagamentos" && <span className="nav-zero">0</span>}
            </button>
          ))}
        </nav>

        <div className="nevon-rail-spacer" />
        <div className="nevon-sandbox-card">
          <div className="sandbox-orbit"><span /></div>
          <div className="sandbox-copy">
            <strong>Ambiente de teste</strong>
            <span>Os pagamentos não são reais.</span>
          </div>
          <span className="sandbox-live-dot" />
        </div>
        <button className="nevon-profile" type="button" onClick={() => setModalOpen(true)}>
          <span className="profile-avatar">NC</span>
          <span className="profile-copy"><strong>Equipa Nevon</strong><small>Plano de desenvolvimento</small></span>
          <Glyph size={16}><path d="m8 10 4 4 4-4" /></Glyph>
        </button>
      </aside>

      <main className="nevon-main">
        <header className="nevon-topbar">
          <div className="breadcrumb"><span>Workspace</span><i>/</i><strong>Visão geral</strong></div>
          <div className="topbar-tools">
            <span className="synced-label">Sincronizado {syncLabel}</span>
            <button className="icon-button" type="button" aria-label="Atualizar dados" onClick={() => setSyncLabel("agora")}>
              <Glyph size={17}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.7 9a7 7 0 0 1 11.6-2L20 12M4 12l2.7 5a7 7 0 0 0 11.6-2" /></Glyph>
            </button>
            <button className="help-button" type="button" onClick={() => setModalOpen(true)}>
              <Glyph size={16}><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4.1 1.9c-1 .8-1.7 1.2-1.7 2.6M12 17h.01" /></Glyph>
              Ajuda
            </button>
          </div>
        </header>

        <div className="nevon-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-rule" /> TERÇA-FEIRA, 18 DE JUNHO</div>
              <h1>Visão geral<span>.</span></h1>
              <p>A sua operação de pagamentos, num relance.</p>
            </div>
            <button className="primary-action" type="button" onClick={() => setModalOpen(true)}>
              <Glyph size={17}><path d="M12 5v14M5 12h14" /></Glyph>
              Criar pagamento
            </button>
          </section>

          <section className="overview-grid" aria-label="Resumo financeiro">
            <article className="balance-panel">
              <div className="balance-topline">
                <div className="balance-label"><span className="balance-indicator" /> SALDO DISPONÍVEL</div>
                <span className="currency-tag">MZN <Glyph size={13}><path d="m8 10 4 4 4-4" /></Glyph></span>
              </div>
              <div className="balance-value">0,00 <span>MZN</span></div>
              <div className="balance-foot">
                <div className="balance-context">
                  <span className="balance-mini-icon"><Glyph size={15}><path d="M4 17 9 12l3 3 8-9" /><path d="M15 6h5v5" /></Glyph></span>
                  <span>Saldo de teste</span>
                </div>
                <span className="balance-note">Os fundos não são reais</span>
              </div>
              <div className="balance-graphic" aria-hidden="true">
                <div className="graphic-grid" />
                <svg viewBox="0 0 720 94" preserveAspectRatio="none">
                  <path className="chart-fill" d="M0 67 C75 65 76 66 122 66 S193 66 238 66 S305 66 350 66 S426 66 470 66 S547 66 595 66 S666 66 720 66 V94 H0Z" />
                  <path className="chart-line" d="M0 67 C75 65 76 66 122 66 S193 66 238 66 S305 66 350 66 S426 66 470 66 S547 66 595 66 S666 66 720 66" />
                  <circle cx="595" cy="66" r="4.2" />
                </svg>
                <span className="graphic-label">SEM MOVIMENTOS</span>
              </div>
            </article>

            <div className="metric-stack">
              <article className="metric-panel payment-metric">
                <div className="metric-heading">
                  <span className="metric-icon"><Glyph size={18}><path d="M4 6.5h16v12H4z" /><path d="M4 10h16M8 14h3" /></Glyph></span>
                  <span className="metric-period">ESTE MÊS</span>
                  <button className="metric-more" type="button" aria-label="Informação sobre pagamentos" onClick={() => setNotice("O total será atualizado quando receber pagamentos.")}>
                    <Glyph size={17}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Glyph>
                  </button>
                </div>
                <div className="metric-number">0</div>
                <div className="metric-title">Pagamentos recebidos</div>
                <div className="metric-bottom"><span className="metric-neutral">—</span><span>sem atividade ainda</span></div>
              </article>

              <article className="metric-panel environment-metric">
                <div className="environment-top">
                  <span className="status-icon"><Glyph size={18}><path d="m5 12 4 4L19 6" /></Glyph></span>
                  <span className="status-pill"><span /> ACTIVO</span>
                </div>
                <div className="environment-title">Sandbox</div>
                <p>Ambiente seguro para testar a sua integração.</p>
                <button className="text-action" type="button" onClick={() => setModalOpen(true)}>
                  Sobre o ambiente <Glyph size={14}><path d="M5 12h14M13 6l6 6-6 6" /></Glyph>
                </button>
              </article>
            </div>
          </section>

          <section className="lower-grid">
            <article className="activity-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">ACTIVIDADE</span>
                  <h2>Pagamentos recentes</h2>
                </div>
                <button className="subtle-action" type="button" onClick={() => handleNavigation("Pagamentos")}>
                  Ver todos <Glyph size={15}><path d="M5 12h14M13 6l6 6-6 6" /></Glyph>
                </button>
              </div>
              <div className="activity-table-head">
                <span>CLIENTE / REFERÊNCIA</span><span>DATA</span><span>VALOR</span><span>ESTADO</span>
              </div>
              <div className="activity-empty">
                <div className="empty-illustration">
                  <div className="empty-sheet"><span /><span /><span /></div>
                  <span className="empty-orb orb-one" /><span className="empty-orb orb-two" />
                  <span className="empty-plus">+</span>
                </div>
                <h3>Nada por aqui, ainda</h3>
                <p>Quando um pagamento acontecer, vai encontrá-lo nesta lista.</p>
                <button className="empty-action" type="button" onClick={() => setModalOpen(true)}>
                  Como criar um pagamento <Glyph size={14}><path d="M5 12h14M13 6l6 6-6 6" /></Glyph>
                </button>
              </div>
            </article>

            <article className="readiness-panel">
              <div className="readiness-top">
                <span className="readiness-icon"><Glyph size={18}><path d="M12 3 4.5 6v5.5c0 4.6 3.2 7.7 7.5 9.5 4.3-1.8 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></Glyph></span>
                <span className="readiness-label">PRÓXIMO PASSO</span>
              </div>
              <h2>Pronto para integrar?</h2>
              <p>O espaço está isolado e pronto para os seus primeiros testes.</p>
              <div className="readiness-steps">
                <div className="readiness-step is-complete"><span className="step-marker"><Glyph size={11}><path d="m3 6 2 2 4-4" /></Glyph></span><span>Espaço criado</span><small>Concluído</small></div>
                <div className="readiness-step"><span className="step-marker"><span /></span><span>Ligar um provedor</span><small>Por fazer</small></div>
              </div>
              <button className="readiness-button" type="button" onClick={() => setModalOpen(true)}>
                Ver configuração <Glyph size={15}><path d="M5 12h14M13 6l6 6-6 6" /></Glyph>
              </button>
            </article>
          </section>
          <footer className="dashboard-footer"><span>NEVON PAY <b>·</b> PAGAMENTOS SIMPLES, INFRAESTRUTURA SEGURA.</span><span>METICAL MOÇAMBICANO <b>·</b> MZN</span></footer>
        </div>
      </main>

      {notice && <div className="nevon-toast" role="status"><span className="toast-dot" />{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}
      {modalOpen && (
        <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section className="nevon-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal-close" type="button" onClick={() => setModalOpen(false)} aria-label="Fechar"><Glyph size={17}><path d="m6 6 12 12M18 6 6 18" /></Glyph></button>
            <div className="modal-symbol"><Glyph size={22}><path d="M12 3 4.5 6v5.5c0 4.6 3.2 7.7 7.5 9.5 4.3-1.8 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></Glyph></div>
            <span className="modal-kicker">CONTA DE TESTE</span>
            <h2 id="modal-title">Primeiro, ligue um provedor.</h2>
            <p>O seu painel está em modo Sandbox. Para criar pagamentos de teste, configure um provedor e use as respectivas credenciais de teste.</p>
            <div className="modal-info"><span className="modal-info-dot" /><span><strong>Os seus fundos estão protegidos.</strong><br />Nenhum pagamento real será processado neste ambiente.</span></div>
            <button className="modal-confirm" type="button" onClick={() => setModalOpen(false)}>Entendido</button>
          </section>
        </div>
      )}
    </div>
  );
}
