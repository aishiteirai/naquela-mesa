import { expect, test, type Page } from "@playwright/test";
import { loginAsOwner } from "./helpers";

// Os testes alteram a Pizzaria Demo; o globalSetup recria a loja a cada execução.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await loginAsOwner(page, "/painel/cardapio");
});

async function publicCard(page: Page, name: string) {
  await page.goto("/pizzaria-demo");
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

test("editar preço de um tamanho aparece no cardápio", async ({ page }) => {
  await page.getByRole("link", { name: "Editar Calabresa" }).click();
  await page.getByLabel("Preço Broto").fill("39,90");
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);

  await expect(await publicCard(page, "Calabresa")).toContainText(/a partir de R\$\s39,90/);
});

test("preço digitado errado mostra erro e não salva", async ({ page }) => {
  await page.getByRole("link", { name: "Editar Mussarela" }).click();
  await page.getByLabel("Preço Broto").fill("12.50");
  await page.getByRole("button", { name: "Salvar produto" }).click();

  await expect(page.getByText("preço inválido (use 34,90)")).toBeVisible();
  await expect(page).toHaveURL(/\/painel\/cardapio\/produtos\//);
  await expect(await publicCard(page, "Mussarela")).toContainText(/a partir de R\$\s32,90/);
});

test("nova categoria com produto aparece no cardápio", async ({ page }) => {
  await page.getByLabel("Nova categoria").fill("Combos");
  await page.getByRole("button", { name: "Adicionar categoria" }).click();
  const combos = page.getByRole("region", { name: "Combos" });
  await expect(combos).toBeVisible();

  await combos.getByRole("link", { name: "Novo produto" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Novo produto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar produto" })).toBeVisible();
  await page.getByLabel("Nome", { exact: true }).fill("Combo Família");
  await page.getByLabel("Preço", { exact: true }).fill("89,90");
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);

  await page.goto("/pizzaria-demo");
  await expect(page.getByRole("navigation", { name: "Categorias" }).getByRole("link", { name: "Combos" })).toBeVisible();
  await expect(await publicCard(page, "Combo Família")).toContainText(/R\$\s89,90/);
});

test("marcar esgotado na disponibilidade aparece no cardápio", async ({ page }) => {
  await page.getByRole("navigation", { name: "Painel" }).getByRole("link", { name: "Disponibilidade" }).click();
  await page.getByRole("button", { name: "Marcar Coca-Cola 2L como esgotado" }).click();
  await expect(page.getByRole("button", { name: "Marcar Coca-Cola 2L como disponível" })).toBeVisible();

  await expect(await publicCard(page, "Coca-Cola 2L")).toContainText("Esgotado");
});

test("fechar agora e voltar ao automático", async ({ page }) => {
  await page.goto("/painel/loja");
  await page.getByRole("button", { name: "Fechar agora" }).click();
  await expect(page.getByRole("button", { name: "Fechar agora" })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/pizzaria-demo");
  await expect(page.getByTestId("open-status")).toHaveText("Fechado no momento");

  await page.goto("/painel/loja");
  await page.getByRole("button", { name: "Automático" }).click();
  await expect(page.getByRole("button", { name: "Automático" })).toHaveAttribute("aria-pressed", "true");
});

test("cor principal e logo aparecem no cardápio", async ({ page }) => {
  await page.goto("/painel/loja");
  const appearance = page.getByRole("region", { name: "Aparência" });
  await appearance.getByLabel("Cor principal").fill("#1d4ed8");
  await appearance.getByLabel("Logo").setInputFiles("e2e/fixtures/logo.png");
  await expect(appearance.getByRole("img", { name: "Prévia: Logo" })).toBeVisible();
  await appearance.getByRole("button", { name: "Salvar aparência" }).click();
  await expect(appearance.getByRole("status")).toHaveText("Aparência salva.");

  await page.goto("/pizzaria-demo");
  await expect(page.getByRole("img", { name: "Logo de Pizzaria Demo" })).toBeVisible();
  await expect(page.locator('[style*="--primary:#1d4ed8"]')).toHaveCount(1);
});

test("turnos sobrepostos são recusados", async ({ page }) => {
  await page.goto("/painel/loja");
  const hours = page.getByRole("region", { name: "Funcionamento" });
  await hours.getByRole("button", { name: "Adicionar turno" }).click();
  await hours.getByRole("button", { name: "Adicionar turno" }).click();
  await hours.getByRole("button", { name: "Salvar horários" }).click();

  await expect(hours.getByText("há turnos sobrepostos")).toBeVisible();
});
