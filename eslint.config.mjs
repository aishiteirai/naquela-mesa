import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const moduleInternals = {
  group: ["@/modules/*/*", "!@/modules/*/client"],
  message: "Importe outro módulo só pela API pública: '@/modules/<nome>' ou '@/modules/<nome>/client'.",
};
const parentRelative = {
  group: ["../*", "../**"],
  message: "Use './' dentro do módulo ou '@/...' para o resto. Imports '../' são proibidos.",
};
const appLayer = {
  group: ["@/app", "@/app/*", "@/app/**"],
  message: "Código de módulo/shared não depende da camada app.",
};
const modulesLayer = {
  group: ["@/modules", "@/modules/*", "@/modules/**"],
  message: "src/shared não depende de módulos.",
};

const boundaries = [
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [moduleInternals, parentRelative] }] },
  },
  {
    files: ["src/modules/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [moduleInternals, parentRelative, appLayer] }] },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [moduleInternals, parentRelative, appLayer, modulesLayer] }],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaries,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
