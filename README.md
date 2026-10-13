# Naquela Mesa

Cardápio digital e pedidos para restaurantes da região.

- Spec do MVP: `docs/superpowers/specs/2026-10-13-naquela-mesa-mvp-design.md`
- Planos: `docs/superpowers/plans/`

## Requisitos

- Node 24+ (`.nvmrc`)
- Docker (Postgres local e testes de integração)

## Primeiros passos

```bash
npm install
cp .env.example .env.local        # gere BETTER_AUTH_SECRET com: openssl rand -base64 32
npm run db:up
npm run db:migrate
npm run seed:demo
npm run admin:ensure -- voce@exemplo.com uma-senha-forte "Seu Nome"
npm run dev
```

Acesse http://localhost:3000/login.

O seed cria o dono demo `dono@pizzariademo.test` / `demo-senha-123` (painel em `/painel`).

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run lint` | ESLint (inclui fronteiras de módulo) |
| `npm run typecheck` | checagem de tipos |
| `npm test` | testes unitários |
| `npm run test:int` | testes de integração (Postgres via Docker) |
| `npm run test:e2e` | testes E2E (Playwright; requer banco migrado, `seed:demo` e super-admin `e2e-admin@naquelamesa.test`) |
| `npm run db:generate` | gera migration a partir dos schemas |
| `npm run db:migrate` | aplica migrations |
| `npm run seed:demo` | cria/recria a loja "Pizzaria Demo" em `/pizzaria-demo` |
| `npm run admin:ensure -- <email> <senha> [nome]` | cria ou promove super-admin |
| `npm run owner:ensure -- <slug> <email> <senha> [nome]` | cria usuário (se preciso) e o vincula como dono da loja |

## Arquitetura

Monólito modular. Código de domínio em `src/modules/<nome>/`, exposto só por `index.ts`
(servidor) e `client.ts` (navegador). Utilidades em `src/shared/`. Rotas finas em `src/app/`.
Imports `../` são proibidos; o lint falha se um módulo importar internals de outro.

## Painel da loja

- `/painel` — dono da loja (login em `/login`). Demo: `dono@pizzariademo.test` / `demo-senha-123`.
- Cardápio, adicionais, disponibilidade e configurações; cada alteração atualiza o cardápio público na hora.
- Imagens enviadas ficam em `.data/uploads` (local); servidas em `/uploads/<arquivo>`.
