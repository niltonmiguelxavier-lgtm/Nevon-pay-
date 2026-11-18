import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { formatCurrency, formatDate, resolveProviderDisplayName } from "../lib/format";
import { createWorkspace } from "../lib/api";
import { Banner, EmptyState, MonthlyBars, Panel, StatusBadge } from "../components/Ui";
import type { DashboardPayload, DashboardPayment } from "../types";

export function OverviewScreen({
  dashboard,
  onOpenTransactions,
  onSelectTransaction,
  onOpenNotifications,
  onWorkspaceCreated,
}: {
  dashboard: DashboardPayload;
  onOpenTransactions: () => void;
  onSelectTransaction: (tx: DashboardPayment) => void;
  onOpenNotifications: () => void;
  onWorkspaceCreated: () => Promise<void>;
}) {
  const [workspaceName, setWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [wsError, setWsError] = useState("");

  async function handleCreateWorkspace() {
    if (workspaceName.trim().length < 2) {
      setWsError("Indique um nome com pelo menos 2 caracteres.");
      return;
    }
    setCreating(true);
    setWsError("");
    try {
      await createWorkspace(workspaceName.trim());
      setWorkspaceName("");
      await onWorkspaceCreated();
    } catch (error) {
      setWsError(error instanceof Error ? error.message : "Não foi possível criar o espaço de trabalho.");
    } finally {
      setCreating(false);
    }
  }

  if (dashboard.workspaces.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon="briefcase-outline"
          title="Crie o seu espaço de trabalho"
          detail="A sua conta ainda não tem um espaço de comerciante ligado. Crie o primeiro para acompanhar pagamentos e gerar chaves de API."
        />
        <Text style={styles.label}>Nome do espaço</Text>
        <TextInput
          style={styles.input}
          value={workspaceName}
          onChangeText={setWorkspaceName}
          placeholder="Ex.: A minha loja"
          placeholderTextColor={colors.textMuted}
          maxLength={120}
        />
        {wsError ? <Banner tone="error" message={wsError} /> : null}
        <Pressable
          style={[styles.primaryBtn, (creating || workspaceName.trim().length < 2) && styles.disabled]}
          disabled={creating || workspaceName.trim().length < 2}
          onPress={() => void handleCreateWorkspace()}
        >
          {creating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryText}>Criar espaço de trabalho</Text>
          )}
        </Pressable>
      </Panel>
    );
  }

  const providers = dashboard.capabilities?.providers ?? [];

  return (
    <>
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>Total recebido</Text>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {dashboard.capabilities.paymentProcessing.liveEnabled ? "Processamento activo" : "Apenas acompanhamento"}
            </Text>
          </View>
        </View>
        <Text style={styles.heroAmount}>{formatCurrency(dashboard.summary.receivedTotal)}</Text>
        <Text style={styles.heroSub}>
          {dashboard.summary.completedTransactions.toLocaleString("pt-MZ")} pagamentos concluídos · Saldo disponível:{" "}
          {formatCurrency(dashboard.summary.availableBalance)}
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Transacções</Text>
          <Text style={styles.metricValue}>{dashboard.summary.totalTransactions.toLocaleString("pt-MZ")}</Text>
          <Text style={styles.metricFoot}>{dashboard.summary.pendingTransactions} por acompanhar</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Montante pendente</Text>
          <Text style={styles.metricValue}>{formatCurrency(dashboard.summary.pendingAmount)}</Text>
          <Text style={styles.metricFoot}>{dashboard.summary.pendingTransactions} pendentes</Text>
        </View>
      </View>

      <Panel>
        <View style={styles.panelHead}>
          <View>
            <Text style={styles.panelTitle}>Movimento de pagamentos</Text>
            <Text style={styles.panelSub}>Valores recebidos · últimos 6 meses (MZN)</Text>
          </View>
          <Ionicons name="bar-chart-outline" size={18} color={colors.textMuted} />
        </View>
        <MonthlyBars points={dashboard.chart} />
      </Panel>

      <Panel>
        <View style={styles.panelHead}>
          <View>
            <Text style={styles.panelTitle}>A acompanhar</Text>
            <Text style={styles.panelSub}>Alertas recentes da sua conta</Text>
          </View>
          <Pressable onPress={onOpenNotifications}>
            <Text style={styles.linkText}>Abrir</Text>
          </Pressable>
        </View>
        {dashboard.notifications.length ? (
          dashboard.notifications.slice(0, 3).map((notice) => (
            <Pressable key={notice.id} onPress={onOpenNotifications} style={styles.noticeRow}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.brand} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>{notice.title}</Text>
                <Text style={styles.noticeDesc} numberOfLines={2}>
                  {notice.description}
                </Text>
                <Text style={styles.noticeTime}>{formatDate(notice.createdAt, true)}</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={styles.mutedText}>Sem notificações neste momento.</Text>
        )}
      </Panel>

      <Panel>
        <View style={styles.panelHead}>
          <View>
            <Text style={styles.panelTitle}>Transacções recentes</Text>
            <Text style={styles.panelSub}>Toque num registo para ver detalhes</Text>
          </View>
          <Pressable onPress={onOpenTransactions} style={styles.linkBtn}>
            <Text style={styles.linkText}>Ver todas</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.brand} />
          </Pressable>
        </View>

        {dashboard.transactions.length ? (
          dashboard.transactions.slice(0, 5).map((tx, idx) => (
            <Pressable
              key={tx.id}
              onPress={() => onSelectTransaction(tx)}
              style={[styles.txRow, idx === 0 && { borderTopWidth: 0 }]}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.txTitle} numberOfLines={1}>
                  {tx.customerName || tx.reference}
                </Text>
                <Text style={styles.txMeta} numberOfLines={1}>
                  {resolveProviderDisplayName(tx.provider, providers)} · {formatDate(tx.createdAt, true)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={styles.txAmount}>{formatCurrency(tx.amount, tx.currency)}</Text>
                <StatusBadge status={tx.status} />
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={styles.mutedText}>Ainda não existem transacções neste espaço.</Text>
        )}
      </Panel>

      <Panel>
        <View style={styles.panelHead}>
          <View>
            <Text style={styles.panelTitle}>Métodos registados</Text>
            <Text style={styles.panelSub}>Actividade observada nos pagamentos</Text>
          </View>
          <Ionicons name="card-outline" size={18} color={colors.textMuted} />
        </View>
        {dashboard.methods.length ? (
          dashboard.methods.map((method) => (
            <View key={`${method.provider}:${method.currency}`} style={styles.methodRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodName}>
                  {resolveProviderDisplayName(method.provider, providers)}
                </Text>
                <Text style={styles.methodMeta}>
                  {method.completedTransactions} concluídos · {method.transactions} registos
                </Text>
              </View>
              <Text style={styles.methodTotal}>{formatCurrency(method.received, method.currency)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.mutedText}>Os métodos surgem quando existirem pagamentos registados.</Text>
        )}
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  heroLabel: { color: "#d5ede1", fontSize: 12.5, fontWeight: "600" },
  heroPill: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  heroPillText: { color: "#ffffff", fontSize: 10.5, fontWeight: "700" },
  heroAmount: { color: "#ffffff", fontSize: 28, fontWeight: "800", marginTop: 8 },
  heroSub: { color: "#d5ede1", fontSize: 11.5, marginTop: 8, lineHeight: 17 },
  metricsGrid: { flexDirection: "row", gap: 10, marginBottom: 14 },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  metricLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: "600" },
  metricValue: { fontSize: 19, fontWeight: "800", color: colors.text, marginTop: 6 },
  metricFoot: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  panelHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  panelTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  panelSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { fontSize: 12.5, fontWeight: "700", color: colors.brand },
  noticeRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  noticeTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  noticeDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  noticeTime: { fontSize: 10.5, color: colors.textMuted, marginTop: 4 },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  txTitle: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  txMeta: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  txAmount: { fontSize: 13, fontWeight: "800", color: colors.text },
  methodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  methodName: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  methodMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  methodTotal: { fontSize: 13, fontWeight: "800", color: colors.text },
  mutedText: { fontSize: 12.5, color: colors.textMuted, paddingVertical: 6 },
  label: { fontSize: 12.5, fontWeight: "700", color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 11,
    height: 46,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 14,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    height: 46,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
