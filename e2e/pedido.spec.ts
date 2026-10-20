import { expect, test, type Page } from "@playwright/test";
import { loginAsOwner, setStoreStatus } from "./helpers";

test.describe.configure({ mode: "serial" });

// O horário real não pode decidir o teste: a loja fica aberta durante a suíte.
test.beforeAll(async ({ browser }) => {
  await setStoreStatus(browser, "Abrir agora");
});

test.afterAll(async ({ browser }) => {
  await setStoreStatus(browser, "Automático");
});

async function addSimple(page: Page, name: string, quantity = 1) {
  await page.getByRole("button", { name: `Adicionar ${name}` }).click();
  const dialog = page.getByRole("dialog", { name });
  for (let added = 1; added < quantity; added++) await dialog.getByRole("button", { name: "Aumentar quantidade" }).click();
  await dialog.getByRole("button", { name: /^Adicionar ·/ }).click();
  await expect(dialog).toBeHidden();
}

async function goToCheckout(page: Page) {
  await page.getByRole("link", { name: "Ver sacola" }).click();
  await expect(page).toHaveURL(/\/pizzaria-demo\/sacola$/);
  await page.getByRole("button", { name: "Continuar" }).click();
}

async function fillCustomerAndReview(page: Page) {
  await page.getByLabel("Seu nome").fill("Maria Silva");
  await page.getByLabel("WhatsApp (com DDD)").fill("(11) 98888-7777");
  await page.getByRole("button", { name: "Continuar" }).click();
}

