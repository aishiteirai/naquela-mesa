import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@naquelamesa.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "e2e-senha-123";
const OWNER_EMAIL = "dono-e2e@naquelamesa.test";

test.describe.configure({ mode: "serial" });

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("super-admin cria loja a partir de template e o dono ativa o acesso", async ({ page, browser }) => {
  await loginAsAdmin(page);
  const form = page.getByRole("form", { name: "Nova loja" });
  await form.getByLabel("Nome da loja").fill("Hamburgueria E2E");
  await form.getByLabel("Endereço (slug)").fill("e2e-hamburgueria");
  await form.getByLabel("WhatsApp da loja").fill("(11) 97777-0000");
  await form.getByLabel("Email do dono").fill(OWNER_EMAIL);
  await form.getByLabel("Modelo de cardápio").selectOption("hamburgueria");
  await form.getByRole("button", { name: "Criar loja" }).click();

  const link = form.getByRole("textbox", { name: "Link de acesso" });
  await expect(link).toHaveValue(/\/convite\/[A-Za-z0-9_-]{43}$/);
  const inviteUrl = await link.inputValue();

  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await owner.goto(inviteUrl);
  await expect(owner.getByRole("heading", { name: "Acesso à Hamburgueria E2E" })).toBeVisible();
  await owner.getByLabel("Seu nome").fill("Dono E2E");
  await owner.getByLabel("Senha", { exact: true }).fill("senha-dono-123");
  await owner.getByLabel("Confirmar senha").fill("senha-dono-123");
  await owner.getByRole("button", { name: "Criar acesso" }).click();
  await expect(owner).toHaveURL(/\/painel$/);
  await expect(owner.getByRole("region", { name: "Primeiros passos" })).toContainText("Primeiros passos (1 de 5)");

  await owner.goto(inviteUrl);
  await expect(owner.getByRole("heading", { name: "Link inválido ou expirado." })).toBeVisible();
  await ownerContext.close();

  await page.goto("/e2e-hamburgueria");
  await expect(page.getByRole("heading", { name: "Hambúrgueres" })).toBeVisible();
});

test("acesso de suporte entra no painel da loja e fica registrado", async ({ page }) => {
  await loginAsAdmin(page);
  const row = page.getByRole("row", { name: /Hamburgueria E2E/ });
  await expect(row).toContainText(OWNER_EMAIL);
  await row.getByRole("button", { name: "Acessar como loja" }).click();

  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByText("Modo suporte: você está vendo o painel da Hamburgueria E2E.")).toBeVisible();
  await page.getByRole("button", { name: "Sair do modo suporte" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  const log = page.getByRole("region", { name: "Registro de suporte" });
  await expect(log.getByRole("listitem").nth(0)).toContainText("Acesso de suporte encerrado · Hamburgueria E2E");
  await expect(log.getByRole("listitem").nth(1)).toContainText("Acesso de suporte iniciado · Hamburgueria E2E");
});

test("link de convite inválido mostra a página de erro", async ({ page }) => {
  await page.goto("/convite/token-que-nao-existe");
  await expect(page.getByRole("heading", { name: "Link inválido ou expirado." })).toBeVisible();
});
