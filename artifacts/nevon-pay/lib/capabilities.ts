import { listRegisteredProviders } from "./provider-registry";
import type { ProviderDescriptor } from "./providers";

export const CAPABILITIES_CONTRACT_VERSION = "2026-11";

export type PlatformCapabilities = {
  contractVersion: string;
  mobile: {
    minVersion: string;
    recommendedVersion: string;
  };
  paymentProcessing: {
    configured: boolean;
    liveEnabled: boolean;
    sandboxEnabled: boolean;
    notice: string;
  };
  providers: ProviderDescriptor[];
  supportedCurrencies: string[];
  features: {
    dashboard: boolean;
    transactions: boolean;
    transactionPagination: boolean;
    customers: boolean;
    methods: boolean;
    reports: boolean;
    apiKeys: boolean;
    workspaces: boolean;
    notifications: boolean;
    profile: boolean;
    passwordChange: boolean;
    pushNotifications: boolean;
    livePayments: boolean;
  };
};

/**
 * Contrato dinâmico de capacidades e provedores do servidor.
 * Tanto o site como a app móvel leem este contrato para reflectir os
 * provedores efectivamente integrados no backend sem duplicar listas fixas.
 */
export function getPlatformCapabilities(): PlatformCapabilities {
  const providers = listRegisteredProviders();
  const liveProviders = providers.filter((provider) => provider.configured && provider.liveReady);
  const sandboxProvider = providers.find((provider) => provider.id === "sandbox" && provider.configured);
  const currencies = Array.from(
    new Set(providers.flatMap((provider) => provider.currencies).filter(Boolean))
  );

  const liveEnabled = liveProviders.length > 0;
  const notice = liveEnabled
    ? `Processamento activo para: ${liveProviders.map((provider) => provider.displayName).join(", ")}.`
    : "O processamento real de pagamentos (M-Pesa, e-Mola e bancos) ainda não está configurado neste servidor. Assim que novos provedores forem integrados no backend, ficarão disponíveis aqui automaticamente.";

  return {
    contractVersion: CAPABILITIES_CONTRACT_VERSION,
    mobile: {
      minVersion: "1.0.0",
      recommendedVersion: "1.0.0",
    },
    paymentProcessing: {
      configured: liveEnabled,
      liveEnabled,
      sandboxEnabled: Boolean(sandboxProvider),
      notice,
    },
    providers,
    supportedCurrencies: currencies.length > 0 ? currencies : ["MZN"],
    features: {
      dashboard: true,
      transactions: true,
      transactionPagination: true,
      customers: true,
      methods: true,
      reports: true,
      apiKeys: true,
      workspaces: true,
      notifications: true,
      profile: true,
      passwordChange: true,
      pushNotifications: false,
      livePayments: liveEnabled,
    },
  };
}
