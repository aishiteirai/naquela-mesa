import { execSync } from "node:child_process";

// Banco previsível a cada execução: recria a Pizzaria Demo (e o dono demo) e apaga a loja criada pelo E2E do admin.
export default function globalSetup() {
  execSync("npm run seed:demo", { stdio: "inherit" });
  execSync('npm run admin:ensure -- e2e-admin@naquelamesa.test e2e-senha-123 "E2E Admin"', { stdio: "inherit" });
  execSync("npm run e2e:cleanup", { stdio: "inherit" });
}
