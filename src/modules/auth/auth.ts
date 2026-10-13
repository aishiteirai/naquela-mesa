import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { db } from "@/shared/db/client";
import { getEnv } from "@/shared/env";
import * as schema from "./schema";

export const auth = betterAuth({
  secret: getEnv().BETTER_AUTH_SECRET,
  baseURL: getEnv().BETTER_AUTH_URL,
  // Só o servidor dos testes E2E define isto (vários logins em sequência a partir do mesmo IP).
  ...(getEnv().E2E_DISABLE_AUTH_RATE_LIMIT === "1" ? { rateLimit: { enabled: false } } : {}),
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["super_admin"],
      roles: { super_admin: adminAc, user: userAc },
    }),
    nextCookies(),
  ],
});
