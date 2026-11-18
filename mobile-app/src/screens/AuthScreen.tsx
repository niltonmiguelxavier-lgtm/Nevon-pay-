import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { apiBaseUrl, isAppConfigured, supabase, translateAuthError } from "../lib/supabase";
import { Banner } from "../components/Ui";

type AuthMode = "login" | "signup" | "recover";

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
    setSuccessMsg("");
    setPendingEmail("");
  }

  async function handleSubmit() {
    setError("");
    setSuccessMsg("");

    if (!isAppConfigured) {
      setError("Faltam configurar EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Introduza um endereço de email válido.");
      return;
    }

    if (mode === "recover") {
      setBusy(true);
      const { error: authError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${apiBaseUrl}/auth/callback`,
      });
      setBusy(false);
      if (authError) {
        setError(translateAuthError(authError));
      } else {
        setSuccessMsg(
          `Se existir uma conta com ${cleanEmail}, enviámos um link para redefinir a palavra-passe. Abra-o no navegador e depois inicie sessão aqui.`
        );
      }
      return;
    }

    if (!password) {
      setError("Introduza a palavra-passe.");
      return;
    }

    if (mode === "signup") {
      if (name.trim().length < 2) {
        setError("Indique o seu nome completo (pelo menos 2 caracteres).");
        return;
      }
      if (password.length < 8) {
        setError("A palavra-passe tem de ter pelo menos 8 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        setError("As palavras-passe não coincidem.");
        return;
      }

      setBusy(true);
      const { data, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${apiBaseUrl}/auth/callback`,
          data: { full_name: name.trim() },
        },
      });
      setBusy(false);

      if (authError) {
        setError(translateAuthError(authError));
        return;
      }

      if (!data.session) {
        setPendingEmail(cleanEmail);
        setPassword("");
        setConfirmPassword("");
        setSuccessMsg(
          "Conta criada. Enviámos um email de confirmação — abra o link para activar a conta e depois inicie sessão."
        );
      }
      return;
    }

    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    setBusy(false);

    if (authError) {
      if (authError.code === "email_not_confirmed" || /email not confirmed/i.test(authError.message)) {
        setPendingEmail(cleanEmail);
      }
      setError(translateAuthError(authError));
    }
  }

  async function resendConfirmation() {
    if (!pendingEmail) return;
    setResending(true);
    setError("");
    setSuccessMsg("");
    const { error: authError } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${apiBaseUrl}/auth/callback` },
    });
    setResending(false);
    if (authError) {
      setError(translateAuthError(authError));
    } else {
      setSuccessMsg("Email de confirmação reenviado. Verifique a caixa de entrada e o spam.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>N</Text>
            </View>
            <View>
              <Text style={styles.brandTitle}>Nevon Pay</Text>
              <Text style={styles.brandSub}>Portal móvel do comerciante</Text>
            </View>
          </View>

          {!isAppConfigured ? (
            <Banner
              tone="warning"
              title="Configuração necessária"
              message="Defina EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no ficheiro .env antes de iniciar sessão."
            />
          ) : null}

          <View style={styles.card}>
            <Text style={styles.eyebrow}>ACESSO SEGURO</Text>
            <Text style={styles.heading}>
              {mode === "login"
                ? "Bem-vindo de volta"
                : mode === "signup"
                ? "Criar conta"
                : "Recuperar palavra-passe"}
            </Text>
            <Text style={styles.caption}>
              {mode === "login"
                ? "Entre com a sua conta de comerciante para acompanhar cobranças, chaves de API e relatórios."
                : mode === "signup"
                ? "Registe a sua conta Nevon Pay. Vai receber um email de confirmação."
                : "Indique o seu email para receber o link de redefinição da palavra-passe."}
            </Text>

            {mode === "signup" ? (
              <>
                <Text style={styles.label}>Nome completo</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="O seu nome completo"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  maxLength={120}
                />
              </>
            ) : null}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="nome@empresa.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            {mode !== "recover" ? (
              <>
                <Text style={styles.label}>Palavra-passe</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="A sua palavra-passe"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    onSubmitEditing={() => {
                      if (mode === "login") void handleSubmit();
                    }}
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              </>
            ) : null}

            {mode === "signup" ? (
              <>
                <Text style={styles.label}>Confirmar palavra-passe</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repita a palavra-passe"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                />
              </>
            ) : null}

            {error ? <Banner tone="error" message={error} /> : null}
            {successMsg ? <Banner tone="success" message={successMsg} /> : null}

            {pendingEmail ? (
              <Pressable
                style={[styles.secondaryBtn, resending && styles.disabled]}
                onPress={() => void resendConfirmation()}
                disabled={resending}
              >
                <Text style={styles.secondaryText}>
                  {resending ? "A reenviar..." : "Reenviar email de confirmação"}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.primaryBtn, busy && styles.disabled]}
              onPress={() => void handleSubmit()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryText}>
                  {mode === "login"
                    ? "Iniciar sessão"
                    : mode === "signup"
                    ? "Criar conta"
                    : "Enviar link de recuperação"}
                </Text>
              )}
            </Pressable>

            <View style={styles.links}>
              {mode === "login" ? (
                <Pressable onPress={() => switchMode("recover")}>
                  <Text style={styles.linkText}>Esqueceu-se da palavra-passe?</Text>
                </Pressable>
              ) : null}

              <Pressable onPress={() => switchMode(mode === "login" ? "signup" : "login")}>
                <Text style={styles.linkText}>
                  {mode === "login" ? "Ainda não tem conta? Criar conta" : "Voltar ao início de sessão"}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.footnote}>
            Autenticação validada no servidor via Supabase. A app guarda os tokens apenas no armazenamento seguro do dispositivo.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 22 },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#ffffff", fontSize: 22, fontWeight: "800" },
  brandTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  brandSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  eyebrow: { fontSize: 11, fontWeight: "800", color: colors.brand, letterSpacing: 0.7 },
  heading: { fontSize: 22, fontWeight: "800", color: colors.text, marginTop: 4 },
  caption: { fontSize: 13, color: colors.textMuted, marginTop: 6, marginBottom: 14, lineHeight: 19 },
  label: { fontSize: 12.5, fontWeight: "700", color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 11,
    height: 48,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 14.5,
    marginBottom: 6,
  },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 11,
    height: 48,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 14.5,
  },
  eyeBtn: { paddingHorizontal: 12, height: "100%", justifyContent: "center" },
  primaryBtn: {
    backgroundColor: colors.brand,
    height: 48,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  primaryText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: colors.brandSoft,
    height: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  secondaryText: { color: colors.brand, fontSize: 13.5, fontWeight: "700" },
  disabled: { opacity: 0.65 },
  links: { marginTop: 16, gap: 10, alignItems: "center" },
  linkText: { color: colors.brand, fontSize: 13, fontWeight: "700" },
  footnote: {
    color: colors.textMuted,
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 18,
    lineHeight: 17,
  },
});
