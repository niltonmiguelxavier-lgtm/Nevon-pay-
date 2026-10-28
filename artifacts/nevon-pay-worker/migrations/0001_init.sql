-- Nevon Pay — schema D1 (SQLite). Valores monetários em unidades menores (centavos, INTEGER).
CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','MERCHANT','ADMIN')),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS Merchant (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED')),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS MerchantUser (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  merchantId TEXT NOT NULL REFERENCES Merchant(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (userId, merchantId)
);
CREATE TABLE IF NOT EXISTS ApiKey (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL REFERENCES Merchant(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keyHash TEXT NOT NULL UNIQUE,
  keyPrefix TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'TEST' CHECK (environment IN ('TEST','LIVE')),
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ApiKey_merchant ON ApiKey(merchantId);
CREATE TABLE IF NOT EXISTS Wallet (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL REFERENCES Merchant(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0,
  held INTEGER NOT NULL DEFAULT 0,
  UNIQUE (merchantId, currency)
);
CREATE TABLE IF NOT EXISTS LedgerEntry (
  id TEXT PRIMARY KEY,
  walletId TEXT NOT NULL REFERENCES Wallet(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('DEBIT','CREDIT')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  reference TEXT NOT NULL,
  description TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_Ledger_reference ON LedgerEntry(reference);
CREATE TABLE IF NOT EXISTS Payment (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL REFERENCES Merchant(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('OPEN','PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED','EXPIRED')),
  reference TEXT NOT NULL UNIQUE,
  provider TEXT,
  providerRef TEXT,
  idempotencyKey TEXT,
  metadata TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (merchantId, idempotencyKey)
);
CREATE INDEX IF NOT EXISTS idx_Payment_merchant_status ON Payment(merchantId, status);
CREATE TABLE IF NOT EXISTS CheckoutSession (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL REFERENCES Merchant(id) ON DELETE CASCADE,
  paymentId TEXT NOT NULL UNIQUE REFERENCES Payment(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED','EXPIRED')),
  customer TEXT,
  metadata TEXT,
  successUrl TEXT,
  cancelUrl TEXT,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_Session_merchant_status ON CheckoutSession(merchantId, status);
CREATE TABLE IF NOT EXISTS WebhookEvent (
  id TEXT PRIMARY KEY,
  merchantId TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deliveredAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_Webhook_merchant_event ON WebhookEvent(merchantId, event);
CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY,
  actorId TEXT,
  merchantId TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  resourceId TEXT,
  requestId TEXT,
  metadata TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_Audit_merchant_created ON AuditLog(merchantId, createdAt);
