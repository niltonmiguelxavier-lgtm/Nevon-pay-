import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { fetchTransactionDetail } from "../lib/api";
import { formatCurrency, formatDate, resolveProviderDisplayName, STATUS_LABELS } from "../lib/format";
import { Banner, Panel, StatusBadge } from "./Ui";
import type { PaymentStatus, ProviderDescriptor, TransactionDetail } from "../types";

export function TransactionDetailModal({
  transactionId,
  providers,
  onClose,
}: {
  transactionId: string | null;
  providers: ProviderDescriptor[];
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!transactionId) {
      setDetail(null);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void fetchTransactionDetail(transactionId)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar o detalhe.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  async function copyReference() {
    if (!detail?.reference) return;
    await Clipboard.setStringAsync(detail.reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Modal
      visible={Boolean(transactionId)}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Detalhe da transacção</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fechar detalhe">
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />
          ) : error ? (
            <Banner tone="error" message={error} />
          ) : detail ? (
            <>
              <View style={styles.amountCard}>
                <StatusBadge status={detail.status} />
                <Text style={styles.amountValue}>{formatCurrency(detail.amount, detail.currency)}</Text>
                <Pressable onPress={() => void copyReference()} style={styles.refRow}>
                  <Text style={styles.refText}>{detail.reference}</Text>
                  <Ionicons
                    name={copied ? "checkmark-outline" : "copy-outline"}
                    size={15}
                    color={colors.brand}
                  />
                </Pressable>
                {copied ? <Text style={styles.copiedText}>Referência copiada</Text> : null}
              </View>

              <Panel>
                <Text style={styles.sectionTitle}>Pagamento</Text>
                <DetailRow label="Espaço de trabalho" value={detail.merchant.name} />
                <DetailRow
                  label="Método / Provedor"
                  value={resolveProviderDisplayName(detail.provider, providers)}
                />
                {detail.providerRef ? (
                  <DetailRow label="Ref. do provedor" value={detail.providerRef} />
                ) : null}
                <DetailRow
                  label="Estado"
                  value={STATUS_LABELS[detail.status] || detail.status}
                />
                <DetailRow label="Criado em" value={formatDate(detail.createdAt, true)} />
                <DetailRow label="Actualizado em" value={formatDate(detail.updatedAt, true)} />
              </Panel>

              <Panel>
                <Text style={styles.sectionTitle}>Cliente</Text>
                <DetailRow label="Nome" value={detail.customer.name || "Não identificado"} />
                <DetailRow label="Email" value={detail.customer.email || "Sem email registado"} />
                <DetailRow label="Telefone" value={detail.customer.phone || "Sem telefone registado"} />
              </Panel>

              {detail.session ? (
                <Panel>
                  <Text style={styles.sectionTitle}>Sessão de checkout</Text>
                  <DetailRow label="Identificador" value={detail.session.id} />
                  <DetailRow
                    label="Estado da sessão"
                    value={STATUS_LABELS[detail.session.status as PaymentStatus] || detail.session.status}
                  />
                  <DetailRow label="Expira em" value={formatDate(detail.session.expiresAt, true)} />
                </Panel>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  closeBtn: { padding: 4 },
  content: { padding: 16, paddingBottom: 40 },
  amountCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    alignItems: "center",
    marginBottom: 14,
  },
  amountValue: { fontSize: 28, fontWeight: "800", color: colors.text, marginTop: 10 },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.bg,
    borderRadius: 8,
  },
  refText: { fontSize: 12.5, fontWeight: "700", color: colors.textSecondary },
  copiedText: { fontSize: 11, color: colors.brand, marginTop: 4, fontWeight: "700" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLabel: { fontSize: 12.5, color: colors.textMuted },
  rowValue: { fontSize: 12.5, fontWeight: "700", color: colors.text, flexShrink: 1, textAlign: "right" },
});
