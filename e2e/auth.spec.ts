import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@naquelamesa.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "e2e-senha-123";

test("visitante sem sessão é redirecionado de /admin para /login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});

test("senha errada mostra erro genérico", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill("senha-errada-999");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("Email ou senha inválidos.");
});

test("email inexistente mostra o mesmo erro genérico", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ninguem@naquelamesa.test");
  await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("Email ou senha inválidos.");
});

test("super-admin entra no painel e sai", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Painel do super-admin" })).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});
