import ResetForm from "./reset-form";
import { getSupabaseConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function ResetPage() {
  return <ResetForm configured={Boolean(getSupabaseConfig())} />;
}
