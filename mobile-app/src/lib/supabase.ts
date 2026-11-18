import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
export const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();
export const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/$/, "");

export const isAppConfigured = Boolean(supabaseUrl && supabaseAnonKey && apiBaseUrl);

const CHUNK_SIZE = 1800;

function sanitizeKey(key: string) {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

const chunkedSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    const safeKey = sanitizeKey(key);
    const countRaw = await SecureStore.getItemAsync(`${safeKey}__count`);
    if (!countRaw) {
      return SecureStore.getItemAsync(safeKey);
    }
    const count = Number.parseInt(countRaw, 10);
    if (!Number.isFinite(count) || count <= 0) return null;

    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(`${safeKey}__${i}`);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(key, value);
      } catch {
        // Ignora falhas de quota em modo privado
      }
      return;
    }
    const safeKey = sanitizeKey(key);
    await chunkedSecureStorage.removeItem(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(safeKey, value);
      return;
    }

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${safeKey}__count`, String(chunks.length));
    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(`${safeKey}__${i}`, chunks[i]);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        if (typeof window !== "undefined") window.localStorage.removeItem(key);
      } catch {
        // Ignora
      }
      return;
    }
    const safeKey = sanitizeKey(key);
    const countRaw = await SecureStore.getItemAsync(`${safeKey}__count`);
    if (countRaw) {
      const count = Number.parseInt(countRaw, 10);
      if (Number.isFinite(count) && count > 0) {
        for (let i = 0; i < count; i += 1) {
          await SecureStore.deleteItemAsync(`${safeKey}__${i}`);
        }
      }
      await SecureStore.deleteItemAsync(`${safeKey}__count`);
    }
    await SecureStore.deleteItemAsync(safeKey);
  },
};

export const supabase = createClient(
  supabaseUrl || "https://invalid.supabase.co",
  supabaseAnonKey || "missing-public-key",
  {
    auth: {
      storage: chunkedSecureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

type SupabaseLikeError = { message?: string; code?: string } | null | undefined;

const byCode: Record<string, string> = {
  invalid_credentials: "Email ou palavra-passe incorrectos.",
  email_not_confirmed: "Este email ainda não foi confirmado. Abra o link de confirmação na sua caixa de entrada.",
  user_already_exists: "Já existe uma conta com este email. Inicie sessão ou recupere a palavra-passe.",
  user_not_found: "Não existe nenhuma conta com este email.",
  weak_password: "A palavra-passe é demasiado fraca. Use pelo menos 8 caracteres.",
  over_email_send_rate_limit: "Foram pedidos demasiados emails em pouco tempo. Aguarde alguns minutos.",
  over_request_rate_limit: "Demasiados pedidos. Aguarde um momento e tente novamente.",
  email_address_invalid: "O endereço de email indicado não é válido.",
  signup_disabled: "A criação de contas está desactivada neste projecto.",
  same_password: "A nova palavra-passe tem de ser diferente da actual.",
  session_not_found: "A sessão expirou. Inicie sessão novamente.",
};

const byMessage: Array<[RegExp, string]> = [
  [/invalid login credentials/i, byCode.invalid_credentials],
  [/email not confirmed/i, byCode.email_not_confirmed],
  [/user already registered|already registered/i, byCode.user_already_exists],
  [/password should be at least/i, byCode.weak_password],
  [/email rate limit exceeded|only request this after/i, byCode.over_email_send_rate_limit],
  [/new password should be different/i, byCode.same_password],
  [/invalid email/i, byCode.email_address_invalid],
  [/fetch failed|network request failed|failed to fetch/i, "Não foi possível contactar o servidor de autenticação. Verifique a ligação à internet."],
];

export function translateAuthError(error: SupabaseLikeError, fallback = "Não foi possível concluir o pedido.") {
  if (!error) return fallback;
  if (error.code && byCode[error.code]) return byCode[error.code];
  const msg = error.message ?? "";
  for (const [pattern, text] of byMessage) {
    if (pattern.test(msg)) return text;
  }
  return msg || fallback;
}
