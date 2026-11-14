// Remove as contas de teste criadas pela auditoria (por prefixo de email).
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, {
  headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
});
const body = await response.json();
const targets = (body.users || []).filter((u) => (u.email || "").startsWith("nevon.audit."));
for (const user of targets) {
  const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  console.log(`${del.ok ? "removido" : "falhou"} ${user.email}`);
}
console.log(`total: ${targets.length}`);
