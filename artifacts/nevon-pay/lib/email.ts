import { getEmailConfig } from "./env";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailResult =
  | { sent: true; provider: string; id?: string }
  | { sent: false; provider: string | null; error: string; skipped?: boolean };

/**
 * Envio de email transaccional.
 *
 * Regra: só devolvemos `sent: true` quando o provedor confirma a aceitação da
 * mensagem. Sem configuração, a mensagem é ignorada e devolvemos `skipped`,
 * para que o registo da notificação reflicta a realidade (nada de "enviado"
 * fictício).
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const config = getEmailConfig();
  if (!config.enabled) {
    return { sent: false, provider: null, error: config.reason, skipped: true };
  }

  const timeout = AbortSignal.timeout(Number(process.env.EMAIL_TIMEOUT_MS || 10_000));

  try {
    if (config.provider === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: timeout,
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: config.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!response.ok) return { sent: false, provider: "resend", error: body.message || `HTTP ${response.status}` };
      return { sent: true, provider: "resend", id: body.id };
    }

    if (config.provider === "brevo") {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        signal: timeout,
        headers: { "api-key": config.apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { email: config.from, name: "Nevon Pay" },
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          ...(message.html ? { htmlContent: message.html } : {}),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { messageId?: string; message?: string };
      if (!response.ok) return { sent: false, provider: "brevo", error: body.message || `HTTP ${response.status}` };
      return { sent: true, provider: "brevo", id: body.messageId };
    }

    // webhook: adaptador genérico para um serviço próprio de envio de email
    const response = await fetch(config.endpoint!, {
      method: "POST",
      signal: timeout,
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, ...message }),
    });
    if (!response.ok) return { sent: false, provider: "webhook", error: `HTTP ${response.status}` };
    return { sent: true, provider: "webhook" };
  } catch (error) {
    return {
      sent: false,
      provider: config.provider,
      error: error instanceof Error ? error.message : "Falha desconhecida no envio de email.",
    };
  }
}

export function renderNotificationEmail(input: { title: string; description: string; appUrl: string }) {
  const subject = `Nevon Pay · ${input.title}`;
  const text = `${input.title}\n\n${input.description}\n\nAbra o dashboard: ${input.appUrl}/dashboard`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;color:#12261f">
  <h2 style="margin:0 0 8px">${escapeHtml(input.title)}</h2>
  <p style="margin:0 0 16px;color:#41564e">${escapeHtml(input.description)}</p>
  <p style="margin:0 0 24px"><a href="${input.appUrl}/dashboard" style="background:#0f6b4f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Abrir dashboard</a></p>
  <p style="font-size:12px;color:#7b8b85">Notificação automática do Nevon Pay.</p>
</div>`;
  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}
