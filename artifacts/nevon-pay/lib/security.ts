import crypto from "crypto";

export function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateApiKey() {
  return "nv_live_" + crypto.randomBytes(24).toString("hex");
}

export function generateReference(prefix = "NP") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
}
