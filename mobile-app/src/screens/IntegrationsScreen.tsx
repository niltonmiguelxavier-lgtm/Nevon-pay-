import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { createApiKey, fetchApiKeys, revokeApiKey } from "../lib/api";
import { formatDate } from "../lib/format";
import { Banner, EmptyState, Panel } from "../components/Ui";
import type { ApiKeyRow, DashboardPayload } from "../types";

export function IntegrationsScreen({
  dashboard,
  activeMerchantId,
}: {
  dashboard: DashboardPayload;
  activeMerchantId: string | null;
}) {
  const [targetMerchantId, setTargetMerchantId] = useState<string | null>(
    activeMerchantId ?? dashboard.workspaces[0]?.id ?? null
  );
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (activeMerchantId) {
      setTargetMerchantId(activeMerchantId);
    } else if (!targetMerchantId && dashboard.workspaces[0]?.id) {
      setTargetMerchantId(dashboard.workspaces[0].id);
    }
  }, [activeMerchantId, dashboard.workspaces, targetMerchantId]);

  const loadKeys = useCallback(async (merchantId: string) => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchApiKeys(merchantId);
      setKeys(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as chaves de API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (targetMerchantId) void loadKeys(targetMerchantId);
    else setKeys([]);
  }, [targetMerchantId, loadKeys]);

  async function handleCreateKey() {
    if (!targetMerchantId) return;
    setBusy(true);
    setError("");
    setNotice("");
    setCreatedSecret(null);
    setCopiedSecret(false);

    try {
      const created = await createApiKey({
        merchantId: targetMerchantId,
        name: keyName.trim() || "Chave de teste",
        environment: "TEST",
      });
      setCreatedSecret(created.key);
      setKeyName("");
      setNotice("Chave criada. Copie e guarde agora: não volta a ser apresentada.");
      await loadKeys(targetMerchantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a chave.");
    } finally {
      setBusy(false);
    }
  }

  function confirmRevoke(row: ApiKeyRow) {
    Alert.alert(
      "Revogar chave de API",
      `Tem a certeza de que pretende revogar "${row.name}"? As integrações que usam esta chave deixarão de funcionar.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Revogar",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (!targetMerchantId) return;
              setBusy(true);
              setError("");
              try {
                await revokeApiKey(row.id);
                await loadKeys(targetMerchantId);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Não foi possível revogar a chave.");
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]
    );
  }

  async function copySecret() {
    if (!createdSecret) return;
    await Clipboard.setStringAsync(createdSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  const providers = dashboard.capabilities?.providers ?? [];

  return (
    <>
      <Banner
        tone={dashboard.capabilities.paymentProcessing.liveEnabled ? "success" : "warning"}
        title={
          dashboard.capabilities.paymentProcessing.liveEnabled
            ? "Processamento de pagamentos activo"
            : "Acompanhamento não é processamento"
        }
        message={dashboard.capabilities.paymentProcessing.notice}
      />

      <Panel>
        <Text style={styles.title}>Provedores integrados no servidor</Text>
        <Text style={styles.sub}>
          Actualizado dinamicamente a partir do backend (sem lista fixa na app)
        </Text>
        {providers.map((p, idx) => (
          <View key={p.id} style={[styles.providerRow, idx === 0 && { borderTopWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.providerName}>{p.displayName}</Text>
              <Text style={styles.providerMeta}>
                Moedas: {p.currencies.join(", ")} · Ambientes: {p.environments.join(", ")}
              </Text>
              <Text style={styles.providerMeta}>{p.statusMessage}</Text>
            </View>
            <View style={[styles.pill, p.liveReady ? styles.pillOk : styles.pillWait]}>
              <Text style={[styles.pillText, p.liveReady ? styles.pillOkText : styles.pillWaitText]}>
                {p.liveReady ? "Activo" : "Teste"}
              </Text>
            </View>
          </View>
        ))}
      </Panel>

      <Panel>
        <Text style={styles.title}>Chaves de API</Text>
        <Text style={styles.sub}>
          Autenticam pedidos a /api/v1. Só o hash fica guardado; o segredo é exibido uma única vez.
        </Text>

        {dashboard.workspaces.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wsChips}>
            {dashboard.workspaces.map((ws) => {
              const selected = ws.id === targetMerchantId;
              return (
                <Pressable
                  key={ws.id}
                  onPress={() => setTargetMerchantId(ws.id)}
                  style={[styles.wsChip, selected && styles.wsChipActive]}
                >
                  <Text style={[styles.wsChipText, selected && styles.wsChipTextActive]}>
                    {ws.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {!targetMerchantId ? (
          <EmptyState
            icon="key-outline"
            title="Sem espaço de trabalho"
            detail="Crie primeiro um espaço de trabalho para poder gerar chaves de API."
          />
        ) : (
          <>
            {error ? <Banner tone="error" message={error} /> : null}
            {notice ? <Banner tone="success" message={notice} /> : null}

            {createdSecret ? (
              <Pressable onPress={() => void copySecret()} style={styles.secretBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.secretLabel}>Chave gerada (toque para copiar)</Text>
                  <Text style={styles.secretCode} selectable>
                    {createdSecret}
                  </Text>
                </View>
                <Ionicons
                  name={copiedSecret ? "checkmark-circle" : "copy-outline"}
                  size={20}
                  color={colors.brand}
                />
              </Pressable>
            ) : null}

            <Text style={styles.label}>Nome da chave</Text>
            <TextInput
              style={styles.input}
              value={keyName}
              onChangeText={setKeyName}
              placeholder="Ex.: Integração loja móvel"
              placeholderTextColor={colors.textMuted}
              maxLength={60}
            />
            <Pressable
              style={[styles.primaryBtn, busy && styles.disabled]}
              onPress={() => void handleCreateKey()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryText}>Gerar chave de teste</Text>
              )}
            </Pressable>

            <View style={{ marginTop: 18 }}>
              {loading ? (
                <ActivityIndicator color={colors.brand} />
              ) : keys.length ? (
                keys.map((row, idx) => (
                  <View key={row.id} style={[styles.keyRow, idx === 0 && { borderTopWidth: 0 }]}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.keyName}>{row.name}</Text>
                      <Text style={styles.keyMeta}>
                        {row.environment} · Criada em {formatDate(row.createdAt)} ·{" "}
                        {row.active ? "Activa" : "Revogada"}
                      </Text>
                    </View>
                    {row.active ? (
                      <Pressable onPress={() => confirmRevoke(row)} style={styles.revokeBtn}>
                        <Text style={styles.revokeText}>Revogar</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.revokedLabel}>Revogada</Text>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.mutedText}>Ainda não existem chaves de API para este espaço.</Text>
              )}
            </View>
          </>
        )}
      </Panel>

      <Banner
        tone="info"
        message="Não introduza credenciais de provedores (M-Pesa/e-Mola) na aplicação. A ligação de provedores reais exige configuração técnica no servidor."
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15.5, fontWeight: "800", color: colors.text },
  sub: { fontSize: 11.5, color: colors.textMuted, marginTop: 3, marginBottom: 10, lineHeight: 16 },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  providerName: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  providerMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillOk: { backgroundColor: colors.successBg },
  pillWait: { backgroundColor: colors.warningBg },
  pillText: { fontSize: 11, fontWeight: "700" },
  pillOkText: { color: colors.success },
  pillWaitText: { color: colors.warning },
  wsChips: { gap: 8, marginBottom: 12 },
  wsChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wsChipActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  wsChipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  wsChipTextActive: { color: colors.brand, fontWeight: "800" },
  secretBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: `${colors.brand}33`,
    borderRadius: 11,
    padding: 12,
    marginBottom: 12,
  },
  secretLabel: { fontSize: 11, fontWeight: "700", color: colors.brand },
  secretCode: { fontSize: 12, fontWeight: "700", color: colors.text, marginTop: 4 },
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
    marginBottom: 10,
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
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  keyName: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  keyMeta: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  revokeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.dangerBg,
  },
  revokeText: { fontSize: 12, fontWeight: "700", color: colors.danger },
  revokedLabel: { fontSize: 11.5, fontWeight: "600", color: colors.textMuted },
  mutedText: { fontSize: 12.5, color: colors.textMuted },
});
