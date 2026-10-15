import pg from "pg";

// Cria o banco de DATABASE_URL se ainda não existir (usado pelo `make e2e`, que roda num banco separado do dev).
async function main() {
  const target = new URL(process.env.DATABASE_URL ?? "");
  const name = decodeURIComponent(target.pathname.slice(1));
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Nome de banco inesperado: ${name}`);

  const admin = new URL(target);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${name}"`);
      console.log(`Banco ${name} criado`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
