import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { colors } from "./src/theme";
import { supabase } from "./src/lib/supabase";
import {
  fetchDashboard,
  markAllNotificationsRead,
  markNotificationRead,
} from "./src/lib/api";
import { formatDate } from "./src/lib/format";
import { AuthScreen } from "./src/screens/AuthScreen";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { TransactionsScreen } from "./src/screens/TransactionsScreen";
import { OperationsScreen } from "./src/screens/OperationsScreen";
import { IntegrationsScreen } from "./src/screens/IntegrationsScreen";
import { AccountScreen } from "./src/screens/AccountScreen";
import { Banner, EmptyState } from "./src/components/Ui";
import { NotificationsModal } from "./src/components/NotificationsModal";
import { TransactionDetailModal } from "./src/components/TransactionDetailModal";
import type { DashboardPayload } from "./src/types";

type TabKey = "overview" | "transactions" | "operations" | "integrations" | "account";

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "overview", label: "Início", icon: "home-outline", activeIcon: "home" },
  { key: "transactions", label: "Transacções", icon: "swap-horizontal-outline", activeIcon: "swap-horizontal" },
  { key: "operations", label: "Negócio", icon: "bar-chart-outline", activeIcon: "bar-chart" },
  { key: "integrations", label: "API", icon: "code-slash-outline", activeIcon: "code-slash" },
  { key: "account", label: "Conta", icon: "person-outline", activeIcon: "person" },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [tab, setTab] = useState<TabKey>("overview");
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);

  const [noticesOpen, setNoticesOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setDashboard(null);
        setSelectedMerchantId(null);
        setTab("overview");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = useCallback(
    async (manual = false) => {
      if (!session?.access_token) return;
      if (manual) setRefreshing(true);
      else if (!dashboard) setLoading(true);

      try {
        const data = await fetchDashboard(selectedMerchantId);
        setDashboard(data);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar os dados.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session?.access_token, selectedMerchantId, dashboard]
  );

  useEffect(() => {
    if (!session?.access_token) return;
    void loadData(false);
    const timer = setInterval(() => {
      void loadData(false);
    }, 30_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, selectedMerchantId]);

  async function handleManualRefresh() {
    setRefreshSignal((s) => s + 1);
    await loadData(true);
  }

  async function handleMarkAllRead() {
    setDashboard((curr) =>
      curr
        ? {
            ...curr,
            notificationsUnread: 0,
            notifications: curr.notifications.map((n) => ({ ...n, read: true })),
          }
        : curr
    );
    try {
      await markAllNotificationsRead();
    } catch {
      // Será sincronizado no próximo ciclo
    }
  }

  async function handleMarkOneRead(id: string) {
    setDashboard((curr) =>
      curr
        ? {
            ...curr,
            notificationsUnread: Math.max(0, curr.notificationsUnread - 1),
            notifications: curr.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
          }
        : curr
    );
    try {
      await markNotificationRead(id);
    } catch {
      // Será sincronizado no próximo ciclo
    }
  }

  if (!authReady) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  const headerWorkspaceText = selectedMerchantId
    ? dashboard?.workspaces.find((w) => w.id === selectedMerchantId)?.name || "Espaço"
    : dashboard?.workspaces.length === 1
    ? dashboard.workspaces[0].name
    : dashboard?.workspaces.length
    ? `${dashboard.workspaces.length} espaços ligados`
    : "Conta de comerciante";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.headerBrand}>Nevon Pay</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {headerWorkspaceText} · {dashboard?.user.name || session.user.email}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => void handleManualRefresh()}
            style={styles.iconBtn}
            accessibilityLabel="Actualizar"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <Ionicons name="refresh-outline" size={20} color={colors.text} />
            )}
          </Pressable>
          <Pressable
            onPress={() => setNoticesOpen(true)}
            style={styles.iconBtn}
            accessibilityLabel="Notificações"
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {dashboard && dashboard.notificationsUnread > 0 ? (
              <View style={styles.badgeDot}>
                <Text style={styles.badgeDotText}>
                  {dashboard.notificationsUnread > 9 ? "9+" : dashboard.notificationsUnread}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {dashboard && dashboard.workspaces.length > 1 ? (
        <View style={styles.wsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wsBarInner}>
            <Pressable
              onPress={() => setSelectedMerchantId(null)}
              style={[styles.wsPill, !selectedMerchantId && styles.wsPillActive]}
            >
              <Text style={[styles.wsPillText, !selectedMerchantId && styles.wsPillTextActive]}>
                Todos os espaços
              </Text>
            </Pressable>
            {dashboard.workspaces.map((ws) => {
              const active = selectedMerchantId === ws.id;
              return (
                <Pressable
                  key={ws.id}
                  onPress={() => setSelectedMerchantId(ws.id)}
                  style={[styles.wsPill, active && styles.wsPillActive]}
                >
                  <Text style={[styles.wsPillText, active && styles.wsPillTextActive]}>
                    {ws.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleManualRefresh()}
            tintColor={colors.brand}
          />
        }
      >
        {error ? (
          <Banner
            tone="error"
            title="Falha de sincronização"
            message={`${error}${dashboard ? " Os dados abaixo pertencem à última consulta bem-sucedida." : ""}`}
          />
        ) : null}

        {loading && !dashboard ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.loadingText}>A carregar dados da sua conta...</Text>
          </View>
        ) : !dashboard ? (
          <View style={styles.errorWrap}>
            <EmptyState
              icon="cloud-offline-outline"
              title="Não foi possível carregar o painel"
              detail={error || "Verifique a ligação e tente novamente."}
            />
            <Pressable style={styles.retryBtn} onPress={() => void handleManualRefresh()}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {tab === "overview" ? (
              <OverviewScreen
                dashboard={dashboard}
                onOpenTransactions={() => setTab("transactions")}
                onSelectTransaction={(tx) => setSelectedTxId(tx.id)}
                onOpenNotifications={() => setNoticesOpen(true)}
                onWorkspaceCreated={() => loadData(true)}
              />
            ) : null}

            {tab === "transactions" ? (
              <TransactionsScreen
                selectedMerchantId={selectedMerchantId}
                providers={dashboard.capabilities.providers}
                refreshSignal={refreshSignal}
                onSelectTransaction={(id) => setSelectedTxId(id)}
              />
            ) : null}

            {tab === "operations" ? <OperationsScreen dashboard={dashboard} /> : null}

            {tab === "integrations" ? (
              <IntegrationsScreen dashboard={dashboard} activeMerchantId={selectedMerchantId} />
            ) : null}

            {tab === "account" ? (
              <AccountScreen dashboard={dashboard} onDataUpdated={() => loadData(true)} />
            ) : null}

            <Text style={styles.updatedFoot}>
              Actualizado em {formatDate(dashboard.updatedAt, true)}
            </Text>
          </>
        )}
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.tabBarSafe}>
        <View style={styles.tabBar}>
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={styles.tabBtn}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={active ? item.activeIcon : item.icon}
                  size={20}
                  color={active ? colors.brand : colors.textMuted}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      <NotificationsModal
        visible={noticesOpen}
        notifications={dashboard?.notifications ?? []}
        unreadCount={dashboard?.notificationsUnread ?? 0}
        emailStatus={dashboard?.emailNotifications}
        onClose={() => setNoticesOpen(false)}
        onMarkOne={(id) => void handleMarkOneRead(id)}
        onMarkAll={() => void handleMarkAllRead()}
      />

      <TransactionDetailModal
        transactionId={selectedTxId}
        providers={dashboard?.capabilities.providers ?? []}
        onClose={() => setSelectedTxId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBrand: { fontSize: 18, fontWeight: "800", color: colors.text },
  headerSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeDotText: { color: "#ffffff", fontSize: 9.5, fontWeight: "800" },
  wsBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  wsBarInner: { paddingHorizontal: 16, gap: 8 },
  wsPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wsPillActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  wsPillText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  wsPillTextActive: { color: colors.brand, fontWeight: "800" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 26 },
  loadingWrap: { paddingVertical: 60, alignItems: "center", gap: 12 },
  loadingText: { fontSize: 13, color: colors.textMuted },
  errorWrap: { paddingVertical: 16, alignItems: "center" },
  retryBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: { color: "#ffffff", fontSize: 13.5, fontWeight: "700" },
  updatedFoot: {
    textAlign: "center",
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 8,
  },
  tabBarSafe: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabBar: {
    flexDirection: "row",
    height: 58,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
  },
  tabLabel: { fontSize: 10.5, fontWeight: "600", color: colors.textMuted },
  tabLabelActive: { color: colors.brand, fontWeight: "800" },
});
