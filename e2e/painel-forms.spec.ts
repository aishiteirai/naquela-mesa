import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginAsOwner } from "./helpers";

// Radix volta ao valor do mount quando o <form> é resetado após a action: o valor salvo precisa continuar na tela.
test.describe.configure({ mode: "serial" });

/** Clica no botão de salvar e espera a server action terminar. */
async function saveAndWait(page: Page, button: Locator) {
  const done = page.waitForResponse((response) => response.request().method() === "POST");
  await button.click();
  await done;
  await expect(button).toBeEnabled();
}

test("operação: campo desmarcado continua desmarcado depois de salvar e não é revertido no próximo save", async ({ page }) => {
  await loginAsOwner(page, "/painel");
  await page.goto("/painel/loja?aba=pedidos");
  const panel = page.getByRole("tabpanel", { name: "Pedidos e pagamento" });
  const card = panel.getByRole("checkbox", { name: "Cartão na entrega" });
  const save = panel.getByRole("button", { name: "Salvar operação" });
  await expect(card).toBeChecked();

  await card.click();
  await expect(card).not.toBeChecked();
  await saveAndWait(page, save);
  await expect(card).not.toBeChecked();

  await page.reload();
  await expect(card).not.toBeChecked();

  await panel.getByLabel("Chave Pix").fill("outra@pizzariademo.com.br");
  await saveAndWait(page, save);
  await page.reload();
  await expect(card).not.toBeChecked();
  await expect(panel.getByLabel("Chave Pix")).toHaveValue("outra@pizzariademo.com.br");

  // restaura
  await card.click();
  await panel.getByLabel("Chave Pix").fill("pix@pizzariademo.com.br");
  await saveAndWait(page, save);
  await page.reload();
  await expect(card).toBeChecked();
});

test("tamanhos: seletor de sabores mantém o valor salvo e não reverte ao renomear", async ({ page }) => {
  await loginAsOwner(page, "/painel/cardapio");
  const open = async () => {
    await page.getByRole("region", { name: "Pizzas Salgadas" }).getByRole("button", { name: "Tamanhos" }).click();
    const sheet = page.getByRole("dialog", { name: /Tamanhos/ });
    const row = sheet.getByRole("listitem").filter({ has: page.getByLabel("Tamanho", { exact: true }) }).first();
    return { row };
  };
  let { row } = await open();
  await expect(row.getByLabel("Tamanho", { exact: true })).toHaveValue("Broto");
  const flavors = row.getByRole("combobox");
  await expect(flavors).toContainText("1 sabor");

  await flavors.click();
  await page.getByRole("option", { name: "até 2 sabores" }).click();
  await saveAndWait(page, row.getByRole("button", { name: "Salvar tamanho" }));
  await expect(flavors).toContainText("até 2 sabores");

  await row.getByLabel("Tamanho", { exact: true }).fill("Brotinho");
  await saveAndWait(page, row.getByRole("button", { name: "Salvar tamanho" }));
  await page.reload();
  ({ row } = await open());
  await expect(row.getByLabel("Tamanho", { exact: true })).toHaveValue("Brotinho");
  await expect(row.getByRole("combobox")).toContainText("até 2 sabores");

  // restaura
  await row.getByLabel("Tamanho", { exact: true }).fill("Broto");
  await row.getByRole("combobox").click();
  await page.getByRole("option", { name: "1 sabor" }).click();
  await saveAndWait(page, row.getByRole("button", { name: "Salvar tamanho" }));
  await page.reload();
  ({ row } = await open());
  await expect(row.getByRole("combobox")).toContainText("1 sabor");
});
