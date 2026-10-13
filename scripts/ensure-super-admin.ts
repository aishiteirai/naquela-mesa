import { ensureSuperAdmin } from "@/modules/auth";
import { pool } from "@/shared/db/client";

async function main() {
  const [email, name = "Super Admin"] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Uso: ADMIN_PASSWORD=<senha> npm run admin:ensure -- <email> [nome]");
    process.exitCode = 1;
    return;
  }
  const result = await ensureSuperAdmin({ email, password, name });
  console.log(result.created ? `Super-admin criado: ${email}` : `Usuário promovido a super-admin (senha atualizada): ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
