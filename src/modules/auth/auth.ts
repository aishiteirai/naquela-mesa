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
  trustedOrigins: getEnv().BETTER_AUTH_TRUSTED_ORIGINS,
  rateLimit: {
    // Ligado também fora de produção; só o servidor do E2E desliga.
    enabled: getEnv().E2E_DISABLE_RATE_LIMIT !== "1",
    storage: "database",
    window: 60,
    max: 100,
    customRules: { "/sign-in/email": { window: 60, max: 5 } },
  },
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
