# Naquela Mesa

**Cardápio digital com pedidos para pequenos restaurantes, pizzarias e lanchonetes**, no estilo Anota AI, Goomer e Beefood. O cliente pede pelo celular, o pedido aparece na hora no painel da loja (com alerta sonoro e comanda para impressora térmica) e segue para o WhatsApp do restaurante já formatado.

- **Produção:** https://naquela-mesa.vercel.app
- **Status:** MVP completo (fases F0 a F6) e em produção, em fase de demonstração para os primeiros restaurantes.

---

## Sumário

1. [O que o sistema faz](#o-que-o-sistema-faz)
2. [Como um pedido acontece](#como-um-pedido-acontece)
3. [Tecnologias](#tecnologias)
4. [Arquitetura](#arquitetura)
5. [Rodando na sua máquina](#rodando-na-sua-máquina)
6. [Comandos do dia a dia](#comandos-do-dia-a-dia)
7. [Testes e CI](#testes-e-ci)
8. [Deploy e custos](#deploy-e-custos)
9. [Segurança e LGPD](#segurança-e-lgpd)
10. [Estrutura de pastas](#estrutura-de-pastas)
11. [Próximos passos](#próximos-passos)
12. [Documentação](#documentação)

---

## O que o sistema faz

O Naquela Mesa é **multi-loja**: uma única instalação atende vários restaurantes, cada um no seu endereço (`/pizzaria-do-joao`, `/lanchonete-da-maria`…). A aparência e as regras são configuradas pelo painel, sem código por cliente.

Há três tipos de usuário:

### 🍕 Cliente final (sem login)

| O que faz | Onde |
|---|---|
| Vê o cardápio da loja, com fotos, preços, esgotados e o horário de funcionamento | `/<loja>` |
| Monta o pedido: tamanhos, **pizza meio a meio**, adicionais (borda, bacon…) e observações | botão **Adicionar** em cada produto |
| Escolhe delivery, retirada ou consumo no local; paga em dinheiro (com troco), cartão na entrega ou Pix | `/<loja>/sacola` |
| Envia o pedido formatado para o WhatsApp da loja | depois de confirmar |
| Acompanha o status do pedido por link | `/<loja>/pedido/<código>` |

### 🧑‍🍳 Dono do restaurante (painel)

| O que faz | Onde |
|---|---|
| **Fila de pedidos** em colunas (Novos, Em preparo, Prontos/Em entrega, Finalizados), atualizada sozinha a cada 5 s, com alerta sonoro, notificação e tela sempre acesa | `/painel` |
| Aceita, avança ou cancela pedidos; **avisa o cliente** pelo WhatsApp; **imprime a comanda** em 80 mm (inclusive automaticamente ao aceitar) | cartão de cada pedido |
| **Histórico** com filtros por período e status e busca por número, nome ou telefone | `/painel/pedidos` |
| **Métricas**: faturamento, ticket médio, cancelamentos, top 10 produtos, pedidos por hora, por tipo e por canal | `/painel/metricas` |
| Cadastra categorias, tamanhos, produtos (com foto), grupos de adicionais e marca itens esgotados | `/painel/cardapio`, `/painel/disponibilidade` |
| Configura logo, banner, cores, horários, "Abrir/Fechar agora", taxas de entrega (fixa ou por bairro), formas de pagamento e pedido mínimo | `/painel/loja` |
| Vê o checklist **Primeiros passos** até a loja estar pronta | topo do `/painel` |

### 🛠️ Super-admin (você, dono da plataforma)

| O que faz | Onde |
|---|---|
| Cria uma loja em minutos a partir de um **modelo de cardápio** (Pizzaria, Hamburgueria ou Lanchonete) | `/admin` → **Nova loja** |
| Gera um **link de acesso** (vale 7 dias, uma vez só) para o dono criar a senha, ou redefinir a senha depois | depois de criar a loja, ou em **Lojas** |
| **Acessa o painel de qualquer loja** para dar suporte (modo suporte com faixa de aviso) | **Lojas → Acessar como loja** |
| Consulta o **registro de suporte** (quem entrou, em qual loja, quando) | **Registro de suporte** |

> **Fora do MVP (roadmap):** bot de pedidos pelo WhatsApp (API oficial), Pix online, cupons, agendamento, taxa por distância, vários usuários por loja e domínio próprio por loja.

---

## Como um pedido acontece

```
Cliente (celular)                    Servidor                         Restaurante (painel)
─────────────────                    ────────                         ────────────────────
1. Abre /pizzaria-demo  ───────────▶ monta o cardápio (com cache)
2. Monta a sacola (fica no navegador)
3. "Revisar pedido"     ───────────▶ recalcula TODOS os preços,
                                     taxa, horário e regras
4. "Confirmar pedido"   ───────────▶ grava o pedido com número
                                     sequencial (#0042)  ─────────▶ 5. Em até ~5 s o pedido
                                                                       aparece em "Novos" com som
6. "Enviar no WhatsApp" ──▶ WhatsApp da loja com o pedido completo
                                                                    7. Aceita → imprime a comanda
                                                                    8. Avança: em preparo → saiu
                                                                       para entrega → concluído
9. Acompanha o status pelo link ◀──── status atualizado ◀────────── 9. "Avisar cliente" (WhatsApp)
```

Pontos importantes do fluxo:

- **O preço é sempre calculado no servidor.** O total mostrado no navegador é só uma estimativa; se o cardápio mudou, o cliente vê o novo valor antes de confirmar.
- **Clique duplo não gera pedido duplicado** (chave de idempotência por pedido).
- **Dois aparelhos no painel** não conseguem aceitar o mesmo pedido duas vezes: o segundo recebe "Este pedido já foi atualizado em outro aparelho".
- **O link de acompanhamento não mostra dados pessoais** (só o primeiro nome, os itens e o status).

---

## Tecnologias

| Camada | Escolha | Por quê |
|---|---|---|
| App web | **Next.js 16** (App Router, Server Components, Server Actions) + **React 19** + **TypeScript** | um projeto só para cardápio, painel e backend |
| Estilo | **Tailwind CSS 4** | layout padronizado com o tema de cada loja por variáveis CSS |
| Banco | **PostgreSQL** (Neon em produção) + **Drizzle ORM** | SQL tipado e migrações versionadas em `drizzle/` |
| Login | **Better Auth** (email e senha, plugin admin) | sessões no banco, impersonação para suporte, cadastro público desligado |
| Validação | **Zod** | toda entrada de formulário e configuração é validada |
| Rate limit | **Upstash Redis** | limita pedidos, cotações, convites e uploads (o login usa o limitador do Better Auth no banco) |
| Imagens | **Vercel Blob** | logos, banners e fotos dos produtos |
| Erros | **Sentry** (carregado só quando configurado) | erros inesperados; regras de negócio não poluem o painel |
| Testes | **Vitest** (unitários e integração com Postgres no Docker) + **Playwright** (E2E) | |
| Hospedagem | **Vercel** (funções em São Paulo) | deploy a cada push na `main` |

---

## Arquitetura

O projeto é um **monólito modular**: um único app, mas com o domínio dividido em módulos isolados.

```
src/
├── app/            ← rotas e telas (finas: só chamam módulos)
├── modules/        ← regras de negócio, uma pasta por domínio
│   ├── stores/       lojas, horários, entrega, membros, convites
│   ├── catalog/      categorias, tamanhos, produtos, adicionais
│   ├── orders/       preços, pedidos, fila, status, histórico, métricas
│   ├── whatsapp/     mensagens e links wa.me
│   ├── auth/         login, sessão, super-admin, impersonação
│   ├── onboarding/   modelos de cardápio, criação de loja, checklist
│   ├── audit/        registro de ações do super-admin
│   └── media/        upload de imagens (disco local ou Vercel Blob)
└── shared/         ← utilidades sem regra de negócio (dinheiro, env, banco, rate limit…)
```

Regras que o **lint verifica automaticamente**:

1. Cada módulo expõe só o que está em `index.ts` (servidor) e `client.ts` (código seguro para o navegador). Importar arquivos internos de outro módulo quebra o build.
2. `src/app/` nunca acessa o banco diretamente, só pelos módulos.
3. Imports com `../` são proibidos (exceto entre `schema.ts`, para chaves estrangeiras).

Outras decisões:

- **Isolamento entre lojas:** o `storeId` do painel sempre vem da sessão, nunca de um parâmetro do navegador. Há testes garantindo que a loja A não lê nem altera dados da loja B.
- **Dinheiro em centavos** (`number` inteiro), formatado só na tela com `formatBRL`.
- **Datas no fuso da loja** (`America/Sao_Paulo` por padrão), inclusive em métricas e horários.
- **Tempo quase real por polling:** o painel consulta só uma "versão" leve da fila e recarrega quando ela muda.

---

## Rodando na sua máquina

### Pré-requisitos

- **Node.js 24+**
- **Docker** (Postgres local e testes de integração)
- **make** (opcional, mas facilita)

### Primeira vez

```bash
git clone https://github.com/aishiteirai/naquela-mesa.git
cd naquela-mesa
make setup        # instala dependências, cria .env.local, sobe o Postgres, migra e cria a loja demo
make admin EMAIL=voce@exemplo.com SENHA=uma-senha-forte   # seu super-admin local
make dev          # http://localhost:3000
```

<details>
<summary>Sem make (passo a passo manual)</summary>

```bash
npm install
cp .env.example .env.local            # troque BETTER_AUTH_SECRET por: openssl rand -base64 32
npm run db:up                         # Postgres no Docker (porta 5434)
npm run db:migrate
npm run seed:demo
ADMIN_PASSWORD=uma-senha-forte npm run admin:ensure -- voce@exemplo.com "Seu Nome"
npm run dev
```
</details>

### O que abrir

| Endereço | O quê | Acesso |
|---|---|---|
| http://localhost:3000/pizzaria-demo | cardápio da loja demo | público |
| http://localhost:3000/painel | painel da Pizzaria Demo | `dono@pizzariademo.test` / `demo-senha-123` |
| http://localhost:3000/admin | painel do super-admin | o usuário criado com `make admin` |

A **Pizzaria Demo** vem com cardápio completo (pizzas meio a meio, bordas, bebidas), horários, bairros e **~30 dias de pedidos fictícios** para as métricas terem o que mostrar. `make update` (ou `npm run seed:demo`) recria tudo do zero.

> A loja demo segue os horários cadastrados (fecha às segundas). Para testar um pedido fora do horário, use **Loja → Abrir agora** no painel.

---

## Comandos do dia a dia

### Makefile

| Comando | O que faz |
|---|---|
| `make setup` | primeira vez: dependências, `.env.local`, Postgres, migrações e loja demo |
| `make dev` | sobe o Postgres, aplica migrações e roda o servidor (`PORT=3000`) |
| `make update` | depois de um `git pull`: dependências, migrações e loja demo |
| `make test` | lint, tipos, testes unitários e de integração |
| `make e2e` | build de produção + testes E2E |
| `make check` | tudo o que o CI roda |
| `make admin EMAIL=… SENHA=… [NOME=…]` | cria ou promove um super-admin (e troca a senha se já existir) |
| `make owner SLUG=… EMAIL=… SENHA=… [NOME=…]` | vincula um dono a uma loja |
| `make help` | lista todos os comandos |

Qualquer comando aceita outra porta: `make dev PORT=3001`.

### Scripts npm

| Script | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | servidor de desenvolvimento / build / produção |
| `npm run lint` | ESLint, incluindo as fronteiras entre módulos |
| `npm run typecheck` | checagem de tipos |
| `npm test` | testes unitários |
| `npm run test:int` | testes de integração (sobe um Postgres no Docker sozinho) |
| `npm run test:e2e` | testes E2E com Playwright |
| `npm run db:generate` | gera uma migração a partir dos `schema.ts` |
| `npm run db:migrate` | aplica as migrações |
| `npm run db:studio` | abre o Drizzle Studio para ver o banco |
| `npm run seed:demo` | apaga e recria a Pizzaria Demo |
| `ADMIN_PASSWORD=… npm run admin:ensure -- <email> [nome]` | cria ou promove super-admin (a senha vai por variável de ambiente) |

---

## Testes e CI

| Tipo | Ferramenta | O que cobre |
|---|---|---|
| **Unitários** | Vitest | preços e meio a meio, taxas, horários (inclusive virada de meia-noite), status, mensagens do WhatsApp, períodos e métricas, rate limit, validações |
| **Integração** | Vitest + Postgres (Testcontainers) | criação de pedido (numeração, idempotência, concorrência), isolamento entre lojas, fila e transições, convites, histórico, métricas |
| **E2E** | Playwright | pedido completo com meio a meio, fila do painel, cardápio e esgotados, métricas e histórico, criação de loja pelo super-admin, convite do dono e modo suporte |

O **GitHub Actions** roda tudo em cada push e pull request (`.github/workflows/ci.yml`): lint, tipos, unitários, integração e E2E contra um build de produção.

Para rodar o E2E localmente, use `make e2e`. Ele já cria o super-admin de teste e recria a loja demo.

---

## Deploy e custos

O app roda na **Vercel**, com banco **Neon**, **Upstash**, **Vercel Blob** e **Sentry**, todos conectados pelo painel da Vercel. Cada push na `main` gera um deploy de produção, e **as migrações rodam sozinhas** antes do build (só em produção; os previews usam uma cópia separada do banco).

O passo a passo completo está em **[`docs/deploy.md`](docs/deploy.md)**: contas, variáveis de ambiente, primeiro super-admin, domínio e checklist de testes.

Variáveis obrigatórias em produção (o app se recusa a subir sem elas):

- `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL`;
- Upstash: `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` **ou** `KV_REST_API_URL`/`KV_REST_API_TOKEN` (nomes criados pela integração da Vercel);
- Blob: `BLOB_STORE_ID` (Blob **Public** conectado ao projeto) **ou** `BLOB_READ_WRITE_TOKEN`.

Recomendadas: `DATABASE_URL_UNPOOLED` (migrações pela conexão direta), `APP_URL`, `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN`. **Nunca** defina `E2E_DISABLE_RATE_LIMIT` em produção.

**Custos:** para demonstração, tudo cabe nos planos gratuitos. Para **vender**, a Vercel exige o plano **Pro** (US$ 20/mês, o Hobby não permite uso comercial), e o Neon gratuito tem 100 horas de computação por mês somadas entre todas as lojas. Detalhes e limites na seção 9 de [`docs/deploy.md`](docs/deploy.md).

---

## Segurança e LGPD

- **Senhas** com hash pelo Better Auth; **cadastro público desligado** (contas só por convite ou script).
- **Convites** de uso único, válidos por 7 dias; no banco fica só o hash do token. Trocar a senha encerra as sessões antigas.
- **Rate limit** em pedidos (10 a cada 10 min por IP e 5 por telefone), cotações, convites, uploads e login (5 tentativas por minuto).
- **Isolamento entre lojas** testado automaticamente; Server Actions validam login e entrada com Zod.
- **Upload** só de JPG, PNG ou WebP (verificados pelo conteúdo do arquivo), até 5 MB.
- **Modo suporte auditado:** todo "Acessar como loja" fica registrado, com quem, qual loja e quando.
- **LGPD:** a página de acompanhamento não mostra telefone nem endereço, e o cardápio tem link para a [política de privacidade](https://naquela-mesa.vercel.app/privacidade). A loja é a controladora dos dados dos seus clientes; a plataforma é a operadora.

---

## Estrutura de pastas

```
.
├── src/
│   ├── app/               rotas: [slug] (cardápio), painel, admin, convite, login, api
│   ├── modules/           domínio (ver Arquitetura)
│   └── shared/            env, banco, dinheiro, erros, rate limit, Sentry
├── drizzle/               migrações SQL geradas
├── scripts/               seed da demo, super-admin, dono, build da Vercel, limpeza do E2E
├── e2e/                   testes Playwright
├── tests/                 setup dos testes de integração e teste das fronteiras de módulo
├── docs/
│   ├── deploy.md          roteiro de deploy
│   └── superpowers/       spec do MVP e planos de cada fase
├── Makefile               atalhos (make help)
└── docker-compose.yml     Postgres local
```

---

## Próximos passos

**Antes de vender:**
- Domínio próprio (ex.: `naquelamesa.com.br`) e plano **Vercel Pro**.
- Testes de campo: impressora térmica de 80 mm, notificações no tablet e pedidos reais pelo celular.

**Melhorias técnicas anotadas:**
- Source maps no Sentry.
- Limpeza de imagens órfãs e cota de upload por loja.
- Busca e ordenação que ignorem acentos.
- Tempo médio de aceite e de preparo nas métricas.

**Roadmap de produto:**
- Bot de pedidos pelo WhatsApp (API oficial).
- Pix online.
- Cupons e agendamento.
- Vários usuários por loja.

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/superpowers/specs/2026-10-13-naquela-mesa-mvp-design.md`](docs/superpowers/specs/2026-10-13-naquela-mesa-mvp-design.md) | design completo do MVP: decisões, modelo de dados, fluxos, erros, segurança e fases |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | plano de implementação de cada fase (F0 a F6) |
| [`docs/deploy.md`](docs/deploy.md) | roteiro de deploy, variáveis, custos e checklist pós-deploy |
