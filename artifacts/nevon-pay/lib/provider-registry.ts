import { sandboxProvider, PaymentProvider } from "./providers";

const providers: Record<string, PaymentProvider> = {
  sandbox: sandboxProvider
};

export class ProviderNotConfiguredError extends Error {
  constructor(providerName: string) {
    super(`Payment provider "${providerName}" is not configured.`);
    this.name = "ProviderNotConfiguredError";
  }
}

export function getProvider(name = "sandbox") {
  const provider = providers[name];
  if (!provider) throw new ProviderNotConfiguredError(name);
  return provider;
}
