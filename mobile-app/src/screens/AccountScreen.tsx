import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { changePassword, createWorkspace, fetchHealth, updateProfile } from "../lib/api";
import { supabase } from "../lib/supabase";
import { workspaceStatusLabel } from "../lib/format";
import { Banner, Panel } from "../components/Ui";
import type { DashboardPayload, HealthStatus } from "../types";

export function AccountScreen({
  dashboard,
  onDataUpdated,
}: {
  dashboard: DashboardPayload;
  onDataUpdated: () => Promise<void>;
}) {
  const [profileName, setProfileName] = useState(dashboard.user.name ?? "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [wsBusy, setWsBusy] = useState(false);
  const [wsMsg, setWsMsg] = useState("");
  const [wsError, setWsError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState("");

  useEffect(() => {
    setProfileName(dashboard.user.name ?? "");
  }, [dashboard.user.name]);

  useEffect(() => {
    void fetchHealth()
      .then((h) => {
        setHealth(h);
        setHealthError("");
      })
      .catch((err) => {
        setHealthError(err instanceof Error ? err.message : "Indisponível");
      });
  }, []);

  async function handleSaveProfile() {
    if (!profileName.trim()) {
      setProfileError("Indique o seu nome.");
      return;
    }
    setProfileBusy(true);
    setProfileMsg("");
    setProfileError("");
    try {
      await updateProfile(profileName.trim());
      setProfileMsg("Nome actualizado com sucesso.");
      await onDataUpdated();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Não foi possível actualizar o perfil.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleCreateWorkspace() {
    if (newWorkspaceName.trim().length < 2) {
      setWsError("O nome precisa de ter pelo menos 2 caracteres.");
      return;
    }
    setWsBusy(true);
    setWsMsg("");
    setWsError("");
    try {
      await createWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName("");
      setWsMsg("Espaço de trabalho criado.");
      await onDataUpdated();
    } catch (err) {
      setWsError(err instanceof Error ? err.message : "Erro ao criar o espaço de trabalho.");
    } finally {
      setWsBusy(false);
    }
  }

  async function handleChangePassword() {
    setPwError("");
    setPwMsg("");
    if (!currentPassword) {
      setPwError("Indique a palavra-passe actual.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("A nova palavra-passe precisa de ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("A confirmação não coincide com a nova palavra-passe.");
      return;
    }
    setPwBusy(true);
    try {
      const msg = await changePassword({ currentPassword, newPassword, confirmPassword });
      // O servidor Auth revoga sessões antigas após alterar a palavra-passe; renova silenciosamente.
      if (dashboard.user.email) {
        await supabase.auth
          .signInWithPassword({ email: dashboard.user.email, password: newPassword })
          .catch(() => {});
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg(msg);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Não foi possível alterar a palavra-passe.");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <>
      <Panel>
        <Text style={styles.title}>Perfil da conta</Text>
        <Text style={styles.sub}>Actualize o nome associado à sua conta autenticada.</Text>
        {profileMsg ? <Banner tone="success" message={profileMsg} /> : null}
        {profileError ? <Banner tone="error" message={profileError} /> : null}

        <Text style={styles.label}>Nome completo</Text>
        <TextInput
          style={styles.input}
          value={profileName}
          onChangeText={setProfileName}
          placeholder="O seu nome"
          placeholderTextColor={colors.textMuted}
          maxLength={120}
        />
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, styles.readonlyInput]}
          value={dashboard.user.email}
          editable={false}
        />
        <Pressable
          style={[styles.primaryBtn, (profileBusy || !profileName.trim()) && styles.disabled]}
          disabled={profileBusy || !profileName.trim()}
          onPress={() => void handleSaveProfile()}
        >
          {profileBusy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryText}>Guardar alterações</Text>
          )}
        </Pressable>
      </Panel>

      <Panel>
        <Text style={styles.title}>Espaços de trabalho</Text>
        <Text style={styles.sub}>Contas de comerciante ligadas ao seu utilizador.</Text>
        {dashboard.workspaces.map((ws, idx) => (
          <View key={ws.id} style={[styles.wsRow, idx === 0 && { borderTopWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.wsName}>{ws.name}</Text>
              <Text style={styles.wsId}>{ws.id}</Text>
            </View>
            <View style={styles.wsBadge}>
              <Text style={styles.wsBadgeText}>{workspaceStatusLabel(ws.status)}</Text>
            </View>
          </View>
        ))}

        {wsMsg ? <Banner tone="success" message={wsMsg} /> : null}
        {wsError ? <Banner tone="error" message={wsError} /> : null}
        <Text style={[styles.label, { marginTop: 12 }]}>Novo espaço de trabalho</Text>
        <TextInput
          style={styles.input}
          value={newWorkspaceName}
          onChangeText={setNewWorkspaceName}
          placeholder="Ex.: Filial Maputo"
          placeholderTextColor={colors.textMuted}
          maxLength={120}
        />
        <Pressable
          style={[styles.secondaryBtn, (wsBusy || newWorkspaceName.trim().length < 2) && styles.disabled]}
          disabled={wsBusy || newWorkspaceName.trim().length < 2}
          onPress={() => void handleCreateWorkspace()}
        >
          {wsBusy ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Text style={styles.secondaryText}>Criar espaço de trabalho</Text>
          )}
        </Pressable>
      </Panel>

      <Panel>
        <Text style={styles.title}>Alterar palavra-passe</Text>
        <Text style={styles.sub}>Requer validação da palavra-passe actual no servidor.</Text>
        {pwMsg ? <Banner tone="success" message={pwMsg} /> : null}
        {pwError ? <Banner tone="error" message={pwError} /> : null}

        <Text style={styles.label}>Palavra-passe actual</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Nova palavra-passe</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Mínimo 8 caracteres"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Confirmar nova palavra-passe</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Repita a nova palavra-passe"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          style={[styles.primaryBtn, pwBusy && styles.disabled]}
          disabled={pwBusy}
          onPress={() => void handleChangePassword()}
        >
          {pwBusy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryText}>Alterar palavra-passe</Text>
          )}
        </Pressable>
      </Panel>

      <Panel>
        <Text style={styles.title}>Suporte e estado do sistema</Text>
        <Text style={styles.sub}>Informação técnica obtida directamente do backend.</Text>
        <InfoRow
          label="Estado da API"
          value={
            health
              ? health.success
                ? "Operacional"
                : "Degradado"
              : healthError || "A verificar..."
          }
        />
        <InfoRow
          label="Base de dados"
          value={health ? `${health.database} (${health.database_schema})` : "—"}
        />
        <InfoRow
          label="Contrato de capacidades"
          value={dashboard.capabilities.contractVersion}
        />
        <InfoRow
          label="Canal de email"
          value={dashboard.emailNotifications.configured ? "Activo" : dashboard.emailNotifications.status}
        />
        <InfoRow
          label="Notificações push"
          value={dashboard.capabilities.features.pushNotifications ? "Activo" : "Ainda não configurado"}
        />
      </Panel>

      <Pressable
        style={styles.logoutBtn}
        onPress={() => {
          void supabase.auth.signOut();
        }}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Terminar sessão</Text>
      </Pressable>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15.5, fontWeight: "800", color: colors.text },
  sub: { fontSize: 11.5, color: colors.textMuted, marginTop: 3, marginBottom: 12 },
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
  readonlyInput: { color: colors.textMuted },
  primaryBtn: {
    backgroundColor: colors.brand,
    height: 46,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: colors.brandSoft,
    height: 46,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: colors.brand, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  wsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wsName: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  wsId: { fontSize: 10.5, color: colors.textMuted, marginTop: 2 },
  wsBadge: {
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  wsBadgeText: { fontSize: 11, fontWeight: "700", color: colors.brand },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoLabel: { fontSize: 12.5, color: colors.textMuted },
  infoValue: { fontSize: 12.5, fontWeight: "700", color: colors.text, flexShrink: 1, textAlign: "right" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: `${colors.danger}25`,
    height: 48,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  logoutText: { fontSize: 14.5, fontWeight: "700", color: colors.danger },
});
