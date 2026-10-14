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
3. *Build Command*: deixe em branco (a Vercel usa o script `vercel-build` sozinha: `drizzle-kit migrate && next build`).
4. Node 24 (vem do `.nvmrc`).

As migrações rodam antes de cada build, inclusive em preview (contra o banco de preview). A migração usa `DATABASE_URL_UNPOOLED` quando existir, nunca o pooler.

## 3. Variáveis de ambiente

| Variável | Ambiente | Origem |
|---|---|---|
| `DATABASE_URL` | Production e Preview | Neon (integração) |
| `DATABASE_URL_UNPOOLED` | Production e Preview | Neon (integração); conexão direta, usada nas migrações |
| `DATABASE_POOL_MAX` | Production e Preview | você define: `3` |
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
2. A Vercel roda as migrações e o build.
3. Confira no log do build a mensagem "migrations applied".

## 5. Primeiro super-admin

Da máquina local, apontando para o banco de produção (a senha vai por variável de ambiente, nunca como argumento):

```bash
 DATABASE_URL="<url direta do Neon>" ADMIN_PASSWORD="<senha forte>" npm run admin:ensure -- voce@exemplo.com "Seu Nome"
```

O espaço antes do comando evita que a senha fique no histórico do shell (bash/zsh com `HIST_IGNORE_SPACE`/`HISTCONTROL=ignorespace`).

## 6. Domínio

1. Em *Settings → Domains*, adicione o domínio.
2. No registrador, configure o DNS como a Vercel mostrar: registro A `76.76.21.21` para o domínio raiz e CNAME `cname.vercel-dns.com` para `www`.
3. Atualize `BETTER_AUTH_URL` e `APP_URL` para o domínio final e faça *Redeploy*.

## 7. Loja de demonstração em produção (opcional)

`seed:demo` recusa `NODE_ENV=production`. Para uma demo, rode da máquina local com a `DATABASE_URL` do Neon e `NODE_ENV` não definido. Ele **apaga e recria** a loja `pizzaria-demo` e nada mais.

## 8. Checklist de fumaça

- [ ] Cardápio abre no celular por HTTPS.
- [ ] Pedido completo, com envio no WhatsApp.
- [ ] Painel: "Iniciar atendimento" (precisa clicar de novo a cada recarga da página), alerta sonoro, notificação do navegador (só funciona em HTTPS) e tela que não apaga (Wake Lock, só HTTPS).
- [ ] Impressão em térmica 80 mm. Chrome com `--kiosk-printing` imprime sem diálogo: atalho do Windows com `chrome.exe --kiosk-printing https://<domínio>/painel`.
- [ ] Convite de dono e "Acessar como loja".
- [ ] 11 pedidos seguidos do mesmo celular: aparece "Muitas tentativas…".
- [ ] Upload de logo vai para o Blob (URL `*.public.blob.vercel-storage.com`).
- [ ] Erro de teste aparece no Sentry.

## 9. Custos e limites

- Planos gratuitos: Neon 0,5 GB, Upstash 10 mil comandos/dia, Blob 1 GB.
- O painel consulta a fila a cada 5 s por aparelho aberto: ~17 mil requisições/dia por tablet ligado 24 h.
- Migre de plano quando chegar perto desses limites (banco cheio, comandos do Upstash acabando ou Blob quase em 1 GB).

## 10. Notas de operação

- **Limite por IP:** usa o primeiro item de `x-forwarded-for`. Na Vercel isso é seguro (a Vercel sobrescreve o cabeçalho); atrás de outro proxy ou em hospedagem própria seria falsificável.
- **Upstash fora do ar:** `@upstash/ratelimit` deixa a requisição passar após o timeout (disponibilidade acima de rigor).
- **Tamanho de corpo:** funções da Vercel aceitam corpos de até ~4,5 MB. O painel redimensiona imagens para no máximo 1200 px em WebP antes de enviar; só se bate nesse limite se o navegador não conseguir redimensionar (aparece um erro genérico).
- **Upload:** imagens vão para o Vercel Blob. Limpeza de órfãs e cota por loja ainda não existem.
