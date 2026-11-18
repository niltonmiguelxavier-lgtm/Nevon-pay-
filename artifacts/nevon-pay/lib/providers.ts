export type ProviderCategory = "sandbox" | "mobile_money" | "bank" | "card" | "other";

export type ProviderStatus = "active" | "test_only" | "not_configured";

export type ProviderDescriptor = {
  id: string;
  displayName: string;
  category: ProviderCategory;
  currencies: string[];
  environments: Array<"TEST" | "LIVE">;
  configured: boolean;
  liveReady: boolean;
  status: ProviderStatus;
  statusMessage: string;
  capabilities: {
    collectPayment: boolean;
    checkoutSession: boolean;
    refunds: boolean;
    webhooks: boolean;
  };
};

export type PaymentProvider = {
  name: string;
  descriptor: ProviderDescriptor;
  createPayment(input: {
    amount: string;
    currency: string;
    reference: string;
  }): Promise<{ status: "PENDING"; providerRef: string }>;
};

export const sandboxProvider: PaymentProvider = {
  name: "sandbox",
  descriptor: {
    id: "sandbox",
    displayName: "Sandbox (Teste)",
    category: "sandbox",
    currencies: ["MZN"],
    environments: ["TEST"],
    configured: true,
    liveReady: false,
    status: "test_only",
    statusMessage: "Apenas disponível com chaves de teste (nv_test_). Não processa dinheiro real.",
    capabilities: {
      collectPayment: true,
      checkoutSession: false,
      refunds: false,
      webhooks: false,
    },
  },
  async createPayment(input) {
    return { status: "PENDING", providerRef: `sandbox_${input.reference}` };
  },
};

// Adapters reais de e-Mola, M-Pesa e outros provedores devem ser
// implementados somente com credenciais/API oficiais e documentação do provedor,
// declarando o seu `descriptor` e registando-os em `lib/provider-registry.ts`.
