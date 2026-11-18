import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { formatCurrency, STATUS_LABELS, statusColors } from "../lib/format";
import type { DashboardChartPoint, PaymentStatus } from "../types";

export function Panel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function StatusBadge({ status }: { status: string }) {
  const { bg, fg } = statusColors(status);
  const label = STATUS_LABELS[status as PaymentStatus] || status;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Banner({
  tone,
  title,
  message,
}: {
  tone: "error" | "success" | "info" | "warning";
  title?: string;
  message: string;
}) {
  const palette = {
    error: { bg: colors.dangerBg, fg: colors.danger, icon: "alert-circle-outline" as const },
    success: { bg: colors.successBg, fg: colors.success, icon: "checkmark-circle-outline" as const },
    info: { bg: colors.infoBg, fg: colors.info, icon: "information-circle-outline" as const },
    warning: { bg: colors.warningBg, fg: colors.warning, icon: "shield-outline" as const },
  }[tone];

  return (
    <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: `${palette.fg}24` }]}>
      <Ionicons name={palette.icon} size={18} color={palette.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[styles.bannerTitle, { color: palette.fg }]}>{title}</Text> : null}
        <Text style={[styles.bannerText, { color: palette.fg }]}>{message}</Text>
      </View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color={colors.brand} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
    </View>
  );
}

export function MonthlyBars({ points }: { points: DashboardChartPoint[] }) {
  const numericValues = points.map((item) => Number(item.received) || 0);
  const max = Math.max(...numericValues, 1);

  return (
    <View style={styles.chartWrap}>
      <View style={styles.barsRow}>
        {points.map((point) => {
          const val = Number(point.received) || 0;
          const height = val > 0 ? Math.max(10, Math.round((val / max) * 92)) : 4;
          return (
            <View key={point.month} style={styles.barCol}>
              <Text style={styles.barValue} numberOfLines={1}>
                {val > 0 ? formatCurrency(val).replace("MZN", "").trim() : "0"}
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height, opacity: val > 0 ? 1 : 0.25 }]} />
              </View>
              <Text style={styles.barLabel}>{point.label}</Text>
              <Text style={styles.barTx}>{point.transactions} tx</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  bannerText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 18,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  emptyDetail: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },
  chartWrap: {
    marginTop: 10,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
    paddingTop: 10,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
  },
  barValue: {
    fontSize: 9.5,
    color: colors.textMuted,
    marginBottom: 6,
  },
  barTrack: {
    height: 98,
    justifyContent: "flex-end",
    alignItems: "center",
    width: "100%",
  },
  barFill: {
    width: "68%",
    maxWidth: 28,
    borderRadius: 6,
    backgroundColor: colors.brand,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    marginTop: 6,
    textTransform: "capitalize",
  },
  barTx: {
    fontSize: 9.5,
    color: colors.textMuted,
    marginTop: 1,
  },
});
