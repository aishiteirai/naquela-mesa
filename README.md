# Naquela Mesa

Cardápio digital e pedidos para restaurantes da região.

- Spec do MVP: `docs/superpowers/specs/2026-10-13-naquela-mesa-mvp-design.md`
- Planos: `docs/superpowers/plans/`

## Requisitos

- Node 24+ (`.nvmrc`)
- Docker (Postgres local e testes de integração)

## Comandos rápidos (Makefile)

```bash
make setup      # primeira vez: dependências, .env.local, Postgres, migrações e loja demo
make dev        # sobe o Postgres, migra e roda o servidor em http://localhost:3000
make update     # depois de mudanças no repositório: git pull, dependências, migrações e demo
make test       # lint, tipos, testes unitários e de integração
make e2e        # build + testes E2E (Playwright)
make check      # tudo o que o CI roda
make help       # lista todos os comandos
```

Use `PORT=3001` em qualquer comando para outra porta (ex.: `make dev PORT=3001`). Criar usuários: `make admin EMAIL=... SENHA=...` e `make owner SLUG=... EMAIL=... SENHA=...`.

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

## Pedido do cliente

- Cardápio: `/<slug>` → botão "Adicionar" em cada produto (tamanho, meio a meio, adicionais).
- Sacola e checkout: `/<slug>/sacola` (delivery, retirada ou mesa; dinheiro, cartão na entrega ou Pix).
- Depois de confirmar: botão "Enviar pedido no WhatsApp" (mensagem completa para a loja) e link de acompanhamento `/<slug>/pedido/<token>`.
- O preço é sempre recalculado no servidor; o total do navegador é só estimativa.

## Fila de pedidos (painel)

- `/painel` mostra os pedidos por status (Novos, Em preparo, Prontos e em entrega, Finalizados nas últimas 24 h) e se atualiza sozinho a cada 5 s.
- Clique em **Iniciar atendimento** para ligar o alerta sonoro (exigência dos navegadores) e manter a tela acesa.
- Cada pedido: avançar status, cancelar (com motivo), **Avisar cliente** (WhatsApp com o status) e **Imprimir comanda** (80 mm). Em Loja → "Imprimir comanda ao aceitar" abre a comanda automaticamente ao aceitar.
- Dica para impressão sem diálogo: abra o Chrome com `--kiosk-printing` e defina a térmica como impressora padrão.

## Histórico e métricas (painel)

- `/painel/pedidos`: histórico com período (hoje, 7 dias, 30 dias ou personalizado), status e busca por número, nome ou telefone; 50 por página. Cada pedido abre o detalhe e o link da comanda.
- `/painel/metricas`: faturamento, pedidos, ticket médio e cancelamentos, top 10 produtos (pizza conta por sabor; meio a meio vale ½), pedidos por hora, por tipo e por canal.
- Datas e horas seguem o fuso da loja. Faturamento e gráficos ignoram pedidos cancelados.
- `npm run seed:demo` (ou `make setup`/`make update`) gera ~30 dias de pedidos fictícios na Pizzaria Demo, todos com mais de 24 h, para a demonstração das métricas.

## Super-admin (`/admin`)

- Crie o primeiro super-admin com `make admin EMAIL=voce@exemplo.com SENHA=...`.
- **Nova loja:** nome, endereço (slug), WhatsApp, email do dono e modelo de cardápio (Pizzaria, Hamburgueria ou Lanchonete). O cardápio do modelo já vem cadastrado; o dono ajusta preços e itens.
- **Link de acesso:** aparece na tela depois de criar a loja. Copie e envie ao dono pelo WhatsApp. Vale por 7 dias e uma vez só. O dono define a senha e cai direto no painel. Se o email já tem conta, a loja é vinculada a ela sem link.
- **Esqueceu a senha:** em "Lojas", "Gerar link de acesso" cria um link novo (o anterior deixa de valer); o dono define uma nova senha por ele.
- **Acessar como loja:** abre o painel da loja como se fosse o dono, com a faixa "Modo suporte". Entrada e saída ficam em "Registro de suporte".
- **Primeiros passos:** o painel da loja mostra o que falta configurar (logo, horários, entrega, Pix, cardápio) até tudo estar feito.
