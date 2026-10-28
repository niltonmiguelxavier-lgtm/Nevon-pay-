import "./_group.css";

export function Current() {
  return (
    <main className="container">
      <div className="dashboard-heading">
        <div>
          <p className="auth-eyebrow">NEVON PAY · CONTA</p>
          <h1>O seu dashboard</h1>
          <p className="muted">Sessão iniciada como comerciante@exemplo.co.mz</p>
        </div>
        <button className="auth-secondary" type="button">Terminar sessão</button>
      </div>

      <div className="auth-alert" role="status">
        A autenticação está activa, mas a base de dados do Supabase ainda não está ligada. Configure
        a ligação PostgreSQL para guardar o perfil.
      </div>

      <div className="grid">
        <div className="card"><h3>Saldo</h3><p>0,00 MZN</p></div>
        <div className="card"><h3>Pagamentos</h3><p>0</p></div>
        <div className="card"><h3>Estado</h3><p>Sandbox</p></div>
      </div>

      <section className="card dashboard-empty">
        <h2>Conta pronta para configuração</h2>
        <p className="muted">
          A conta está autenticada. Os métodos de pagamento continuam em sandbox até os provedores
          oficiais serem configurados.
        </p>
        <a className="btn" href="#">Voltar à página inicial</a>
        <p className="database-note">Base de dados activa: supabase</p>
      </section>
    </main>
  );
}
