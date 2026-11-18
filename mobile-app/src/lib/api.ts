import { apiBaseUrl, supabase } from "./supabase";
import type {
  ApiKeyRow,
  DashboardPayload,
  HealthStatus,
  MerchantTransactionItem,
  PlatformCapabilities,
  TransactionDetail,
} from "../types";

export class ApiClientError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = "API_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function resolveAccessToken(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.access_token) {
      await supabase.auth.signOut().catch(() => {});
      return null;
    }
    return data.session.access_token;
  }
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs && expiresAtMs - Date.now() < 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) {
      await supabase.auth.signOut().catch(() => {});
      return null;
    }
    return refreshed.data.session.access_token;
  }
  return session.access_token;
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: Record<string, unknown>;
    authenticated?: boolean;
  } = {}
): Promise<T> {
  if (!apiBaseUrl) {
    throw new ApiClientError("Endereço da API (EXPO_PUBLIC_API_URL) não configurado.", 0, "MISSING_API_URL");
  }

  const { method = "GET", body, authenticated = true } = options;

  const execute = async (forceRefresh = false): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (body) headers["Content-Type"] = "application/json";

    if (authenticated) {
      const token = await resolveAccessToken(forceRefresh);
      if (!token) {
        throw new ApiClientError("Sessão expirada. Inicie sessão novamente.", 401, "UNAUTHENTICATED");
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      return await fetch(`${apiBaseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiClientError("O servidor demorou demasiado tempo a responder.", 408, "TIMEOUT");
      }
      throw new ApiClientError("Não foi possível ligar ao servidor Nevon Pay.", 0, "NETWORK_ERROR");
    } finally {
      clearTimeout(timer);
    }
  };

  let response = await execute(false);
  if (response.status === 401 && authenticated) {
    try {
      response = await execute(true);
      if (response.status === 401) {
        await supabase.auth.signOut().catch(() => {});
      }
    } catch {
      // Deixa o erro de 401 seguir se refresh falhar
    }
  }

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: { code?: string; message?: string };
  } & T;

  if (!response.ok || payload.success === false) {
    throw new ApiClientError(
      payload.error?.message || `Pedido recusado (HTTP ${response.status}).`,
      response.status,
      payload.error?.code || "REQUEST_FAILED"
    );
  }

  return payload;
}

export async function fetchDashboard(merchantId?: string | null): Promise<DashboardPayload> {
  const query = merchantId ? `?merchantId=${encodeURIComponent(merchantId)}` : "";
  const result = await request<{ data: DashboardPayload }>(`/api/dashboard${query}`);
  return result.data;
}

export async function fetchCapabilities(): Promise<PlatformCapabilities> {
  const result = await request<{ capabilities: PlatformCapabilities }>("/api/capabilities", {
    authenticated: false,
  });
  return result.capabilities;
}

export async function fetchHealth(): Promise<HealthStatus> {
  return request<HealthStatus>("/api/health", { authenticated: false });
}

export async function fetchTransactionsPage(params: {
  merchantId?: string | null;
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: MerchantTransactionItem[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
}> {
  const search = new URLSearchParams();
  if (params.merchantId) search.set("merchantId", params.merchantId);
  if (params.status && params.status !== "ALL") search.set("status", params.status);
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return request(`/api/merchant/transactions${qs ? `?${qs}` : ""}`);
}

export async function fetchTransactionDetail(id: string): Promise<TransactionDetail> {
  const result = await request<{ transaction: TransactionDetail }>(
    `/api/merchant/transactions/${encodeURIComponent(id)}`
  );
  return result.transaction;
}

export async function fetchApiKeys(merchantId: string): Promise<ApiKeyRow[]> {
  const result = await request<{ data: ApiKeyRow[] }>(
    `/api/v1/api-keys?merchantId=${encodeURIComponent(merchantId)}`
  );
  return result.data;
}

export async function createApiKey(input: {
  merchantId: string;
  name: string;
  environment?: "TEST" | "LIVE";
}): Promise<ApiKeyRow & { key: string; prefix: string }> {
  const result = await request<{ api_key: ApiKeyRow & { key: string; prefix: string } }>("/api/v1/api-keys", {
    method: "POST",
    body: {
      merchantId: input.merchantId,
      name: input.name,
      environment: input.environment ?? "TEST",
    },
  });
  return result.api_key;
}

export async function revokeApiKey(id: string): Promise<void> {
  await request(`/api/v1/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function createWorkspace(name: string): Promise<void> {
  await request("/api/v1/merchants", {
    method: "POST",
    body: { name },
  });
}

export async function updateProfile(name: string): Promise<{ name: string | null }> {
  const result = await request<{ profile: { name: string | null } }>("/api/account/profile", {
    method: "PATCH",
    body: { name },
  });
  return result.profile;
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<string> {
  const result = await request<{ message: string }>("/api/account/password", {
    method: "POST",
    body: input,
  });
  return result.message;
}

export async function markAllNotificationsRead(): Promise<void> {
  await request("/api/notifications", { method: "POST" });
}

export async function markNotificationRead(id: string): Promise<void> {
  await request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
}
