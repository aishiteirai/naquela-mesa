import { ensureUser } from "@/modules/auth";
import { addStoreMember, getStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";

async function main() {
  const [slug, email, password, name = "Dono da loja"] = process.argv.slice(2);
  if (!slug || !email || !password) {
    console.error("Uso: npm run owner:ensure -- <slug> <email> <senha> [nome]");
    process.exitCode = 1;
    return;
  }
  const store = await getStoreBySlug(slug);
  if (!store) {
    console.error(`Loja não encontrada: ${slug}`);
    process.exitCode = 1;
    return;
  }
  const owner = await ensureUser({ email, password, name });
  await addStoreMember(store.id, owner.id);
  console.log(`${email} agora é dono(a) de /${slug}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
