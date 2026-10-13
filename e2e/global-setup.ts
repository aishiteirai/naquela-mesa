import { execSync } from "node:child_process";

// Banco previsível a cada execução: recria a Pizzaria Demo (e o dono demo).
export default function globalSetup() {
  execSync("npm run seed:demo", { stdio: "inherit" });
}
