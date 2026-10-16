import { expect, test } from "@playwright/test";
import { loginAsOwner } from "./helpers";

const LIGHT_BACKGROUND = "lab(100 0 0)";

test("tema escuro no painel persiste, imprime claro e não vaza para o login", async ({ page }) => {
  await loginAsOwner(page, "/painel");
  const html = page.locator("html");

  await page.getByRole("button", { name: "Alternar tema" }).click();
  await page.getByRole("menuitem", { name: "Escuro" }).click();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_BACKGROUND);
  await page.emulateMedia({ media: "screen" });

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_BACKGROUND);
});

test("painel usa a primária Naquela por padrão", async ({ page }) => {
  await loginAsOwner(page, "/painel");
  await expect(page.locator("[data-panel-theme]")).toHaveAttribute("data-panel-theme", "naquela");
  // #B5481C
  await expect(page.getByRole("button", { name: "Iniciar atendimento" })).toHaveCSS("background-color", "rgb(181, 72, 28)");
});
