import * as Clipboard from "expo-clipboard";
import { Alert, Share } from "react-native";
import { resolveProviderDisplayName } from "./format";
import type { DashboardPayment, ProviderDescriptor } from "../types";

export function buildTransactionsCsv(
  rows: DashboardPayment[],
  providers: ProviderDescriptor[] = []
): string {
  const columns = ["referencia", "estado", "valor", "moeda", "provedor", "data", "cliente", "email"];
  const lines = rows.map((tx) => [
    tx.reference,
    tx.status,
    tx.amount,
    tx.currency,
    resolveProviderDisplayName(tx.provider, providers),
    tx.createdAt,
    tx.customerName ?? "",
    tx.customerEmail ?? "",
  ]);
  return [columns, ...lines]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
}

export async function shareTransactionsCsv(
  rows: DashboardPayment[],
  providers: ProviderDescriptor[] = []
) {
  if (rows.length === 0) {
    Alert.alert("Exportação CSV", "Não há transacções para exportar com os filtros actuais.");
    return;
  }
  const csv = buildTransactionsCsv(rows, providers);
  try {
    await Share.share({
      title: "nevon-pay-transaccoes.csv",
      message: csv,
    });
  } catch {
    await Clipboard.setStringAsync(csv);
    Alert.alert("Exportação CSV", "Os dados CSV foram copiados para a área de transferência.");
  }
}
