import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { formatDate } from "../lib/format";
import { Banner, EmptyState } from "./Ui";
import type { DashboardNotification } from "../types";

export function NotificationsModal({
  visible,
  notifications,
  unreadCount,
  emailStatus,
  onClose,
  onMarkOne,
  onMarkAll,
}: {
  visible: boolean;
  notifications: DashboardNotification[];
  unreadCount: number;
  emailStatus?: { configured: boolean; status: string };
  onClose: () => void;
  onMarkOne: (id: string) => void;
  onMarkAll: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Notificações</Text>
            <Text style={styles.sub}>
              {unreadCount > 0 ? `${unreadCount} por ler` : "Tudo em dia"}
            </Text>
          </View>
          <View style={styles.actions}>
            {unreadCount > 0 ? (
              <Pressable onPress={onMarkAll} style={styles.markAllBtn}>
                <Text style={styles.markAllText}>Marcar todas</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fechar notificações">
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {emailStatus ? (
            <Banner
              tone="info"
              message={
                emailStatus.configured
                  ? `Notificações por email activas (${emailStatus.status}).`
                  : `Notificações por email não configuradas: ${emailStatus.status}`
              }
            />
          ) : null}

          {notifications.length ? (
            notifications.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (!item.read) onMarkOne(item.id);
                }}
                style={[styles.card, item.read && styles.cardRead]}
              >
                <View style={styles.cardRow}>
                  <Ionicons
                    name={item.severity === "critical" ? "warning" : "notifications-outline"}
                    size={17}
                    color={item.severity === "critical" ? colors.danger : colors.brand}
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      {!item.read ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.cardDesc}>{item.description}</Text>
                    <Text style={styles.cardTime}>
                      {formatDate(item.createdAt, true)} · {item.read ? "lida" : "toque para marcar como lida"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <EmptyState
              icon="notifications-off-outline"
              title="Sem notificações"
              detail="Quando houver actividade relevante nos seus espaços de trabalho, será listada aqui."
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
  },
  markAllText: { fontSize: 12, fontWeight: "700", color: colors.brand },
  closeBtn: { padding: 4 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardRead: { opacity: 0.72 },
  cardRow: { flexDirection: "row", gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: 13.5, fontWeight: "700", color: colors.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  cardDesc: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  cardTime: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
});
