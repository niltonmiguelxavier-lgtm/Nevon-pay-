export type PaymentStatus =
  | "OPEN"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

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

export type WorkspaceItem = {
  id: string;
  name: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
};

export type DashboardPayment = {
  id: string;
  reference: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  provider: string | null;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
};

export type MerchantTransactionItem = DashboardPayment & {
  merchantId: string;
  merchantName: string;
  customerPhone: string | null;
};

export type TransactionDetail = {
  id: string;
  reference: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  provider: string | null;
  providerRef: string | null;
  merchant: WorkspaceItem;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  session: {
    id: string;
    status: PaymentStatus;
    expiresAt: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  transactionCount: number;
  lastPaymentAt: string;
};

export type DashboardChartPoint = {
  month: string;
  label: string;
  received: string;
  transactions: number;
};

export type DashboardMethod = {
  provider: string;
  currency: string;
  transactions: number;
  completedTransactions: number;
  received: string;
};

export type DashboardNotification = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  severity: "info" | "attention" | "critical";
  read: boolean;
};

export type DashboardPayload = {
  user: {
    email: string;
    name: string | null;
  };
  workspaces: WorkspaceItem[];
  summary: {
    availableBalance: string;
    receivedTotal: string;
    totalTransactions: number;
    pendingAmount: string;
    pendingTransactions: number;
    completedTransactions: number;
  };
  chart: DashboardChartPoint[];
  transactions: DashboardPayment[];
  customers: DashboardCustomer[];
  methods: DashboardMethod[];
  notifications: DashboardNotification[];
  notificationsUnread: number;
  emailNotifications: { configured: boolean; status: string };
  capabilities: PlatformCapabilities;
  updatedAt: string;
};

export type ApiKeyRow = {
  id: string;
  name: string;
  environment: "TEST" | "LIVE";
  active: boolean;
  createdAt: string;
};

export type HealthStatus = {
  success: boolean;
  application: string;
  database: string;
  database_schema: string;
  supabase_auth_configured: boolean;
  email_configured: boolean;
  email_provider: string | null;
  email_status: string;
  environment: string;
};
