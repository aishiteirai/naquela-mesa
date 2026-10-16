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

async function selectCategory(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Categorias do cardápio" }).getByRole("button", { name }).click();
  await expect(page.getByRole("region", { name })).toBeVisible();
}

test("editar preço de um tamanho no painel lateral aparece no cardápio", async ({ page }) => {
  await page.getByRole("button", { name: "Editar Calabresa" }).click();
  const sheet = page.getByRole("dialog", { name: "Editar produto" });
  await expect(page).toHaveURL(/\?produto=/);
  await sheet.getByLabel("Preço Broto").fill("39,90");
  await sheet.getByRole("button", { name: "Salvar produto" }).click();

  await expect(sheet).toBeHidden();
  await expect(page.getByText("Produto salvo")).toBeVisible();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);

  await expect(await publicCard(page, "Calabresa")).toContainText(/a partir de R\$\s39,90/);
});

test("preço digitado errado mostra erro no painel e não salva", async ({ page }) => {
  await page.getByRole("button", { name: "Editar Mussarela" }).click();
  const sheet = page.getByRole("dialog", { name: "Editar produto" });
  await sheet.getByLabel("Preço Broto").fill("12.50");
  await sheet.getByRole("button", { name: "Salvar produto" }).click();

  await expect(sheet.getByText("preço inválido (use 34,90)")).toBeVisible();
  await expect(page).toHaveURL(/\?produto=/);
  await expect(await publicCard(page, "Mussarela")).toContainText(/a partir de R\$\s32,90/);
});

