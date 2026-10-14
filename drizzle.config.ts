import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";
import { withExplicitSslMode } from "./src/shared/db/ssl";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/schema.ts",
  out: "./drizzle",
  // Migração usa a conexão direta (o pooler do Neon não suporta tudo que o drizzle-kit faz).
  dbCredentials: { url: withExplicitSslMode(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "") },
  strict: true,
});
