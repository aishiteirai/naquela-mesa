# Roteiro de deploy (Vercel)

Tudo no plano gratuito. Nenhum segredo real deve ser colocado neste arquivo nem no repositório.

## 1. Contas

1. **GitHub**: o repositório `aishiteirai/naquela-mesa` já existe.
2. **Vercel**: entre com o GitHub.
3. **Neon** (Postgres) e **Upstash** (Redis): crie pela aba **Integrations / Marketplace** da Vercel; a integração já cria as variáveis de ambiente.
4. **Vercel Blob**: aba **Storage** do projeto.
5. **Sentry**: crie um projeto do tipo "Next.js".

## 2. Criar o projeto na Vercel

1. Importe `aishiteirai/naquela-mesa`.
2. Framework: Next.js.
3. *Build Command*: deixe em branco (a Vercel usa o script `vercel-build` sozinha: `node scripts/vercel-build.mjs`).
4. Node 24 vem de `engines.node` no `package.json` (a Vercel ignora o `.nvmrc`).

O script `vercel-build` roda `drizzle-kit migrate` **somente** quando `VERCEL_ENV=production` ou `MIGRATE_ON_BUILD=1`; nos demais casos registra "migrations skipped (preview)" e roda só `next build`. A migração usa `DATABASE_URL_UNPOOLED` quando existir, nunca o pooler.

**O Preview NÃO pode compartilhar o banco de produção.** Escolha uma opção:

- **(a)** Dê ao Preview seu próprio branch/banco no Neon (`DATABASE_URL` e `DATABASE_URL_UNPOOLED` com escopo Preview) e defina `MIGRATE_ON_BUILD=1` no Preview: as migrações rodam contra o banco de preview.
- **(b)** Deixe o Preview sem migrações (sem `MIGRATE_ON_BUILD`): ele roda contra o esquema que o banco dele já tiver.

## 3. Variáveis de ambiente

| Variável | Ambiente | Origem |
|---|---|---|
| `DATABASE_URL` | Production: banco de produção. Preview: banco/branch **próprio** do Preview | Neon (integração); nunca o mesmo valor nos dois ambientes |
| `DATABASE_URL_UNPOOLED` | Production: banco de produção. Preview: branch próprio (só na opção a) | Neon (integração); conexão direta, usada nas migrações |
| `MIGRATE_ON_BUILD` | Preview (só na opção a) | você define: `1` (em Production as migrações já rodam sozinhas) |
| `DATABASE_POOL_MAX` | Production e Preview | opcional; padrão `3` quando `VERCEL_ENV` existe, `10` fora da Vercel |
| `BETTER_AUTH_SECRET` | Production e Preview | `openssl rand -base64 32`; use um valor diferente no Preview |
| `BETTER_AUTH_URL` | Production | domínio final (ex.: `https://naquelamesa.com.br`) |
| `APP_URL` | Production | domínio final |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Preview | URL de preview, separadas por vírgula |
| `UPSTASH_REDIS_REST_URL` | Production e Preview | Upstash (integração) |
| `UPSTASH_REDIS_REST_TOKEN` | Production e Preview | Upstash (integração) |
| `BLOB_READ_WRITE_TOKEN` | Production e Preview | Vercel Blob (aba Storage) |
| `SENTRY_DSN` | Production e Preview | Sentry (servidor) |
| `NEXT_PUBLIC_SENTRY_DSN` | Production e Preview | Sentry (navegador; normalmente o mesmo DSN) |

Em Preview, `BETTER_AUTH_URL` também é obrigatória pelo app; use a URL do preview.

**Aviso:** **nunca** defina `E2E_DISABLE_RATE_LIMIT` na Vercel. Com `VERCEL_ENV=production`, o app se recusa a subir se ela existir, ou se faltarem `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` ou `BLOB_READ_WRITE_TOKEN`.

O Sentry só é carregado quando `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` estão definidas. Para o ambiente do Sentry aparecer correto em preview, ative **"Automatically expose System Environment Variables"** na Vercel (para `NEXT_PUBLIC_VERCEL_ENV`).

## 4. Primeiro deploy

1. Faça push na `main`.
2. A Vercel roda as migrações (só em produção) e o build.
3. Confira no log do build a mensagem "migrations applied".

## 5. Primeiro super-admin

Da máquina local, apontando para o banco de produção (a senha vai por variável de ambiente, nunca como argumento):

```bash
 DATABASE_URL="<url direta do Neon>" BETTER_AUTH_SECRET="<qualquer valor com 32+ caracteres>" BETTER_AUTH_URL="https://<seu-domínio>" ADMIN_PASSWORD="<senha forte>" npm run admin:ensure -- voce@exemplo.com "Seu Nome"
```

