import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAsOwner, placePickupOrder, setStoreStatus } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  await setStoreStatus(browser, "Abrir agora");
});

test.afterAll(async ({ browser }) => {
  await setStoreStatus(browser, "Automático");
});

async function ownerPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await loginAsOwner(page);
  return page;
}

async function customerOrder(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  const order = await placePickupOrder(page);
  return { page, ...order };
}

function card(page: Page, column: string, orderLabel: string) {
  return page.getByRole("region", { name: column }).getByRole("article", { name: `Pedido ${orderLabel}` });
}

test("pedido novo aparece sozinho e muda o título da aba", async ({ browser }) => {
  const owner = await ownerPage(browser);
  await owner.getByRole("button", { name: "Iniciar atendimento" }).click();
  await expect(owner.getByText("Atendimento ativo: alerta sonoro ligado")).toBeVisible();

  const { orderLabel } = await customerOrder(browser);

  await expect(card(owner, "Novos", orderLabel)).toBeVisible({ timeout: 15_000 });
  await expect(owner).toHaveTitle(/^\(\d+\) Novo pedido/);
});

test("atendimento continua depois de recarregar e alerta fora da página de pedidos", async ({ browser }) => {
  const owner = await ownerPage(browser);
  await owner.getByRole("button", { name: "Iniciar atendimento" }).click();
  await owner.reload();
  await expect(owner.getByText("Atendimento ativo: alerta sonoro ligado")).toBeVisible();

  await owner.getByRole("link", { name: "Cardápio" }).first().click();
  await expect(owner).toHaveURL(/\/painel\/cardapio$/);
  await customerOrder(browser);

  const alert = owner.getByTestId("new-order-alert");
  await expect(alert).toBeVisible({ timeout: 15_000 });
  await expect(owner).toHaveTitle(/^\(\d+\) Novo pedido/);
  await alert.getByRole("button", { name: "Silenciar" }).click();
  await expect(alert).toBeHidden();

  await customerOrder(browser);
  await expect(owner.getByTestId("new-order-alert")).toBeVisible({ timeout: 15_000 });
  await owner.getByTestId("new-order-alert").getByRole("link", { name: "Ver pedidos" }).click();
  await expect(owner).toHaveURL(/\/painel$/);
});

test("aceitar, pronto e concluir aparecem no acompanhamento; avisar e comanda", async ({ browser }) => {
  const { page: customer, orderLabel, trackingPath } = await customerOrder(browser);
  const owner = await ownerPage(browser);

  await owner.getByRole("button", { name: `Aceitar ${orderLabel}` }).click();
  await expect(card(owner, "Em preparo", orderLabel)).toBeVisible();
  await customer.goto(trackingPath);
  await expect(customer.getByTestId("order-status")).toHaveText("Em preparo");

  await owner.getByRole("button", { name: `Pronto ${orderLabel}` }).click();
  await expect(card(owner, "Prontos e em entrega", orderLabel)).toBeVisible();
  await customer.reload();
  await expect(customer.getByTestId("order-status")).toHaveText("Pronto para retirada");

  const notify = owner.getByRole("link", { name: `Avisar cliente ${orderLabel}` });
  const href = (await notify.getAttribute("href")) ?? "";
  expect(href.startsWith("https://wa.me/5511988887777?text=")).toBe(true);
  expect(decodeURIComponent(href.split("?text=")[1] ?? "")).toContain(`Seu pedido ${orderLabel} da Pizzaria Demo está pronto para retirada.`);

  const ticketHref = (await owner.getByRole("link", { name: `Imprimir comanda ${orderLabel}` }).getAttribute("href"))!;
  const ticket = await owner.context().newPage();
  await ticket.goto(ticketHref);
  await expect(ticket.getByText(`Pedido ${orderLabel}`)).toBeVisible();
  await expect(ticket.getByText("3x Coca-Cola 2L")).toBeVisible();
  await expect(ticket.getByText("Retirada no balcão")).toBeVisible();
  await expect(ticket.getByText("+5511988887777", { exact: false })).toBeVisible();

  await owner.getByRole("button", { name: `Concluir ${orderLabel}` }).click();
  await expect(card(owner, "Finalizados (24 h)", orderLabel)).toBeVisible();
  await customer.reload();
  await expect(customer.getByTestId("order-status")).toHaveText("Concluído");
});

test("cancelar exige motivo e aparece para o cliente", async ({ browser }) => {
  const { page: customer, orderLabel, trackingPath } = await customerOrder(browser);
  const owner = await ownerPage(browser);

  await card(owner, "Novos", orderLabel).getByRole("button", { name: `Mais ações do pedido ${orderLabel}` }).click();
  await owner.getByRole("menuitem", { name: "Cancelar pedido" }).click();
  const dialog = owner.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(dialog.getByText("informe o motivo do cancelamento")).toBeVisible();

  await dialog.getByLabel("Motivo do cancelamento").fill("acabou a massa");
  await dialog.getByRole("button", { name: "Confirmar cancelamento" }).click();
  const finalizado = card(owner, "Finalizados (24 h)", orderLabel);
  await expect(finalizado).toContainText("Cancelado");
  await expect(finalizado).toContainText("Motivo: acabou a massa");

  await customer.goto(trackingPath);
  await expect(customer.getByTestId("order-status")).toHaveText("Cancelado");
  await expect(customer.getByText("Motivo: acabou a massa")).toBeVisible();
});

test("dois aparelhos: só o primeiro aceite vale", async ({ browser }) => {
  const { orderLabel } = await customerOrder(browser);
  const deviceA = await ownerPage(browser);
  const deviceB = await ownerPage(browser);
  await expect(card(deviceB, "Novos", orderLabel)).toBeVisible();
  // Sem polling no aparelho B: a tela dele fica desatualizada até o clique.
  await deviceB.route("**/api/painel/pedidos/versao", (route) => route.abort());

  await deviceA.getByRole("button", { name: `Aceitar ${orderLabel}` }).click();
  await expect(card(deviceA, "Em preparo", orderLabel)).toBeVisible();

  await deviceB.getByRole("button", { name: `Aceitar ${orderLabel}` }).click();
  await expect(deviceB.getByTestId("queue-notice")).toHaveText("Este pedido já foi atualizado em outro aparelho.");
  await expect(card(deviceB, "Em preparo", orderLabel)).toBeVisible();
});

test("pedido que já esperava volta a alertar depois de recarregar", async ({ browser }) => {
  await customerOrder(browser);
  const owner = await ownerPage(browser);
  await owner.getByRole("button", { name: "Iniciar atendimento" }).click();
  await owner.reload();
  await expect(owner.getByText("Atendimento ativo: alerta sonoro ligado")).toBeVisible();
  await expect(owner.getByTestId("new-order-alert")).toBeVisible();
});
