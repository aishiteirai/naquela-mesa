import { expect, test } from "@playwright/test";
import { loginAsOwner, placePickupOrder, setStoreStatus } from "./helpers";

test.beforeAll(async ({ browser }) => {
  await setStoreStatus(browser, "Abrir agora");
});

test("métricas mostram o histórico do seed e o pedido de hoje", async ({ page, browser }) => {
  const customer = await browser.newPage();
  await placePickupOrder(customer);
  await customer.close();

  await loginAsOwner(page, "/painel/metricas");
  await expect(page.getByRole("heading", { name: "Métricas" })).toBeVisible();
  await expect(page.getByText(/^Últimos 7 dias · /)).toBeVisible();

  await page.getByRole("combobox", { name: "Período" }).selectOption("30d");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/periodo=30d/);
  await expect(page.getByRole("region", { name: "Mais vendidos (top 10)" }).getByRole("listitem")).not.toHaveCount(0);
  await expect(page.getByRole("region", { name: "Pedidos por hora" }).getByRole("listitem")).not.toHaveCount(0);

  await page.getByRole("combobox", { name: "Período" }).selectOption("hoje");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/periodo=hoje/);
  await expect(page.getByRole("region", { name: "Por tipo de pedido" })).toContainText("Retirada no balcão");
  await expect(page.getByRole("region", { name: "Mais vendidos (top 10)" })).toContainText("Coca-Cola 2L");
});

test("período personalizado inválido mostra o erro", async ({ page }) => {
  await loginAsOwner(page, "/painel/metricas");
  await page.getByRole("combobox", { name: "Período" }).selectOption("personalizado");
  await page.getByLabel("De", { exact: true }).fill("2026-10-10");
  await page.getByLabel("Até", { exact: true }).fill("2026-10-01");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("A data de início deve ser antes da data de fim.")).toBeVisible();
});

test("histórico encontra o pedido pelo número e mostra o detalhe", async ({ page, browser }) => {
  const customer = await browser.newPage();
  const { orderLabel } = await placePickupOrder(customer);
  await customer.close();

  await loginAsOwner(page, "/painel/pedidos");
  await expect(page.getByRole("heading", { name: "Histórico de pedidos" })).toBeVisible();

  await page.getByRole("combobox", { name: "Período" }).selectOption("hoje");
  await page.getByLabel("Buscar").fill(orderLabel);
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByText("1 pedido", { exact: true })).toBeVisible();

  const item = page.getByRole("group", { name: `Pedido ${orderLabel}` });
  await item.locator("summary").click();
  await expect(item).toContainText("3x Coca-Cola 2L");
  await expect(item).toContainText("Maria Silva");
  await expect(item.getByRole("link", { name: `Imprimir comanda ${orderLabel}` })).toBeVisible();

  await page.getByRole("combobox", { name: "Período" }).selectOption("30d");
  await page.getByLabel("Buscar").fill("");
  await page.getByLabel("Status").selectOption("cancelled");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("group").first()).toContainText("Cancelado");
});
