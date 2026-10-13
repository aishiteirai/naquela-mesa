import { expect, type Page } from "@playwright/test";

export const OWNER_EMAIL = "dono@pizzariademo.test";
export const OWNER_PASSWORD = "demo-senha-123";

export async function loginAsOwner(page: Page, next = "/painel"): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Senha").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, "\\/")}$`));
}
