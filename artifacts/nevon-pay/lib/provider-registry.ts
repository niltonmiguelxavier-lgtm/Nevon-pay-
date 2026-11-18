import { sandboxProvider, type PaymentProvider, type ProviderDescriptor } from "./providers";

const providers: Record<string, PaymentProvider> = {
  sandbox: sandboxProvider,
};

export class ProviderNotConfiguredError extends Error {
  constructor(providerName: string) {
    super(`Payment provider "${providerName}" is not configured.`);
    this.name = "ProviderNotConfiguredError";
  }
}

export function getProvider(name = "sandbox"): PaymentProvider {
  const normalized = name.trim().toLowerCase();
  const provider = providers[normalized];
  if (!provider) throw new ProviderNotConfiguredError(name);
  return provider;
}

export function getProviderDescriptor(name: string): ProviderDescriptor | null {
  const normalized = name.trim().toLowerCase();
  return providers[normalized]?.descriptor ?? null;
}

export function isRegisteredProvider(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return Boolean(providers[normalized]);
}

export function listRegisteredProviders(): ProviderDescriptor[] {
  return Object.values(providers).map((provider) => provider.descriptor);
}