Rodar `admin:ensure` de novo para um e-mail que já existe **redefine a senha** dele (e o promove a super-admin).

O script carrega o cliente do banco, que valida o ambiente e exige `BETTER_AUTH_SECRET` (32+ caracteres) e `BETTER_AUTH_URL`; por isso vão no comando (o valor do secret não precisa ser o de produção). O espaço antes do comando evita que a senha fique no histórico do shell (bash/zsh com `HIST_IGNORE_SPACE`/`HISTCONTROL=ignorespace`).

## 6. Domínio

1. Em *Settings → Domains*, adicione o domínio.
2. No registrador, configure o DNS como a Vercel mostrar: registro A `76.76.21.21` para o domínio raiz e CNAME `cname.vercel-dns.com` para `www`.
3. Atualize `BETTER_AUTH_URL` e `APP_URL` para o domínio final e faça *Redeploy*.

## 7. Loja de demonstração em produção (opcional)

`seed:demo` recusa `NODE_ENV=production`. Para uma demo, rode da máquina local, com `NODE_ENV` não definido, assim (o espaço inicial evita histórico; `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL` são exigidos pela validação de ambiente):

```bash
 DATABASE_URL="<url direta do Neon>" BETTER_AUTH_SECRET="<qualquer valor com 32+ caracteres>" BETTER_AUTH_URL="https://<seu-domínio>" npm run seed:demo
```

Ele **apaga e recria** a loja `pizzaria-demo` e nada mais.

## 8. Checklist de fumaça

- [ ] Cardápio abre no celular por HTTPS.
- [ ] Pedido completo, com envio no WhatsApp.
- [ ] Painel: "Iniciar atendimento" (precisa clicar de novo a cada recarga da página), alerta sonoro, notificação do navegador (só funciona em HTTPS) e tela que não apaga (Wake Lock, só HTTPS).
- [ ] Impressão em térmica 80 mm. Chrome com `--kiosk-printing` imprime sem diálogo: atalho do Windows com `chrome.exe --kiosk-printing https://<domínio>/painel`.
- [ ] Convite de dono e "Acessar como loja".
- [ ] Limite por telefone (faça **primeiro**): 6 pedidos com o mesmo telefone; o 6º mostra "Muitas tentativas…".
- [ ] Limite por IP (só depois): aguarde 10 minutos (ou use outra rede) e faça 11 pedidos seguidos com telefones diferentes; o 11º mostra "Muitas tentativas…". Sem a espera, o limite por IP já pode ter sido atingido pelos testes anteriores e o resultado seria um falso positivo.

**Atenção:** esses testes criam pedidos reais na loja. Cancele-os no painel depois (use a loja de demonstração, se existir).

- [ ] Upload de logo vai para o Blob (URL `*.public.blob.vercel-storage.com`).
- [ ] Erro de teste aparece no Sentry.

## 9. Custos e limites

- Planos gratuitos: Neon 0,5 GB, Upstash 10 mil comandos/dia, Blob 1 GB.
- O painel consulta a fila a cada 5 s por aparelho aberto: ~17 mil requisições/dia por tablet ligado 24 h.
- Migre de plano quando chegar perto desses limites (banco cheio, comandos do Upstash acabando ou Blob quase em 1 GB).

## 10. Notas de operação

- **Guarda de produção:** as exigências (Upstash, Blob, sem `E2E_DISABLE_RATE_LIMIT`) dependem de `VERCEL_ENV`, que só existe na Vercel; em hospedagem própria seria preciso definir as mesmas variáveis manualmente.
- **Migração 0012 (CHECKs):** falha se um banco já existente tiver linhas de pedido inválidas (produção nova não é afetada).
- **Limite por IP:** pode afetar muitos clientes atrás da mesma rede (CGNAT / Wi-Fi compartilhado); aceitável no MVP. Usa o primeiro item de `x-forwarded-for`. Na Vercel isso é seguro (a Vercel sobrescreve o cabeçalho); atrás de outro proxy ou em hospedagem própria seria falsificável.
- **Upstash lento ou fora do ar:** as requisições passam (limite temporariamente desligado) e o erro é registrado em log ("rate limit indisponível"). Disponibilidade acima de rigor.
- **Tamanho de corpo:** funções da Vercel aceitam corpos de até ~4,5 MB. O painel redimensiona imagens para no máximo 1200 px em WebP antes de enviar; só se bate nesse limite se o navegador não conseguir redimensionar (aparece um erro genérico).
- **Upload:** imagens vão para o Vercel Blob. Limpeza de órfãs e cota por loja ainda não existem.
