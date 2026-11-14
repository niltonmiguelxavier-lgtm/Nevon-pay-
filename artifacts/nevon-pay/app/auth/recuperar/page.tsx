import RecoverForm from "./recover-form";
import { getSupabaseConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function RecoverPage() {
  return <RecoverForm configured={Boolean(getSupabaseConfig())} />;
}
