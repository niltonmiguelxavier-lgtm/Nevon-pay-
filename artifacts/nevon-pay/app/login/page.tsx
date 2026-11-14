import { redirect } from "next/navigation";
import LoginForm from "./login-form";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env";
import { authQueryMessages } from "@/lib/auth/errors";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  // Sessão persistente: quem já está autenticado não volta a ver o formulário.
  if (getSupabaseConfig()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/dashboard");
  }

  const errorKey = readParam(params, "error");
  const messageKey = readParam(params, "message");
  const errorEntry = errorKey ? authQueryMessages[errorKey] : undefined;
  const successEntry = messageKey ? authQueryMessages[messageKey] : undefined;

  return (
    <LoginForm
      configured={Boolean(getSupabaseConfig())}
      initialEmail={readParam(params, "email") ?? ""}
      initialError={errorEntry?.type === "error" ? errorEntry.text : errorKey ? "Não foi possível concluir o pedido." : ""}
      initialMessage={successEntry?.type === "success" ? successEntry.text : ""}
    />
  );
}
