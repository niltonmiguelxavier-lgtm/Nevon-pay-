import type { PaymentStatus, ProviderDescriptor, WorkspaceItem } from "../types";

export function formatCurrency(value: string | number, currency = "MZN"): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  try {
    return new Intl.NumberFormat("pt-MZ", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${num.toFixed(2)} ${currency}`;
  }
}

export function formatDate(value: string, withTime = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(
      "pt-MZ",
      withTime
        ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
        : { day: "2-digit", month: "short", year: "numeric" }
    ).format(date);
  } catch {
    return date.toISOString().slice(0, withTime ? 16 : 10).replace("T", " ");
  }
}

export const STATUS_LABELS: Record<PaymentStatus, string> = {
  COMPLETED: "Concluído",
  OPEN: "Aberto",
  PENDING: "Pendente",
  PROCESSING: "A processar",
  FAILED: "Falhado",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
};

export function statusColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case "COMPLETED":
      return { bg: "#e7f3ec", fg: "#126e50" };
    case "OPEN":
    case "PENDING":
    case "PROCESSING":
      return { bg: "#fdf4e6", fg: "#9a6b24" };
    case "FAILED":
    case "CANCELLED":
    case "EXPIRED":
      return { bg: "#fdf0ef", fg: "#b43c35" };
    default:
      return { bg: "#f0f4f2", fg: "#4c6259" };
  }
}

export function workspaceStatusLabel(status: WorkspaceItem["status"]): string {
  if (status === "ACTIVE") return "Activo";
  if (status === "PENDING") return "Pendente";
  return "Suspenso";
}

export function resolveProviderDisplayName(
  providerId: string | null | undefined,
  catalog: ProviderDescriptor[] = []
): string {
  if (!providerId) return "Não identificado";
  const found = catalog.find((item) => item.id.toLowerCase() === providerId.toLowerCase());
  if (found) return found.displayName;

  const normalized = providerId.toLowerCase();
  if (normalized.includes("mpesa") || normalized.includes("m-pesa")) return "M-Pesa";
  if (normalized.includes("emola") || normalized.includes("e-mola")) return "e-Mola";
  if (["card", "credit", "debit", "visa", "mastercard"].some((p) => normalized.includes(p))) return "Cartão bancário";
  if (normalized.includes("bank")) return "Banco";
  if (normalized === "sandbox") return "Sandbox (Teste)";
  return providerId.replace(/[_-]/g, " ");
}

export function getInitials(name?: string | null): string {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}
