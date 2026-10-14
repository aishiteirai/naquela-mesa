// Build da Vercel: migra só em produção (ou com MIGRATE_ON_BUILD=1), depois `next build`.
import { spawnSync } from "node:child_process";

function run(args) {
  const result = spawnSync("npx", args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL_ENV === "production" || process.env.MIGRATE_ON_BUILD === "1") {
  run(["drizzle-kit", "migrate"]);
} else {
  console.log("migrations skipped (preview)");
}
run(["next", "build"]);
