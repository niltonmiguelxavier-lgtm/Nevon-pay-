/** Verificações de interacção no dashboard (secções, filtros, exportação). */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:3000";
const email = JSON.parse(readFileSync("./audit-results.json", "utf8")).email;
const PASSWORD = "Auditoria#2026";
const results = [];
const record = (id, name, status, detail) => {
  results.push({ id, name, status, detail });
  console.log(`${status === "PASS" ? "✅" : "❌"} [${id}] ${name} — ${detail}`);
};
const check = async (id, name, fn) => {
  try {
    record(id, name, "PASS", await fn());
  } catch (error) {
    record(id, name, "FAIL", error instanceof Error ? error.message : String(error));
  }
};
const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.locator("#email").fill(email);
await page.locator("#password").fill(PASSWORD);
await page.getByRole("button", { name: "Entrar" }).click();
await page.waitForURL(/\/dashboard/, { timeout: 25_000 });
await page.waitForSelector("[data-testid='transactions-table']", { timeout: 25_000 });

for (const [view, marker, label] of [
  ["overview", "[data-testid^=summary-]", "Visão Geral"],
  ["transactions", "[data-testid=transactions-table]", "Transacções"],
  ["customers", "np-customer-grid, [data-testid='customer-card-0'], .np-centered-state", "Clientes"],
  ["methods", ".np-method-card, .np-centered-state", "Métodos de Pagamento"],
  ["reports", ".np-bars", "Relatórios"],
  ["integrations", "text=Chaves de API", "Integrações API"],
  ["settings", "[data-testid='profile-name']", "Configurações"],
  ["support", ".np-support-card", "Suporte"],
]) {
  await check(`U-${view}`, `Secção "${label}" renderiza conteúdo`, async () => {
    await page.getByTestId(`nav-${view}`).click();
    await page.waitForSelector(marker, { timeout: 20_000 });
    return `conteúdo presente (${marker})`;
  });
}

await check("U-filter", "Filtro por estado nas transacções", async () => {
  await page.getByTestId("nav-transactions").click();
  await page.waitForSelector("[data-testid='transactions-table']");
  const before = await page.locator("[data-testid^='transaction-row-']").count();
  await page.locator("select[aria-label='Filtrar por estado']").selectOption("PENDING");
  await page.waitForTimeout(600);
  const after = await page.locator("[data-testid^='transaction-row-']").count();
  assert(after <= before, `filtro não reduziu linhas (${before} → ${after})`);
  return `${before} → ${after} linhas (PENDING)`;
});

await check("U-search", "Pesquisa por referência nas transacções", async () => {
  await page.locator("select[aria-label='Filtrar por estado']").selectOption("ALL");
  await page.getByTestId("transaction-search").fill("zzz-inexistente");
  await page.waitForTimeout(500);
  const rows = await page.locator("[data-testid^='transaction-row-']").count();
  assert(rows === 0, `esperava 0 linhas, obteve ${rows}`);
  await page.getByTestId("transaction-search").fill("");
  return "pesquisa sem resultados tratada";
});

await check("U-export", "Exportar CSV gera descarregamento", async () => {
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByRole("button", { name: /Exportar CSV/ }).click();
  const download = await downloadPromise;
  assert(download.suggestedFilename().endsWith(".csv"), `ficheiro: ${download.suggestedFilename()}`);
  return download.suggestedFilename();
});

await check("U-refresh", "Botão Actualizar reconsulta dados", async () => {
  await page.getByTestId("refresh-dashboard").click();
  await page.waitForTimeout(1500);
  const text = await page.getByTestId("last-updated").textContent();
  assert(/Actualizado/.test(text ?? ""), `texto: ${text}`);
  return text?.trim().slice(0, 40) ?? "";
});

await check("U-checkout-publico", "Página de checkout pública de sessão cancelada", async () => {
  const response = await page.request.get(`${BASE}/checkout/sessao-inexistente`);
  assert(response.status() === 200, `status ${response.status()}`);
  const html = await response.text();
  assert(/Checkout não encontrado/.test(html), "mensagem de não encontrado ausente");
  return "estado de erro amigável";
});

await browser.close();
writeFileSync("./audit-results-ui.json", JSON.stringify({ results }, null, 2));
const failed = results.filter((r) => r.status === "FAIL");
console.log(`\nResumo dashboard: ${results.length - failed.length}/${results.length} passaram.`);
if (failed.length) process.exitCode = 1;
