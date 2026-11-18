import type { PlatformCapabilities } from "./capabilities";

export type DashboardPaymentStatus =
  | "OPEN"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type DashboardPayment = {
  id: string;
  reference: string;
  status: DashboardPaymentStatus;
  amount: string;
  currency: string;
  provider: string | null;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
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
  workspaces: Array<{
    id: string;
    name: string;
    status: "PENDING" | "ACTIVE" | "SUSPENDED";
  }>;
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
