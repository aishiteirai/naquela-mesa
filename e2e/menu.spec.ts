import { expect, test } from "@playwright/test";

test("cardápio público da Pizzaria Demo", async ({ page }) => {
  await page.goto("/pizzaria-demo");

  await expect(page.getByRole("heading", { level: 1, name: "Pizzaria Demo" })).toBeVisible();
  await expect(page).toHaveTitle("Pizzaria Demo | Naquela Mesa");
  await expect(page.getByTestId("open-status")).toHaveText(/^(Aberto agora|Fechado no momento|Abre .+ às \d\d:\d\d)$/);

  const nav = page.getByRole("navigation", { name: "Categorias" });
  await expect(nav.getByRole("button")).toHaveText(["Pizzas Salgadas", "Pizzas Doces", "Bebidas", "Sobremesas"]);

  const calabresa = page.getByRole("article").filter({ hasText: "Calabresa" });
  await expect(calabresa).toContainText(/a partir de R\$\s34,90/);

  const coca = page.getByRole("article").filter({ hasText: "Coca-Cola 2L" });
  await expect(coca).toContainText(/R\$\s14,00/);
  await expect(coca).not.toContainText("a partir de");

  const frango = page.getByRole("article").filter({ hasText: "Frango com Catupiry" });
  await expect(frango).toContainText("Esgotado");
  await expect(calabresa).not.toContainText("Esgotado");
});

test("aba de categoria leva à seção sem mudar a URL", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  const button = page.getByRole("navigation", { name: "Categorias" }).getByRole("button", { name: "Bebidas" });
  await button.click();
  await expect(page.getByRole("heading", { level: 2, name: "Bebidas" })).toBeInViewport();
  await expect(page).toHaveURL(/\/pizzaria-demo$/);
  await expect(button).toHaveAttribute("aria-current", "true");
});

test("aba da última categoria fica ativa mesmo com seção curta", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  const button = page.getByRole("navigation", { name: "Categorias" }).getByRole("button", { name: "Sobremesas" });
  await button.click();
  await expect(button).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("heading", { level: 2, name: "Sobremesas" })).toBeInViewport();
});

test("aba ativa acompanha o scroll até o fim e de volta ao topo", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  const nav = page.getByRole("navigation", { name: "Categorias" });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(nav.getByRole("button", { name: "Sobremesas" })).toHaveAttribute("aria-current", "true");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(nav.getByRole("button", { name: "Pizzas Salgadas" })).toHaveAttribute("aria-current", "true");
});

test("página sem scroll mantém a primeira aba ativa", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 4000 });
  await page.goto("/pizzaria-demo");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  // Dá tempo da hidratação rodar o cálculo da aba ativa antes de afirmar.
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const nav = page.getByRole("navigation", { name: "Categorias" });
  await expect(nav.getByRole("button", { name: "Pizzas Salgadas" })).toHaveAttribute("aria-current", "true");
  await expect(nav.getByRole("button", { name: "Sobremesas" })).not.toHaveAttribute("aria-current", "true");
});

test("slug inexistente mostra loja não encontrada", async ({ page }) => {
  await page.goto("/loja-que-nao-existe");
  await expect(page.getByRole("heading", { name: "Loja não encontrada" })).toBeVisible();
});

test("slug inválido não chega ao cache e mostra loja não encontrada", async ({ page }) => {
  await page.goto("/Loja_Invalida");
  await expect(page.getByRole("heading", { name: "Loja não encontrada" })).toBeVisible();
});

test("cardápio começa claro mesmo com o sistema em modo escuro", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/pizzaria-demo");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", "lab(100 0 0)");
});

test("cliente troca o cardápio para o modo escuro; a escolha vale na sacola e não vaza para fora da loja", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  const html = page.locator("html");
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await page.getByRole("menuitem", { name: "Escuro" }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).not.toHaveCSS("background-color", "lab(100 0 0)");

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.goto("/pizzaria-demo/sacola");
  await expect(html).toHaveClass(/\bdark\b/);

  await page.goto("/login");
  await expect(html).not.toHaveClass(/\bdark\b/);

  await page.goto("/pizzaria-demo");
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await page.getByRole("menuitem", { name: "Claro" }).click();
  await expect(html).not.toHaveClass(/\bdark\b/);
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

test("abrir item não muda a URL e Voltar ao cardápio fecha", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await page.getByRole("button", { name: "Adicionar Coca-Cola 2L" }).click();
  await expect(page.getByRole("dialog", { name: "Coca-Cola 2L" })).toBeVisible();
  await expect(page).toHaveURL(/\/pizzaria-demo$/);

  await page.getByRole("button", { name: "Voltar ao cardápio" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/pizzaria-demo$/);
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

test("aba do navegador usa o logo do Naquela Mesa", async ({ page, request }) => {
  await page.goto("/");
  const icon = page.locator('head link[rel="icon"][type="image/svg+xml"]');
  await expect(icon).toHaveCount(1);
  const response = await request.get((await icon.getAttribute("href"))!);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("#D9622B");
  await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveCount(1);
});
