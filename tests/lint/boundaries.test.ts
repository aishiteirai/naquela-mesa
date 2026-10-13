import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function restrictedImportCount(source: string, filePath: string): Promise<number> {
  const code = `import * as dep from "${source}";\nexport const used = dep;\n`;
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.filter((m) => m.ruleId === "no-restricted-imports").length;
}

describe("fronteiras de módulo", { timeout: 30_000 }, () => {
  it.each([
    ["src/app/page.tsx", "@/modules/orders"],
    ["src/app/page.tsx", "@/modules/orders/client"],
    ["src/app/page.tsx", "@/shared/money"],
    ["src/modules/catalog/service.ts", "./repo"],
    ["src/modules/catalog/service.ts", "@/modules/orders"],
    ["src/modules/catalog/service.ts", "@/shared/db/client"],
    ["src/shared/env.ts", "@/shared/money"],
  ])("%s pode importar %s", async (file, source) => {
    expect(await restrictedImportCount(source, file)).toBe(0);
  });

  it.each([
    ["src/app/page.tsx", "@/modules/orders/service"],
    ["src/app/page.tsx", "@/modules/orders/nested/deep"],
    ["src/modules/catalog/service.ts", "@/modules/orders/repo"],
    ["src/modules/catalog/service.ts", "../orders/service"],
    ["src/modules/catalog/service.ts", "@/app/page"],
    ["src/shared/env.ts", "@/modules/orders"],
    ["src/shared/env.ts", "@/app/layout"],
  ])("%s NÃO pode importar %s", async (file, source) => {
    expect(await restrictedImportCount(source, file)).toBeGreaterThan(0);
  });
});
