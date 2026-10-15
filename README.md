<div align="center">

<pre>
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣶⣶⣶⣶⣶⣦⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⣀⣶⣿⠟⠛⠋⠙⠛⠛⠛⢿⣿⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢸⣾⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⣦⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢘⣿⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢿⣿⣄⡀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢸⣻⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣿⣿⣧⡀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⣸⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⠁⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠈⠙⢣⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⣽⢿⠃⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠈⣿⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣿⣎⡀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠻⠿⡆⠀⠀⠀⠀⠀⠀⠀⡠⠁⠙⠿⡇⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠢⢄⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢀⠤⠒⠒⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠒⢄⡀⠀
⠀⠀⠀⠀⡰⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠑                                              
 ,                                    ,_ _               
/|/\    _,   _,         _ |\  _,     /| | |   _  ,   _,  
 |  |  / |  / |  |  |  |/ |/ / |      | | |  |/ / \_/ |  
 |  |_/\/|_/\/|_/ \/|_/|_/|_/\/|_/    | | |_/|_/ \/ \/|_/
              |)                                         
</pre>

<h3>Cardápio digital com pedidos direto pelo celular</h3>

<p>O cliente monta o pedido em uma página pública da loja.<br>
A equipe recebe, acompanha e imprime tudo em um painel que se atualiza sozinho.<br>
Sem app para instalar.</p>

<p>
<img alt="Next.js" src="https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white">
<img alt="React" src="https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB">
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white">
<img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white">
<img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white">
<img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white">
</p>

</div>

<br>

## Como funciona o pedido

```
 Cliente                                   Loja
 ───────                                   ────
 1. Abre o cardápio  /<loja>
 2. Escolhe itens, tamanhos e adicionais
 3. Revisa a sacola e faz o checkout
    (entrega, retirada ou mesa;
     dinheiro, cartão ou Pix)
 4. Confirma ──────────────────────────▶  5. Pedido entra na fila (alerta sonoro)
    e envia o resumo pelo WhatsApp         6. Aceita, prepara e avança o status
 7. Acompanha pelo link do pedido  ◀────     (comanda impressa ao aceitar)
                                           8. Avisa o cliente pelo WhatsApp
```

O total exibido no navegador é apenas uma estimativa: **o preço é sempre recalculado no servidor** antes de o pedido ser gravado.

## Principais funções

**Para o cliente**
- Cardápio público por loja, responsivo e sem cadastro
- Tamanhos, sabores meio a meio e adicionais por produto
- Entrega, retirada ou consumo na mesa; dinheiro, cartão na entrega ou Pix
- Envio do pedido completo por WhatsApp e página de acompanhamento

**Para a loja (`/painel`)**
- Fila de pedidos por status com atualização automática, alerta sonoro e tela sempre acesa
- Comanda para impressora térmica de 80 mm, com impressão automática ao aceitar
- Editor de cardápio, adicionais, disponibilidade, horários, entrega e Pix, com efeito imediato na página pública
- Histórico com filtros e busca; métricas de faturamento, ticket médio, cancelamentos, produtos mais vendidos e pedidos por hora, tipo e canal
- Checklist de primeiros passos até a loja estar pronta

**Para a administração (`/admin`)**
- Criação de lojas a partir de modelos de cardápio prontos
- Link de acesso de uso único para o dono definir a senha (válido por 7 dias)
- Modo suporte para acessar o painel de uma loja, com registro de auditoria

## Stack

| Camada | Tecnologia |
|---|---|
| Aplicação | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Dados | PostgreSQL + Drizzle ORM, validação com Zod |
| Autenticação | Better Auth |
| Infraestrutura | Vercel, Neon, Upstash Redis (rate limit), Vercel Blob (imagens), Sentry |
| Testes | Vitest (unitários e integração com Testcontainers), Playwright (E2E) |

## Rodando localmente

Requisitos: **Node 24+** e **Docker**.

```bash
make setup    # dependências, .env.local, Postgres, migrações e loja demo
make dev      # http://localhost:3000
```

A loja demo fica em `/pizzaria-demo`, com cerca de 30 dias de pedidos fictícios para as métricas. Para entrar no painel, use `dono@pizzariademo.test` / `demo-senha-123` em `/login`. Para criar o primeiro super-admin:

```bash
make admin EMAIL=voce@exemplo.com SENHA=uma-senha-forte
```

<details>
<summary><b>Todos os comandos</b></summary>

| Comando | O que faz |
|---|---|
| `make setup` | Primeira instalação completa |
| `make dev` | Sobe o Postgres, migra e roda o servidor (`PORT=3001` para outra porta) |
| `make update` | `git pull`, dependências, migrações e demo |
| `make test` | Lint, tipos, testes unitários e de integração |
| `make e2e` | Build e testes E2E (Playwright) |
| `make check` | Tudo o que o CI roda |
| `make db-seed` | Recria a loja demo |
| `make db-studio` | Abre o Drizzle Studio |
| `make admin EMAIL=... SENHA=...` | Cria ou promove um super-admin |
| `make owner SLUG=... EMAIL=... SENHA=...` | Vincula um dono a uma loja |
| `make help` | Lista todos os comandos |

</details>

## Arquitetura

O projeto é um **monólito modular**: uma única aplicação, com um deploy e um banco, organizada por dentro em módulos de domínio com fronteiras rígidas. Cada módulo funciona como um pequeno serviço, com seus dados, suas regras e uma API pública, mas tudo roda no mesmo processo. Assim fica a simplicidade de operar um monólito sem o acoplamento típico dele, e se um domínio precisar virar um serviço separado, a fronteira já existe.

```
src/
├── app/            rotas, páginas, server actions e APIs (Next.js App Router)
├── modules/        domínio, um diretório por contexto de negócio
│   └── <módulo>/
│       ├── index.ts      API pública para o servidor
│       ├── client.ts     API pública para o navegador (quando existe)
│       ├── schema.ts     tabelas do módulo (Drizzle)
│       └── service.ts    casos de uso
└── shared/         infraestrutura sem regra de negócio: banco, env, dinheiro, validação
```

| Módulo | Responsabilidade |
|---|---|
| `auth` | Login, sessão, papel de super-admin e guardas de acesso |
| `stores` | Lojas, membros, horários, configurações, tema e convites |
| `catalog` | Cardápio, tamanhos, adicionais e disponibilidade |
| `orders` | Checkout, preço, fila, status, histórico e métricas |
| `whatsapp` | Mensagens de pedido e de status |
| `onboarding` | Criação de lojas por modelo e checklist inicial |
| `media` | Validação e armazenamento de imagens |
| `audit` | Registro de ações sensíveis, como o modo suporte |

As fronteiras são verificadas pelo ESLint, então uma violação quebra o CI:
- Um módulo só importa outro pela API pública (`@/modules/<nome>`), nunca por arquivos internos.
- As dependências seguem um único sentido: `app → modules → shared`. Não há ciclos entre módulos.
- Cada módulo declara as próprias tabelas em `schema.ts`; o Drizzle junta todas para gerar as migrações.

## Deploy

O roteiro completo (Vercel, Neon, Upstash, Blob, Sentry, domínio e checklist) está em [`docs/deploy.md`](docs/deploy.md).

Variáveis obrigatórias em produção: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (ou `KV_REST_API_*`) e `BLOB_STORE_ID` (ou `BLOB_READ_WRITE_TOKEN`). Nunca defina `E2E_DISABLE_RATE_LIMIT` em produção.

<br>

<div align="center">
<sub>Naquela Mesa · cardápio digital e gestão de pedidos</sub>
</div>
