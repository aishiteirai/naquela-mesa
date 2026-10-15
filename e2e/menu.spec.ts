import { expect, test } from "@playwright/test";

test("cardápio público da Pizzaria Demo", async ({ page }) => {
  await page.goto("/pizzaria-demo");

  await expect(page.getByRole("heading", { level: 1, name: "Pizzaria Demo" })).toBeVisible();
  await expect(page).toHaveTitle("Pizzaria Demo | Naquela Mesa");
  await expect(page.getByTestId("open-status")).toHaveText(/^(Aberto agora|Fechado no momento|Abre .+ às \d\d:\d\d)$/);

  const nav = page.getByRole("navigation", { name: "Categorias" });
  await expect(nav.getByRole("link")).toHaveText(["Pizzas Salgadas", "Pizzas Doces", "Bebidas", "Sobremesas"]);

  const calabresa = page.getByRole("article").filter({ hasText: "Calabresa" });
  await expect(calabresa).toContainText(/a partir de R\$\s34,90/);

  const coca = page.getByRole("article").filter({ hasText: "Coca-Cola 2L" });
  await expect(coca).toContainText(/R\$\s14,00/);
  await expect(coca).not.toContainText("a partir de");

  const frango = page.getByRole("article").filter({ hasText: "Frango com Catupiry" });
  await expect(frango).toContainText("Esgotado");
  await expect(calabresa).not.toContainText("Esgotado");
});

test("link de categoria leva à seção", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await page.getByRole("navigation", { name: "Categorias" }).getByRole("link", { name: "Bebidas" }).click();
  await expect(page).toHaveURL(/#categoria-/);
  await expect(page.getByRole("heading", { level: 2, name: "Bebidas" })).toBeInViewport();
});

test("slug inexistente mostra loja não encontrada", async ({ page }) => {
  await page.goto("/loja-que-nao-existe");
  await expect(page.getByRole("heading", { name: "Loja não encontrada" })).toBeVisible();
});

test("slug inválido não chega ao cache e mostra loja não encontrada", async ({ page }) => {
  await page.goto("/Loja_Invalida");
  await expect(page.getByRole("heading", { name: "Loja não encontrada" })).toBeVisible();
});

test("cardápio continua claro com o sistema em modo escuro", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/pizzaria-demo");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", "lab(100 0 0)");
});

test("tema da loja vale no <html> (componentes em portal) e sai ao deixar a loja", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  const html = page.locator("html");
  const primary = () => html.evaluate((element) => element.style.getPropertyValue("--primary"));
  await expect.poll(primary).not.toBe("");

  await page.getByRole("link", { name: "Política de privacidade" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect.poll(primary).toBe("");
});

test("item abre com ?item= na URL e o voltar do navegador fecha", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await page.getByRole("button", { name: "Adicionar Coca-Cola 2L" }).click();
  const dialog = page.getByRole("dialog", { name: "Coca-Cola 2L" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\?item=/);
  const itemUrl = page.url();

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/pizzaria-demo$/);
  await expect(page.getByRole("heading", { level: 1, name: "Pizzaria Demo" })).toBeVisible();

  await page.goto(itemUrl);
  await expect(page.getByRole("dialog", { name: "Coca-Cola 2L" })).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao cardápio" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/pizzaria-demo$/);
});

test("?item= de produto inexistente não abre nada e limpa a URL", async ({ page }) => {
  await page.goto("/pizzaria-demo?item=nao-existe");
  await expect(page).toHaveURL(/\/pizzaria-demo$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("loja sem foto de capa mostra o topo em gradiente", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await expect(page.getByTestId("cover-fallback")).toBeVisible();
});

test("landing page mostra a proposta, como funciona e o convite final", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Pedidos como em casa, do celular do cliente para a sua cozinha." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Como funciona" }).getByRole("listitem")).toHaveCount(3);
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Criar minha loja" }).click();
  await expect(page).toHaveURL(/#comecar$/);
  await expect(page.getByRole("heading", { name: "Vamos abrir a sua mesa?" })).toBeInViewport();
  await expect(page.getByRole("img", { name: "Logo Naquela Mesa" })).toBeVisible();
});