test("pizza meio a meio com borda + bebida, delivery em dinheiro, até o acompanhamento", async ({ page }) => {
  await page.goto("/pizzaria-demo");

  await page.getByRole("button", { name: "Adicionar Calabresa" }).click();
  const dialog = page.getByRole("dialog", { name: "Calabresa" });
  await dialog.getByRole("radio", { name: /^Grande/ }).check();
  await dialog.getByRole("radio", { name: "Mussarela", exact: true }).check();
  await dialog.getByRole("radio", { name: /^Catupiry/ }).check();
  await expect(dialog.getByRole("button", { name: /^Adicionar ·/ })).toHaveText(/R\$\s64,90/);
  await dialog.getByRole("button", { name: /^Adicionar ·/ }).click();

  await addSimple(page, "Coca-Cola 2L");
  await expect(page.getByRole("link", { name: "Ver sacola" })).toContainText(/\(2\)/);
  await goToCheckout(page);
  await page.getByRole("radio", { name: "Delivery" }).check();
  await page.getByLabel("Rua").fill("Rua das Acácias");
  await page.getByLabel("Número").fill("45");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByRole("button", { name: "Continuar" }).click();
  await fillCustomerAndReview(page);
  await page.getByRole("radio", { name: "Dinheiro" }).check();
  await page.getByLabel("Troco para (deixe vazio se não precisa)").fill("100,00");
  await expect(page.getByTestId("quote-total")).toHaveText(/R\$\s84,90/);

  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  const heading = page.getByRole("heading", { name: /^Pedido #\d{4} recebido!$/ });
  await expect(heading).toBeVisible();
  const orderLabel = /#\d+/.exec((await heading.textContent()) ?? "")![0];

  const whatsapp = page.getByRole("link", { name: "Enviar pedido no WhatsApp" });
  const href = (await whatsapp.getAttribute("href")) ?? "";
  expect(href.startsWith("https://wa.me/5511999999999?text=")).toBe(true);
  const message = decodeURIComponent(href.split("?text=")[1] ?? "");
  expect(message).toContain(`*Pedido ${orderLabel}* — Pizzaria Demo`);
  expect(message).toContain("Grande — ½ Calabresa + ½ Mussarela");
  expect(message).toContain("+ Borda recheada: Catupiry");
  expect(message).toContain("Endereço: Rua das Acácias, 45 — Centro");
  expect(message).toMatch(/\*Total: R\$\s84,90\*/);
  expect(message).toMatch(/troco para R\$\s100,00/);

  await page.getByRole("link", { name: "Acompanhar pedido" }).click();
  await expect(page.getByRole("heading", { name: `Pedido ${orderLabel}`, exact: true })).toBeVisible();
  await expect(page.getByTestId("order-status")).toHaveText("Recebido — aguardando a loja");
  await expect(page.getByText("Olá, Maria!")).toBeVisible();
  // Reload: o roteador mantém a tela anterior (com o link do WhatsApp) oculta no DOM após navegação client-side.
  await page.reload();
  await expect(page.getByTestId("order-status")).toBeVisible();
  const html = await page.content();
  expect(html).not.toContain("98888");
  expect(html).not.toContain("Acácias");

  await page.goto("/pizzaria-demo");
  await expect(page.getByRole("link", { name: "Ver sacola" })).toHaveCount(0);
});

test("pedido abaixo do mínimo avisa na sacola e não deixa continuar", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await addSimple(page, "Água sem gás 500ml");
  await page.getByRole("link", { name: "Ver sacola" }).click();
  await expect(page.getByTestId("min-order-notice")).toHaveText(/Pedido mínimo de R\$\s30,00 \(sem a entrega\)\. Faltam R\$\s26,00\./);
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();

  await page.getByRole("button", { name: "Aumentar Água sem gás 500ml" }).click();
  await expect(page.getByTestId("min-order-notice")).toContainText(/Faltam R\$\s22,00/);
  await page.getByRole("button", { name: "Remover Água sem gás 500ml" }).click();
  await expect(page.getByText("Sua sacola está vazia.")).toBeVisible();
});

test("produto esgotado não tem botão de adicionar", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  await expect(page.getByRole("button", { name: "Adicionar Frango com Catupiry" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adicionar Calabresa" })).toBeVisible();
});

test("loja fechada bloqueia a revisão do pedido", async ({ page, browser }) => {
  await setStoreStatus(browser, "Fechar agora");
  try {
    await page.goto("/pizzaria-demo");
    await page.getByRole("button", { name: "Adicionar Coca-Cola 2L" }).click();
    const dialog = page.getByRole("dialog", { name: "Coca-Cola 2L" });
    await dialog.getByRole("button", { name: "Aumentar quantidade" }).click();
    await dialog.getByRole("button", { name: "Aumentar quantidade" }).click();
    await dialog.getByRole("button", { name: /^Adicionar ·/ }).click();
    await goToCheckout(page);
    await page.getByRole("radio", { name: "Retirada no balcão" }).check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await fillCustomerAndReview(page);
    await expect(page.getByTestId("checkout-error")).toContainText("A loja está fechada agora.");
  } finally {
    await setStoreStatus(browser, "Abrir agora");
  }
});

test("voltar do navegador volta uma etapa do checkout sem perder os dados", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  // 3 × R$ 14,00 passa do pedido mínimo (R$ 30,00) da Pizzaria Demo.
  await addSimple(page, "Coca-Cola 2L", 3);
  await goToCheckout(page);
  await page.getByRole("radio", { name: "Retirada no balcão" }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Seu nome").fill("Maria Silva");
  await expect(page).toHaveURL(/etapa=3/);

  await page.goBack();
  await expect(page).toHaveURL(/etapa=2/);
  await expect(page.getByRole("radio", { name: "Retirada no balcão" })).toBeChecked();
  await page.goForward();
  await expect(page.getByLabel("Seu nome")).toHaveValue("Maria Silva");
});

test("recarregar no meio do checkout volta para a primeira etapa", async ({ page }) => {
  await page.goto("/pizzaria-demo");
  // 3 × R$ 14,00 passa do pedido mínimo (R$ 30,00) da Pizzaria Demo.
  await addSimple(page, "Coca-Cola 2L", 3);
  await goToCheckout(page);
  await page.getByRole("radio", { name: "Retirada no balcão" }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.reload();
  await expect(page).not.toHaveURL(/etapa=/);
  await expect(page.getByRole("heading", { level: 1, name: "Sua sacola" })).toBeVisible();
});

test("link de pedido inválido mostra não encontrado", async ({ page }) => {
  await page.goto("/pizzaria-demo/pedido/token-invalido");
  await expect(page.getByRole("heading", { name: "Pedido não encontrado" })).toBeVisible();
});

test("item que saiu do cardápio fica marcado na sacola e bloqueia o avanço", async ({ page, browser }) => {
  await page.goto("/pizzaria-demo");
  await addSimple(page, "Coca-Cola 2L", 3);

  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await loginAsOwner(owner, "/painel/cardapio");
  const toggle = owner.getByRole("switch", { name: "Disponível: Coca-Cola 2L" });
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  try {
    await page.goto("/pizzaria-demo/sacola");
    await expect(page.getByTestId("cart-line-problem")).toContainText("não está mais disponível");
    await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await page.getByRole("button", { name: "Remover Coca-Cola 2L" }).click();
    await expect(page.getByText("Sua sacola está vazia.")).toBeVisible();
  } finally {
    await toggle.click();
    await expect(toggle).toBeChecked();
    await ownerContext.close();
  }
});
