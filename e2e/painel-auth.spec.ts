import { expect, test } from "@playwright/test";
import { loginAsOwner } from "./helpers";

test("visitante sem sessão recebe 307 para o login com next", async ({ request }) => {
  const response = await request.get("/painel/loja", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login?next=%2Fpainel%2Floja");
});

test("dono entra e cai na fila de pedidos da própria loja", async ({ page }) => {
  await loginAsOwner(page);
  await expect(page.getByRole("heading", { level: 1, name: "Pedidos" })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("Pizzaria Demo");
  await expect(page.getByRole("navigation", { name: "Painel" }).getByRole("link", { name: "Ver cardápio" })).toHaveAttribute(
    "href",
    "/pizzaria-demo",
  );
});

test("login respeita next interno e ignora next externo", async ({ page }) => {
  await page.goto("/login?next=%2Fpainel%2Fcardapio");
  await page.getByLabel("Email").fill("dono@pizzariademo.test");
  await page.getByLabel("Senha").fill("demo-senha-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);

  await page.getByRole("button", { name: "Sair" }).click();
  await page.goto("/login?next=https%3A%2F%2Fevil.com");
  await page.getByLabel("Email").fill("dono@pizzariademo.test");
  await page.getByLabel("Senha").fill("demo-senha-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/painel$/);
});