test("voltar do navegador fecha o painel do produto; link direto abre", async ({ page }) => {
  await page.getByRole("button", { name: "Editar Calabresa" }).click();
  const sheet = page.getByRole("dialog", { name: "Editar produto" });
  await expect(sheet.getByLabel("Nome", { exact: true })).toHaveValue("Calabresa");
  const productUrl = page.url();

  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);
  await expect(page.getByRole("heading", { level: 1, name: "Cardápio" })).toBeVisible();

  await page.goto(productUrl);
  await expect(page.getByRole("dialog", { name: "Editar produto" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/painel\/cardapio$/);
});

test("rotas antigas do cardápio redirecionam", async ({ page }) => {
  await page.getByRole("button", { name: "Editar Calabresa" }).click();
  const productId = new URL(page.url()).searchParams.get("produto")!;

  await page.goto(`/painel/cardapio/produtos/${productId}`);
  await expect(page).toHaveURL(new RegExp(`/painel/cardapio\\?produto=${productId}$`));
  await expect(page.getByRole("dialog", { name: "Editar produto" })).toBeVisible();

  await page.goto("/painel/disponibilidade");
  await expect(page).toHaveURL(/\/painel\/cardapio$/);

  await page.goto("/painel/cardapio/produtos/novo");
  await expect(page).toHaveURL(/\/painel\/cardapio$/);

  await page.getByRole("button", { name: "Produto", exact: true }).click();
  const categoryId = new URL(page.url()).searchParams.get("novo")!;
  await page.goto(`/painel/cardapio/produtos/novo?categoria=${categoryId}`);
  await expect(page).toHaveURL(new RegExp(`novo=${categoryId}`));
  await expect(page.getByRole("dialog", { name: "Novo produto" })).toBeVisible();
});

test("nova categoria com produto aparece no cardápio", async ({ page }) => {
  await page.getByRole("button", { name: "Categoria", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nova categoria" });
  await dialog.getByLabel("Nova categoria").fill("Combos");
  await dialog.getByRole("button", { name: "Adicionar categoria" }).click();
  await expect(dialog).toBeHidden();

  await selectCategory(page, "Combos");
  await page.getByRole("region", { name: "Combos" }).getByRole("button", { name: "Produto", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Novo produto" });
  await expect(page).toHaveURL(/\?categoria=[^&]+&novo=/);
  await sheet.getByLabel("Nome", { exact: true }).fill("Combo Família");
  await sheet.getByLabel("Preço", { exact: true }).fill("89,90");
  await sheet.getByRole("button", { name: "Salvar produto" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("region", { name: "Combos" }).getByRole("button", { name: "Editar Combo Família" })).toBeVisible();

  await page.goto("/pizzaria-demo");
  await expect(page.getByRole("navigation", { name: "Categorias" }).getByRole("button", { name: "Combos" })).toBeVisible();
  await expect(await publicCard(page, "Combo Família")).toContainText(/R\$\s89,90/);
});

test("chave de disponível esconde o Adicionar no cardápio público", async ({ page }) => {
  await selectCategory(page, "Bebidas");
  const toggle = page.getByRole("switch", { name: "Disponível: Coca-Cola 2L" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(page.getByText("Coca-Cola 2L marcada como esgotada")).toBeVisible();
  await expect(toggle).not.toBeChecked();

  const card = await publicCard(page, "Coca-Cola 2L");
  await expect(card).toContainText("Esgotado");
  await expect(page.getByRole("button", { name: "Adicionar Coca-Cola 2L" })).toHaveCount(0);

  await page.goto("/painel/cardapio");
  await selectCategory(page, "Bebidas");
  await page.getByRole("switch", { name: "Disponível: Coca-Cola 2L" }).click();
  await expect(page.getByRole("switch", { name: "Disponível: Coca-Cola 2L" })).toBeChecked();
  await page.goto("/pizzaria-demo");
  await expect(page.getByRole("button", { name: "Adicionar Coca-Cola 2L" })).toBeVisible();
});

test("fechar agora e voltar ao automático", async ({ page }) => {
  await page.goto("/painel/loja?aba=horarios");
  await page.getByRole("button", { name: "Fechar agora" }).click();
  await expect(page.getByRole("button", { name: "Fechar agora" })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/pizzaria-demo");
  await expect(page.getByTestId("open-status")).toHaveText("Fechado no momento");

  await page.goto("/painel/loja?aba=horarios");
  await page.getByRole("button", { name: "Automático" }).click();
  await expect(page.getByRole("button", { name: "Automático" })).toHaveAttribute("aria-pressed", "true");
});

test("prévia muda ao trocar a cor; cor, fonte e logo aparecem no cardápio", async ({ page }) => {
  await page.goto("/painel/loja");
  const appearance = page.getByRole("tabpanel", { name: "Aparência" });
  // Preencher antes da hidratação não dispara o onChange do React (e repetir o mesmo valor também não):
  // alterna para outra cor e volta, até a prévia reagir.
  await expect(async () => {
    await appearance.getByLabel("Cor principal").fill("#000000");
    await appearance.getByLabel("Cor principal").fill("#1d4ed8");
    await expect(appearance.getByTestId("preview-cart-button")).toHaveCSS("background-color", "rgb(29, 78, 216)", { timeout: 1_000 });
  }).toPass();

  await appearance.getByRole("combobox", { name: "Fonte dos títulos" }).click();
  await page.getByRole("option", { name: "Clássica (com serifa)" }).click();
  await appearance.getByLabel("Logo").setInputFiles("e2e/fixtures/logo.png");
  await expect(appearance.getByRole("img", { name: "Prévia: Logo" })).toBeVisible();
  await appearance.getByRole("button", { name: "Salvar aparência" }).click();
  await expect(appearance.getByRole("status")).toHaveText("Aparência salva.");

  await page.goto("/pizzaria-demo");
  await expect(page.getByRole("img", { name: "Logo de Pizzaria Demo" })).toBeVisible();
  await expect(page.locator('[style*="--primary:#1d4ed8"]')).toHaveCount(1);
  await expect(page.locator('[style*="--heading-font:var(--font-lora)"]')).toHaveCount(1);
});

test("abas das configurações seguem ?aba=", async ({ page }) => {
  await page.goto("/painel/loja");
  await page.getByRole("tab", { name: "Pedidos e pagamento" }).click();
  await expect(page).toHaveURL(/\/painel\/loja\?aba=pedidos$/);
  await expect(page.getByRole("tabpanel", { name: "Pedidos e pagamento" }).getByRole("button", { name: "Salvar operação" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("tab", { name: "Pedidos e pagamento" })).toHaveAttribute("aria-selected", "true");
});

test("turnos sobrepostos são recusados", async ({ page }) => {
  await page.goto("/painel/loja?aba=horarios");
  const hours = page.getByRole("region", { name: "Horários de funcionamento" });
  await hours.getByRole("button", { name: "Adicionar turno" }).click();
  await hours.getByRole("button", { name: "Adicionar turno" }).click();
  await hours.getByRole("button", { name: "Salvar horários" }).click();

  await expect(hours.getByText("há turnos sobrepostos")).toBeVisible();
});

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("menu abre pelo botão e navega", async ({ page }) => {
    await page.goto("/painel");
    const nav = page.getByRole("navigation", { name: "Painel" });
    await expect(nav).toBeHidden();

    await page.getByRole("button", { name: "Abrir menu" }).click();
    await nav.getByRole("link", { name: "Métricas" }).click();
    await expect(page).toHaveURL(/\/painel\/metricas$/);
    await expect(page.getByRole("heading", { level: 1, name: "Métricas" })).toBeVisible();
    await expect(nav).toBeHidden();
  });
});
