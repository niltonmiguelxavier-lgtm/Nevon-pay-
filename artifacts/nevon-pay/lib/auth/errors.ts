/**
 * Tradução dos erros do Supabase Auth para mensagens accionáveis em português.
 * O código anterior mostrava mensagens genéricas em inglês ("Invalid login
 * credentials"), o que impedia o utilizador de saber o que corrigir.
 */
type SupabaseLikeError = { message?: string; code?: string; status?: number } | null | undefined;

const byCode: Record<string, string> = {
  invalid_credentials: "Email ou palavra-passe incorrectos.",
  email_not_confirmed:
    "Este email ainda não foi confirmado. Abra o link de confirmação enviado para a sua caixa de entrada.",
  user_already_exists: "Já existe uma conta com este email. Inicie sessão ou recupere a palavra-passe.",
  user_not_found: "Não existe nenhuma conta com este email.",
  weak_password:
    "A palavra-passe é demasiado fraca. Use pelo menos 8 caracteres, com letras e números.",
  over_email_send_rate_limit:
    "Foram pedidos demasiados emails em pouco tempo. Aguarde alguns minutos antes de tentar novamente.",
  over_request_rate_limit: "Demasiados pedidos. Aguarde um momento e tente novamente.",
  email_address_invalid: "O endereço de email indicado não é válido.",
  signup_disabled: "A criação de contas está desactivada neste projeto.",
  same_password: "A nova palavra-passe tem de ser diferente da actual.",
  reauthentication_needed: "Por segurança, volte a introduzir a palavra-passe actual.",
  session_not_found: "A sessão expirou. Inicie sessão novamente.",
  otp_expired: "O link expirou. Peça um novo email.",
};

const byMessage: Array<[RegExp, string]> = [
  [/invalid login credentials/i, byCode.invalid_credentials],
  [/email not confirmed/i, byCode.email_not_confirmed],
  [/user already registered/i, byCode.user_already_exists],
  [/already registered/i, byCode.user_already_exists],
  [/password should be at least/i, byCode.weak_password],
  [/email rate limit exceeded/i, byCode.over_email_send_rate_limit],
  [/for security purposes, you can only request this after/i, byCode.over_email_send_rate_limit],
  [/new password should be different/i, byCode.same_password],
  [/auth session missing/i, "A sessão expirou. Inicie sessão novamente."],
  [/token has expired or is invalid/i, byCode.otp_expired],
  [/invalid email/i, byCode.email_address_invalid],
  [/fetch failed|networkerror|failed to fetch/i, "Não foi possível contactar o serviço de autenticação. Verifique a ligação à internet."],
];

export function authErrorMessage(error: SupabaseLikeError, fallback = "Não foi possível concluir o pedido."): string {
  if (!error) return fallback;
  if (error.code && byCode[error.code]) return byCode[error.code];
  const message = error.message ?? "";
  for (const [pattern, text] of byMessage) {
    if (pattern.test(message)) return text;
  }
  return message || fallback;
}

/** Mensagens mostradas a partir da query string (?error= / ?message=). */
export const authQueryMessages: Record<string, { type: "error" | "success"; text: string }> = {
  auth_callback: {
    type: "error",
    text: "O link de autenticação não pôde ser validado. Pode ter expirado ou já ter sido utilizado. Peça um novo email.",
  },
  link_expired: { type: "error", text: "O link expirou. Peça um novo email de confirmação ou recuperação." },
  supabase: {
    type: "error",
    text: "A ligação ao Supabase não está configurada neste ambiente (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).",
  },
  database: {
    type: "error",
    text: "A conta foi autenticada, mas a base de dados não está acessível. Contacte o administrador.",
  },
  account_conflict: {
    type: "error",
    text: "Existe um perfil com o mesmo email mas com outro identificador. Contacte o suporte para reconciliar a conta.",
  },
  email_confirmado: { type: "success", text: "Email confirmado. A sua conta está pronta a usar." },
  sessao_terminada: { type: "success", text: "Terminou a sessão com segurança." },
  palavra_passe_alterada: { type: "success", text: "Palavra-passe actualizada. Já pode iniciar sessão." },
  email_reenviado: { type: "success", text: "Enviámos um novo email de confirmação. Verifique a caixa de entrada e o spam." },
  recuperacao_enviada: {
    type: "success",
    text: "Se o email existir, enviámos um link para redefinir a palavra-passe.",
  },
};
