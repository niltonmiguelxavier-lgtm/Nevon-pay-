import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { formatCurrency, formatDate, getInitials, resolveProviderDisplayName } from "../lib/format";
import { shareTransactionsCsv } from "../lib/export";
import { Banner, EmptyState, MonthlyBars, Panel } from "../components/Ui";
import type { DashboardPayload } from "../types";

type SubTab = "customers" | "methods" | "reports";

export function OperationsScreen({ dashboard }: { dashboard: DashboardPayload }) {
  const [subTab, setSubTab] = useState<SubTab>("customers");
  const [customerQuery, setCustomerQuery] = useState("");

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return dashboard.customers;
    return dashboard.customers.filter((c) =>
      `${c.name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q)
    );
  }, [dashboard.customers, customerQuery]);

  const providers = dashboard.capabilities?.providers ?? [];

  return (
    <>
      <View style={styles.segmentWrap}>
        {(
          [
            { key: "customers", label: "Clientes" },
            { key: "methods", label: "Métodos" },
            { key: "reports", label: "Relatórios" },
          ] as Array<{ key: SubTab; label: string }>
        ).map((tab) => {
          const active = subTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setSubTab(tab.key)}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {subTab === "customers" ? (
        <Panel>
          <View style={styles.panelHead}>
            <View>
              <Text style={styles.title}>Clientes identificados</Text>
              <Text style={styles.sub}>Contactos extraídos das sessões de pagamento recentes</Text>
            </View>
            <Text style={styles.countPill}>{dashboard.customers.length}</Text>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={customerQuery}
              onChangeText={setCustomerQuery}
              placeholder="Pesquisar nome, email ou telefone"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {filteredCustomers.length ? (
            filteredCustomers.map((customer, idx) => (
              <View key={customer.id} style={[styles.customerRow, idx === 0 && { borderTopWidth: 0 }]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(customer.name || customer.email)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{customer.name || "Cliente sem nome"}</Text>
                  <Text style={styles.customerMeta}>{customer.email || "Sem email registado"}</Text>
                  <Text style={styles.customerMeta}>{customer.phone || "Sem telefone registado"}</Text>
                  <Text style={styles.customerFoot}>
                    {customer.transactionCount} transacções · Último: {formatDate(customer.lastPaymentAt)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              icon="people-outline"
              title="Sem clientes para apresentar"
              detail={
                dashboard.customers.length
                  ? "Nenhum cliente corresponde à pesquisa."
                  : "Os clientes surgem quando existirem sessões de pagamento com dados de contacto."
              }
            />
          )}
        </Panel>
      ) : null}

      {subTab === "methods" ? (
        <>
          <Banner
            tone={dashboard.capabilities.paymentProcessing.liveEnabled ? "success" : "info"}
            title={
              dashboard.capabilities.paymentProcessing.liveEnabled
                ? "Processamento activo"
                : "Estado do processamento"
            }
            message={dashboard.capabilities.paymentProcessing.notice}
          />

          <Panel>
            <View style={styles.panelHead}>
              <View>
                <Text style={styles.title}>Provedores no servidor</Text>
                <Text style={styles.sub}>
                  Lista dinâmica obtida da API (contrato {dashboard.capabilities.contractVersion})
                </Text>
              </View>
            </View>
            {providers.length ? (
              providers.map((provider, idx) => (
                <View key={provider.id} style={[styles.providerRow, idx === 0 && { borderTopWidth: 0 }]}>
                  <View style={styles.providerTop}>
                    <Text style={styles.providerName}>{provider.displayName}</Text>
                    <View
                      style={[
                        styles.stateChip,
                        provider.liveReady ? styles.stateActive : styles.stateTest,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stateChipText,
                          provider.liveReady ? styles.stateActiveText : styles.stateTestText,
                        ]}
                      >
                        {provider.liveReady
                          ? "Produção"
                          : provider.status === "test_only"
                          ? "Apenas teste"
                          : "Não configurado"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.providerMeta}>
                    Moedas: {provider.currencies.join(", ")} · Ambientes: {provider.environments.join(", ")}
                  </Text>
                  <Text style={styles.providerDesc}>{provider.statusMessage}</Text>
                </View>
              ))
            ) : (
              <EmptyState
                icon="card-outline"
                title="Sem provedores registados"
                detail="Quando forem configurados provedores no servidor, eles aparecerão aqui automaticamente."
              />
            )}
          </Panel>

          <Panel>
            <View style={styles.panelHead}>
              <View>
                <Text style={styles.title}>Métodos observados</Text>
                <Text style={styles.sub}>Totais agregados dos pagamentos registados</Text>
              </View>
            </View>
            {dashboard.methods.length ? (
              dashboard.methods.map((method, idx) => (
                <View
                  key={`${method.provider}:${method.currency}`}
                  style={[styles.methodRow, idx === 0 && { borderTopWidth: 0 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodName}>
                      {resolveProviderDisplayName(method.provider, providers)}
                    </Text>
                    <Text style={styles.methodMeta}>
                      {method.currency} · {method.transactions} registos · {method.completedTransactions} concluídos
                    </Text>
                  </View>
                  <Text style={styles.methodTotal}>{formatCurrency(method.received, method.currency)}</Text>
                </View>
              ))
            ) : (
              <EmptyState
                icon="wallet-outline"
                title="Ainda sem métodos registados"
                detail="M-Pesa, e-Mola ou outros métodos aparecerão aqui quando houver pagamentos com esse provedor."
              />
            )}
          </Panel>
        </>
      ) : null}

      {subTab === "reports" ? (
        <>
          <Panel>
            <View style={styles.panelHead}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.title}>Relatório de recebimentos</Text>
                <Text style={styles.sub}>Resumo mensal de pagamentos concluídos em MZN</Text>
              </View>
              <Pressable
                onPress={() => void shareTransactionsCsv(dashboard.transactions, providers)}
                style={styles.exportBtn}
              >
                <Ionicons name="download-outline" size={14} color="#ffffff" />
                <Text style={styles.exportText}>Exportar</Text>
              </Pressable>
            </View>
            <MonthlyBars points={dashboard.chart} />
          </Panel>

          <View style={styles.reportGrid}>
            <ReportCard
              label="Total recebido"
              value={formatCurrency(dashboard.summary.receivedTotal)}
            />
            <ReportCard
              label="Concluídas"
              value={dashboard.summary.completedTransactions.toLocaleString("pt-MZ")}
            />
            <ReportCard
              label="Pendentes"
              value={dashboard.summary.pendingTransactions.toLocaleString("pt-MZ")}
            />
            <ReportCard
              label="Total transacções"
              value={dashboard.summary.totalTransactions.toLocaleString("pt-MZ")}
            />
          </View>
        </>
      ) : null}
    </>
  );
}

function ReportCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reportCard}>
      <Text style={styles.reportLabel}>{label}</Text>
      <Text style={styles.reportValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
  },
  segmentBtnActive: { backgroundColor: colors.brandSoft },
  segmentText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  segmentTextActive: { color: colors.brand, fontWeight: "800" },
  panelHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 15.5, fontWeight: "800", color: colors.text },
  sub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  countPill: {
    backgroundColor: colors.brandSoft,
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13.5 },
  customerRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13.5, fontWeight: "800", color: colors.brand },
  customerName: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  customerMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  customerFoot: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  providerRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  providerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  providerName: { fontSize: 14, fontWeight: "700", color: colors.text },
  stateChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  stateActive: { backgroundColor: colors.successBg },
  stateTest: { backgroundColor: colors.warningBg },
  stateChipText: { fontSize: 11, fontWeight: "700" },
  stateActiveText: { color: colors.success },
  stateTestText: { color: colors.warning },
  providerMeta: { fontSize: 11.5, color: colors.textSecondary, marginTop: 4 },
  providerDesc: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  methodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  methodName: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  methodMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  methodTotal: { fontSize: 13.5, fontWeight: "800", color: colors.text },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.brand,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
  },
  exportText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  reportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  reportCard: {
    width: "48.4%",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  reportLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: "600" },
  reportValue: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 6 },
});
