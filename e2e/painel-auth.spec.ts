import { expect, test } from "@playwright/test";
import { loginAsOwner, placePickupOrder, setStoreStatus } from "./helpers";

test("visitante sem sessão recebe 307 para o login com next", async ({ request }) => {
  const response = await request.get("/painel/loja", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login?next=%2Fpainel%2Floja");
});

test("dono entra e cai na fila de pedidos da própria loja", async ({ page }) => {
  await loginAsOwner(page);
  await expect(page.getByRole("heading", { level: 1, name: "Pedidos" })).toBeVisible();
  await expect(page.locator('[data-slot="sidebar"]')).toContainText("Pizzaria Demo");
  const nav = page.getByRole("navigation", { name: "Painel" });
  await expect(nav.getByRole("link", { name: "Pedidos" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Pizzaria Demo — abrir menu da loja" }).click();
  await expect(page.getByRole("menuitem", { name: "Ver cardápio" })).toHaveAttribute("href", "/pizzaria-demo");
  await page.keyboard.press("Escape");

  await nav.getByRole("link", { name: "Cardápio" }).click();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);
  await expect(nav.getByRole("link", { name: "Cardápio" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Pedidos" })).not.toHaveAttribute("aria-current", "page");
});

test("barra lateral mostra pedidos novos mesmo fora da tela de pedidos", async ({ page, browser }) => {
  await setStoreStatus(browser, "Abrir agora");
  await loginAsOwner(page, "/painel/metricas");
  const pedidos = page.getByRole("navigation", { name: "Painel" }).getByRole("link", { name: /^Pedidos/ });
  const countNow = async () => Number(/(\d+) novos?/.exec((await pedidos.textContent()) ?? "")?.[1] ?? 0);
  const before = await countNow();

  const customer = await browser.newPage();
  await placePickupOrder(customer);
  await customer.close();

  // Outros specs podem criar pedidos em paralelo; basta que o selo suba (consulta a cada 15 s).
  await expect.poll(countNow, { timeout: 25_000 }).toBeGreaterThan(before);
  await expect(pedidos).toContainText(/\d+ novos?/);
});

test("login respeita next interno e ignora next externo", async ({ page }) => {
  await page.goto("/login?next=%2Fpainel%2Fcardapio");
  await page.getByLabel("Email").fill("dono@pizzariademo.test");
  await page.getByLabel("Senha").fill("demo-senha-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);

  await page.getByRole("button", { name: "Pizzaria Demo — abrir menu da loja" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.goto("/login?next=https%3A%2F%2Fevil.com");
  await page.getByLabel("Email").fill("dono@pizzariademo.test");
  await page.getByLabel("Senha").fill("demo-senha-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/painel$/);
});
