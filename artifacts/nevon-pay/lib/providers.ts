export type PaymentProvider = {
  name: string;
  createPayment(input: {
    amount: string;
    currency: string;
    reference: string;
  }): Promise<{ status: "PENDING"; providerRef: string }>;
};

export const sandboxProvider: PaymentProvider = {
  name: "sandbox",
  async createPayment(input) {
    return { status: "PENDING", providerRef: `sandbox_${input.reference}` };
  }
};

// Adapters reais de e-Mola, M-Pesa e outros provedores devem ser
// implementados somente com credenciais/API oficiais e documentação do provedor.
