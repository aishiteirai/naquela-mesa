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
