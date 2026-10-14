import { z } from "zod";

const optionalText = z.string().min(1).optional();

const envSchema = z
  .object({
    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),
    BETTER_AUTH_SECRET: z.string().min(32, "precisa ter ao menos 32 caracteres"),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_TRUSTED_ORIGINS: z
      .string()
      .optional()
      .transform((value) => (value ? value.split(",").map((origin) => origin.trim()).filter(Boolean) : [])),
    APP_URL: z.url().optional(),
    E2E_DISABLE_RATE_LIMIT: z.literal("1").optional(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: optionalText,
    BLOB_READ_WRITE_TOKEN: optionalText,
  })
  .transform((env) => ({ ...env, DATABASE_POOL_MAX: env.DATABASE_POOL_MAX ?? (env.VERCEL_ENV ? 3 : 10) }))
  .superRefine((env, ctx) => {
    if (Boolean(env.UPSTASH_REDIS_REST_URL) !== Boolean(env.UPSTASH_REDIS_REST_TOKEN)) {
      const missing = env.UPSTASH_REDIS_REST_URL ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL";
      ctx.addIssue({ code: "custom", path: [missing], message: "defina URL e token do Upstash juntos" });
    }
    if (env.VERCEL_ENV !== "production") return;
    // Em produção serverless, limitador em memória e disco local não funcionam: falha cedo.
    if (!env.UPSTASH_REDIS_REST_URL) ctx.addIssue({ code: "custom", path: ["UPSTASH_REDIS_REST_URL"], message: "obrigatória em produção" });
    if (!env.BLOB_READ_WRITE_TOKEN) ctx.addIssue({ code: "custom", path: ["BLOB_READ_WRITE_TOKEN"], message: "obrigatória em produção" });
    if (env.E2E_DISABLE_RATE_LIMIT) ctx.addIssue({ code: "custom", path: ["E2E_DISABLE_RATE_LIMIT"], message: "proibida em produção" });
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Variáveis de ambiente inválidas: ${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** URL pública do app (links de acompanhamento e convite). */
export function appUrl(): string {
  const env = getEnv();
  return env.APP_URL ?? env.BETTER_AUTH_URL;
}
