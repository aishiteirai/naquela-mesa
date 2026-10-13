import { deleteUserByEmail } from "@/modules/auth";
import { deleteStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";

const E2E_STORE_SLUG = "e2e-hamburgueria";
const E2E_OWNER_EMAIL = "dono-e2e@naquelamesa.test";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("e2e:cleanup não roda com NODE_ENV=production");
  await deleteStoreBySlug(E2E_STORE_SLUG);
  await deleteUserByEmail(E2E_OWNER_EMAIL);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
