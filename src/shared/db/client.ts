import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/shared/env";
import { withExplicitSslMode } from "./ssl";

export const pool = new Pool({ connectionString: withExplicitSslMode(getEnv().DATABASE_URL), max: getEnv().DATABASE_POOL_MAX });

export const db = drizzle(pool);
