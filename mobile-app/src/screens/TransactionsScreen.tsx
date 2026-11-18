import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { fetchTransactionsPage } from "../lib/api";
import { shareTransactionsCsv } from "../lib/export";
import { formatCurrency, formatDate, resolveProviderDisplayName, STATUS_LABELS } from "../lib/format";
import { Banner, EmptyState, Panel, StatusBadge } from "../components/Ui";
import type { MerchantTransactionItem, PaymentStatus, ProviderDescriptor } from "../types";

const FILTER_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "ALL", label: "Todos" },
  { key: "COMPLETED", label: STATUS_LABELS.COMPLETED },
  { key: "PENDING", label: STATUS_LABELS.PENDING },
  { key: "OPEN", label: STATUS_LABELS.OPEN },
  { key: "PROCESSING", label: STATUS_LABELS.PROCESSING },
  { key: "FAILED", label: STATUS_LABELS.FAILED },
  { key: "CANCELLED", label: STATUS_LABELS.CANCELLED },
  { key: "EXPIRED", label: STATUS_LABELS.EXPIRED },
];

export function TransactionsScreen({
  selectedMerchantId,
  providers,
  refreshSignal,
  onSelectTransaction,
}: {
  selectedMerchantId: string | null;
  providers: ProviderDescriptor[];
  refreshSignal: number;
  onSelectTransaction: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [rows, setRows] = useState<MerchantTransactionItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => clearTimeout(timer);
  }, [query]);

  const loadPage = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");

      try {
        const res = await fetchTransactionsPage({
          merchantId: selectedMerchantId,
          status,
          q: debouncedQuery,
          page: targetPage,
          limit: 25,
        });
        setRows((prev) => (append ? [...prev, ...res.data] : res.data));
        setPage(res.pagination.page);
        setTotal(res.pagination.total);
        setHasMore(res.pagination.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao listar transacções.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedMerchantId, status, debouncedQuery]
  );

  useEffect(() => {
    void loadPage(1, false);
  }, [loadPage, refreshSignal]);

  return (
    <>
      <Panel>
        <View style={styles.head}>
          <View>
            <Text style={styles.title}>Histórico de transacções</Text>
            <Text style={styles.sub}>{total.toLocaleString("pt-MZ")} registos encontrados</Text>
          </View>
          <Pressable
            onPress={() => void shareTransactionsCsv(rows, providers)}
            style={styles.exportBtn}
          >
            <Ionicons name="download-outline" size={15} color="#ffffff" />
            <Text style={styles.exportText}>CSV</Text>
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Pesquisar referência, provedor ou cliente"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {FILTER_OPTIONS.map((opt) => {
            const active = status === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setStatus(opt.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Panel>

      {error ? <Banner tone="error" message={error} /> : null}

      <Panel>
        {loading ? (
          <ActivityIndicator style={{ paddingVertical: 26 }} color={colors.brand} />
        ) : rows.length ? (
          <>
            {rows.map((tx, idx) => (
              <Pressable
                key={tx.id}
                onPress={() => onSelectTransaction(tx.id)}
                style={[styles.txRow, idx === 0 && { borderTopWidth: 0 }]}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.txName} numberOfLines={1}>
                    {tx.customerName || tx.reference}
                  </Text>
                  <Text style={styles.txRef} numberOfLines={1}>
                    {tx.reference} · {resolveProviderDisplayName(tx.provider, providers)}
                  </Text>
                  <Text style={styles.txDate}>
                    {formatDate(tx.createdAt, true)} · {tx.merchantName}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.txAmount}>{formatCurrency(tx.amount, tx.currency)}</Text>
                  <StatusBadge status={tx.status as PaymentStatus} />
                </View>
              </Pressable>
            ))}

            {hasMore ? (
              <Pressable
                style={styles.loadMoreBtn}
                disabled={loadingMore}
                onPress={() => void loadPage(page + 1, true)}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <Text style={styles.loadMoreText}>Carregar mais transacções</Text>
                )}
              </Pressable>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon="swap-horizontal-outline"
            title="Nenhuma transacção encontrada"
            detail={
              debouncedQuery || status !== "ALL"
                ? "Ajuste a pesquisa ou o filtro de estado."
                : "As transacções aparecerão aqui quando forem registadas."
            }
          />
        )}
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 15.5, fontWeight: "800", color: colors.text },
  sub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  exportText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
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
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13.5 },
  chipsRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  chipTextActive: { color: colors.brand, fontWeight: "700" },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  txName: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  txRef: { fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  txDate: { fontSize: 10.5, color: colors.textMuted, marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: "800", color: colors.text },
  loadMoreBtn: {
    marginTop: 12,
    backgroundColor: colors.brandSoft,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
  },
  loadMoreText: { color: colors.brand, fontSize: 13, fontWeight: "700" },
});
