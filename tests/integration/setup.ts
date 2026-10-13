import { inject } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.BETTER_AUTH_SECRET ??= "integration-test-secret-with-32-plus-chars";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
