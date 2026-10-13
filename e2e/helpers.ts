import { expect, type Browser, type Page } from "@playwright/test";

export const OWNER_EMAIL = "dono@pizzariademo.test";
export const OWNER_PASSWORD = "demo-senha-123";

export async function loginAsOwner(page: Page, next = "/painel"): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Senha").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, "\\/")}$`));
}

export async function setStoreStatus(browser: Browser, label: "Abrir agora" | "Fechar agora" | "Automático") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAsOwner(page);
  await page.goto("/painel/loja");
  await page.getByRole("button", { name: label }).click();
  await expect(page.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
  await context.close();
}

export async function placePickupOrder(page: Page): Promise<{ orderLabel: string; trackingPath: string }> {
  await page.goto("/pizzaria-demo");
  await page.getByRole("button", { name: "Adicionar Coca-Cola 2L" }).click();
  const dialog = page.getByRole("dialog", { name: "Coca-Cola 2L" });
  await dialog.getByRole("button", { name: "Aumentar quantidade" }).click();
  await dialog.getByRole("button", { name: "Aumentar quantidade" }).click();
  await dialog.getByRole("button", { name: /^Adicionar ·/ }).click();
  await page.getByRole("link", { name: "Ver sacola" }).click();
  await page.getByRole("radio", { name: "Retirada no balcão" }).check();
  await page.getByLabel("Seu nome").fill("Maria Silva");
  await page.getByLabel("WhatsApp (com DDD)").fill("(11) 98888-7777");
  await page.getByRole("radio", { name: "Pix" }).check();
  await page.getByRole("button", { name: "Revisar pedido" }).click();
  await expect(page.getByTestId("quote-total")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  const heading = page.getByRole("heading", { name: /^Pedido #\d+ recebido!$/ });
  await expect(heading).toBeVisible();
  const orderLabel = /#\d+/.exec((await heading.textContent()) ?? "")![0];
  const trackingPath = (await page.getByRole("link", { name: "Acompanhar pedido" }).getAttribute("href"))!;
  return { orderLabel, trackingPath };
}
