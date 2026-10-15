import { devices, expect, test } from "@playwright/test";
import { placePickupOrder, setStoreStatus } from "./helpers";

// defaultBrowserType não pode ser trocado por arquivo; o resto do perfil do Pixel 7 sim.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _browser, ...pixel7 } = devices["Pixel 7"];
test.use(pixel7);

test.beforeAll(async ({ browser }) => {
  await setStoreStatus(browser, "Abrir agora");
});

test.afterAll(async ({ browser }) => {
  await setStoreStatus(browser, "Automático");
});

test("pedido completo no celular até o acompanhamento", async ({ page }) => {
  const { orderLabel, trackingPath } = await placePickupOrder(page);
  await page.goto(trackingPath);
  await expect(page.getByRole("heading", { name: `Pedido ${orderLabel}`, exact: true })).toBeVisible();
  await expect(page.getByTestId("order-status")).toHaveText("Recebido — aguardando a loja");
});
