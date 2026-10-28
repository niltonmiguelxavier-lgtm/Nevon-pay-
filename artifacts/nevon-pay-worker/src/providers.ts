export type PaymentProvider = {
  name: string;
  createPayment(input: { amount: string; currency: string; reference: string }): Promise<{ status: "PENDING"; providerRef: string }>;
};

const sandbox: PaymentProvider = {
  name: "sandbox",
  async createPayment(i) { return { status: "PENDING", providerRef: `sandbox_${i.reference}` }; }
};

// e-Mola e M-Pesa: adaptadores reais só com documentação/credenciais oficiais.
const providers: Record<string, PaymentProvider> = { sandbox };

export class ProviderNotConfiguredError extends Error {}
export function getProvider(name = "sandbox") {
  const p = providers[name];
  if (!p) throw new ProviderNotConfiguredError(name);
  return p;
}
