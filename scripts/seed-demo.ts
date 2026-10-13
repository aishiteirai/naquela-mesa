import { pool } from "@/shared/db/client";
import { DEMO_STORE_SLUG } from "./demo/pizzaria-demo";
import { seedDemoStore } from "./demo/seed";

seedDemoStore()
  .then(() => console.log(`Loja demo pronta: /${DEMO_STORE_SLUG}`))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
