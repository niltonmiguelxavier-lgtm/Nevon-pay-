import crypto from "crypto";

export function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Gera uma chave de API. O prefixo indica o ambiente para que foi emitida:
 * `nv_test_...` só pode criar pagamentos de teste, `nv_live_...` em produção.
 */
export function generateApiKey(environment: "TEST" | "LIVE" = "TEST") {
  const prefix = environment === "LIVE" ? "nv_live_" : "nv_test_";
  return prefix + crypto.randomBytes(24).toString("hex");
}

export function apiKeyEnvironment(key: string): "TEST" | "LIVE" | null {
  if (key.startsWith("nv_live_")) return "LIVE";
  if (key.startsWith("nv_test_")) return "TEST";
  return null;
}

export function generateReference(prefix = "NP") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
}

/** Token opaco para cancelamento de checkout pelo cliente final. */
export function generateCancelToken() {
  return crypto.randomBytes(24).toString("hex");
}
