import { useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Globe2,
  LockKeyhole,
  Menu,
  Radio,
  ShieldCheck,
  X,
} from "lucide-react";
import "./nevon-pay-polished.css";

export default function NevonPayPolished() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const copyExample = async () => {
    const example = "curl https://api.nevonpay.co.mz/v1/health";
    try {
      await navigator.clipboard.writeText(example);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice("Exemplo: curl https://api.nevonpay.co.mz/v1/health");
    }
  };

  return (
    <div className="np-page">
      <div className="np-topline">
        <span className="np-live-dot" />
        Infraestrutura de pagamentos feita para Moçambique
        <ArrowRight size={13} strokeWidth={1.8} />
      </div>

      <header className="np-header">
        <a className="np-brand" href="#inicio" aria-label="Nevon Pay, início">
          <span className="np-brand-mark"><span /><span /><span /></span>
          <span>nevon<span className="np-brand-pay">pay</span></span>
        </a>

        <button
          className="np-mobile-toggle"
          type="button"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>

        <nav className={`np-nav${menuOpen ? " np-nav-open" : ""}`} aria-label="Navegação principal">
          <a href="#plataforma" onClick={() => setMenuOpen(false)}>Plataforma</a>
          <a href="#integracao" onClick={() => setMenuOpen(false)}>Para developers</a>
          <a href="#seguranca" onClick={() => setMenuOpen(false)}>Segurança</a>
          <a href="#contacto" onClick={() => setMenuOpen(false)}>Contacto</a>
          <button
            className="np-nav-cta"
            type="button"
            onClick={() => setNotice("O dashboard Nevon Pay está a ser preparado para demonstração.")}
          >
            Explorar dashboard <ArrowUpRight size={15} />
          </button>
        </nav>
      </header>

      <main id="inicio">
        <section className="np-hero">
          <div className="np-hero-copy">
            <div className="np-eyebrow"><span /> PAGAMENTOS, SEM COMPLICAÇÃO</div>
            <h1>O seu negócio<br />em <em>movimento.</em></h1>
            <p className="np-hero-intro">
              Uma forma mais simples de receber pagamentos digitais.
              Conecte os seus clientes, canais e provedores numa só plataforma.
            </p>
            <div className="np-hero-actions">
              <a className="np-button-primary" href="#contacto">
                Começar a integrar <ArrowRight size={16} />
              </a>
              <a className="np-text-link" href="#plataforma">
                Conhecer a plataforma <ArrowDownRight size={15} />
              </a>
            </div>
            <div className="np-proofline">
              <span className="np-proof-icon"><ShieldCheck size={15} /></span>
              <span>Integrações seguras, construídas para crescer consigo.</span>
            </div>
          </div>

          <div className="np-hero-art" aria-label="Pré-visualização do fluxo de pagamento">
            <div className="np-art-orbit np-orbit-one" />
            <div className="np-art-orbit np-orbit-two" />
            <div className="np-art-stamp">MZ<br /><span>PAYMENTS</span></div>
            <div className="np-payment-card">
              <div className="np-card-top">
                <span className="np-card-label"><span className="np-card-dot" /> CONTA COMERCIAL</span>
                <span className="np-card-more">•••</span>
              </div>
              <div className="np-card-balance-label">Saldo disponível</div>
              <div className="np-card-balance">MT 248.560<span>,40</span></div>
              <div className="np-card-change"><ArrowUpRight size={13} /> 12,8% <span>este mês</span></div>
              <div className="np-card-chart" aria-hidden="true">
                <div className="np-chart-grid"><span /><span /><span /></div>
                <svg viewBox="0 0 440 94" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="np-area-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#c9ee78" stopOpacity=".34" />
                      <stop offset="100%" stopColor="#c9ee78" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path className="np-chart-area" d="M0 76 C23 73 29 65 48 68 S78 79 101 57 S130 63 149 49 S181 56 198 38 S231 47 253 34 S281 44 303 26 S339 39 356 20 S387 32 409 12 L440 8 L440 94 L0 94Z" />
                  <path className="np-chart-line" d="M0 76 C23 73 29 65 48 68 S78 79 101 57 S130 63 149 49 S181 56 198 38 S231 47 253 34 S281 44 303 26 S339 39 356 20 S387 32 409 12 L440 8" />
                  <circle cx="409" cy="12" r="4.3" />
                </svg>
              </div>
              <div className="np-chart-axis"><span>01 JUN</span><span>08 JUN</span><span>15 JUN</span><span>22 JUN</span><span>HOJE</span></div>
            </div>
            <div className="np-payment-float">
              <span className="np-float-icon"><Check size={16} /></span>
              <span><strong>Pagamento recebido</strong><small>Agora mesmo · M-Pesa</small></span>
              <b>+ MT 2.450</b>
            </div>
            <div className="np-art-caption"><span /> LIVE PAYMENT FLOW</div>
          </div>

          <div className="np-hero-bottom">
            <span>UMA INFRAESTRUTURA. MAIS POSSIBILIDADES.</span>
            <a href="#plataforma">Deslize para explorar <ChevronDown size={14} /></a>
          </div>
        </section>

        <section className="np-trust-strip" aria-label="Destaques da plataforma">
          <div><span className="np-trust-number">01</span><span><b>Uma integração</b><small>para múltiplos provedores</small></span></div>
          <div><span className="np-trust-number">02</span><span><b>Visibilidade em tempo real</b><small>de cada transação</small></span></div>
          <div><span className="np-trust-number">03</span><span><b>Feito para o mercado local</b><small>com alcance além-fronteiras</small></span></div>
          <span className="np-moz-mark"><Globe2 size={15} /> MAPUTO · MZ</span>
        </section>

        <section className="np-platform" id="plataforma">
          <div className="np-section-heading">
            <div>
              <div className="np-eyebrow"><span /> UMA PLATAFORMA, TODO O FLUXO</div>
              <h2>Menos fricção.<br /><em>Mais negócio.</em></h2>
            </div>
            <p>Da primeira chamada à confirmação do pagamento, mantenha cada etapa clara — para si e para os seus clientes.</p>
          </div>
          <div className="np-feature-list">
            <a className="np-feature-row" href="#integracao">
              <span className="np-feature-icon"><Radio size={20} /></span>
              <span className="np-feature-index">01</span>
              <span className="np-feature-copy"><b>Checkout unificado</b><small>Uma experiência consistente em todos os seus canais de venda.</small></span>
              <span className="np-feature-tag">PARA OS SEUS CLIENTES</span>
              <ArrowUpRight className="np-feature-arrow" size={18} />
            </a>
            <a className="np-feature-row" href="#integracao">
              <span className="np-feature-icon"><Code2 size={20} /></span>
              <span className="np-feature-index">02</span>
              <span className="np-feature-copy"><b>API pensada para developers</b><small>Integre com documentação directa e respostas previsíveis.</small></span>
              <span className="np-feature-tag">PARA A SUA EQUIPA</span>
              <ArrowUpRight className="np-feature-arrow" size={18} />
            </a>
            <a className="np-feature-row" href="#seguranca">
              <span className="np-feature-icon"><LockKeyhole size={20} /></span>
              <span className="np-feature-index">03</span>
              <span className="np-feature-copy"><b>Orquestração segura</b><small>Uma camada central para gerir provedores e acompanhar operações.</small></span>
              <span className="np-feature-tag">PARA A SUA OPERAÇÃO</span>
              <ArrowUpRight className="np-feature-arrow" size={18} />
            </a>
          </div>
        </section>

        <section className="np-api-band" id="integracao">
          <div className="np-api-copy">
            <div className="np-eyebrow np-eyebrow-light"><span /> DE IDEIA A INTEGRAÇÃO</div>
            <h2>Uma API clara.<br /><em>Um caminho curto.</em></h2>
            <p>Comece com uma chamada simples. O fluxo cresce ao ritmo da sua operação.</p>
            <button className="np-api-link" type="button" onClick={copyExample}>
              {copied ? "Copiado" : "Copiar exemplo"} {copied ? <Check size={15} /> : <ArrowRight size={15} />}
            </button>
          </div>
          <div className="np-code-window">
            <div className="np-code-head">
              <span><i /> <i /> <i /></span>
              <small>health-check.sh</small>
              <button type="button" onClick={copyExample} aria-label="Copiar exemplo de código">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="np-code-body">
              <span className="np-code-line"><i>1</i><span><b>curl</b> <em>https://api.nevonpay.co.mz</em>/v1/health</span></span>
              <span className="np-code-line"><i>2</i><span /></span>
              <span className="np-code-line"><i>3</i><span className="np-code-comment">{"// Pronto para a próxima etapa."}</span></span>
              <span className="np-code-line"><i>4</i><span className="np-code-success"><Check size={13} /> API disponível <small>200 OK</small></span></span>
            </div>
            <div className="np-code-footer"><span>REST API</span><span>JSON</span><span>v1</span><span className="np-code-status"><span /> OPERATIONAL</span></div>
          </div>
        </section>

        <section className="np-security" id="seguranca">
          <span className="np-security-icon"><ShieldCheck size={23} /></span>
          <div><div className="np-eyebrow"><span /> CONFIANÇA EM CADA ETAPA</div><h2>Segurança desde<br />a primeira chamada.</h2></div>
          <p>Controlo de acesso e comunicação protegida fazem parte da base. A sua equipa mantém a visibilidade; os seus clientes, a tranquilidade.</p>
          <a href="#contacto">Saiba mais <ArrowRight size={15} /></a>
        </section>
      </main>

      <footer className="np-footer" id="contacto">
        <a className="np-brand np-footer-brand" href="#inicio">
          <span className="np-brand-mark"><span /><span /><span /></span>
          <span>nevon<span className="np-brand-pay">pay</span></span>
        </a>
        <span className="np-footer-note">Pagamentos simples. Infraestrutura segura.</span>
        <a className="np-footer-contact" href="mailto:hello@nevonpay.co.mz">Fale connosco <ArrowUpRight size={14} /></a>
        <span className="np-copyright">© 2025 NEVON PAY · MAPUTO, MZ</span>
      </footer>

      {notice && (
        <div className="np-toast" role="status">
          <span><Check size={15} /></span>{notice}
          <button type="button" aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}
