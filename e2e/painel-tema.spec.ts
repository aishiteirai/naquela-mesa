import { expect, test } from "@playwright/test";
import { loginAsOwner } from "./helpers";

const LIGHT_BACKGROUND = "lab(100 0 0)"; // padrão fora do painel
const PANEL_LIGHT_BACKGROUND = "rgb(255, 255, 255)"; // #FFFFFF da paleta Naquela, espelhada no <html>

test("tema escuro no painel persiste, imprime claro e não vaza para o login", async ({ page }) => {
  await loginAsOwner(page, "/painel");
  const html = page.locator("html");

  await page.getByRole("button", { name: "Alternar tema" }).click();
  await page.getByRole("menuitem", { name: "Escuro" }).click();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("body")).toHaveCSS("background-color", PANEL_LIGHT_BACKGROUND);
  await page.emulateMedia({ media: "screen" });

  await page.getByRole("button", { name: "Pizzaria Demo — abrir menu da loja" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_BACKGROUND);
});

test("painel usa a primária Naquela por padrão", async ({ page }) => {
  await loginAsOwner(page, "/painel");
  await expect(page.locator("div[data-panel-theme]")).toHaveAttribute("data-panel-theme", "naquela");
  // #B5481C
  await expect(page.getByRole("button", { name: "Iniciar atendimento" })).toHaveCSS("background-color", "rgb(181, 72, 28)");
});

test("menus em portal usam a paleta Naquela e a paleta sai do <html> ao deixar o painel", async ({ page }) => {
  await loginAsOwner(page, "/painel");
  await expect(page.locator("html")).toHaveAttribute("data-panel-theme", "naquela");

  await page.getByRole("button", { name: "Alternar tema" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  // Tokens padrão do shadcn dariam borda oklch cinza; a Naquela é #EBDCC8 com texto #3B2A20.
  await expect(menu).toHaveCSS("border-color", "rgb(235, 220, 200)");
  await expect(menu).toHaveCSS("color", "rgb(59, 42, 32)");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Pizzaria Demo — abrir menu da loja" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("html")).not.toHaveAttribute("data-panel-theme", /.*/);
  await expect(page.locator("html")).not.toHaveAttribute("style", /--primary/);
});
