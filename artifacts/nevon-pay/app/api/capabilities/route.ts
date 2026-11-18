import { getPlatformCapabilities } from "@/lib/capabilities";
import { corsPreflight, json, requestId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rid = requestId(req);
  const capabilities = getPlatformCapabilities();
  return json({ success: true, capabilities }, 200, rid);
}

export function OPTIONS() {
  return corsPreflight("GET, OPTIONS");
}
