"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Cancelamento pelo cliente final. Usa o cancel_token da sessão, por isso não
 * precisa de chave de API e não permite cancelar sessões de outras pessoas.
 */
export default function CancelCheckoutButton({ sessionId, cancelToken }: { sessionId: string; cancelToken: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/checkout/session/${sessionId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel_token: cancelToken }),
      });
      const result = (await response.json()) as { success: boolean; error?: { message: string } };
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Não foi possível cancelar.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao cancelar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      {error && <p className="muted" role="alert" style={{ color: "#9b2820" }}>{error}</p>}
      <button className="btn" type="button" onClick={cancel} disabled={busy} data-testid="cancel-checkout">
        {busy ? "A cancelar…" : "Cancelar este pagamento"}
      </button>
    </div>
  );
}
