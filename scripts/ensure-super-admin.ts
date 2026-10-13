import { ensureSuperAdmin } from "@/modules/auth";
import { pool } from "@/shared/db/client";

async function main() {
  const [email, password, name = "Super Admin"] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Uso: npm run admin:ensure -- <email> <senha> [nome]");
    process.exitCode = 1;
    return;
  }
  const result = await ensureSuperAdmin({ email, password, name });
  console.log(result.created ? `Super-admin criado: ${email}` : `Usuário promovido a super-admin: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
