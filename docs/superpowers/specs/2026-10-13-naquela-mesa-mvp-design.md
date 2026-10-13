# Naquela Mesa — Design do MVP

- **Data:** 2026-10-13
- **Status:** aguardando revisão
- **Repositório:** https://github.com/aishiteirai/naquela-mesa

## 1. Contexto e objetivo

Serviço de cardápio virtual com pedidos para pequenos restaurantes, pizzarias e lanchonetes da região (estilo Beefood / Anota AI / Goomer). Ainda não há clientes: o MVP existe para **demonstrar e fechar os primeiros restaurantes**.

### Critérios de sucesso do MVP

1. Cliente final abre o link da loja no celular, monta o pedido (incluindo pizza meio a meio e adicionais) e finaliza.
2. O pedido aparece em tempo quase real no painel da loja, com alerta sonoro, e pode ser impresso em impressora térmica 80mm.
3. O cliente consegue enviar o pedido formatado para o WhatsApp da loja e acompanhar o status por link.
4. O dono altera sozinho cardápio, preços, disponibilidade, horários, taxas, formas de pagamento e aparência.
5. O dono vê métricas básicas de vendas.
6. Um restaurante novo entra no ar em **menos de 30 minutos** a partir de um template.

### Premissas

- Multi-tenant desde o início: uma instalação atende várias lojas, cada uma em `/{slug}`.
- Desenvolvedor solo; prioridade para stack simples e custo de infraestrutura próximo de zero.
- Layout do cardápio é único e padronizado; personalização é por configuração, sem código por cliente.

### Fora do escopo do MVP (roadmap, cada item com spec própria)

1. Bot de pedidos via WhatsApp Cloud API (prioridade pós-MVP).
2. Pix online via gateway.
3. Cupons.
4. Agendamento de pedidos.
5. Taxa de entrega por distância (geocoding).
6. Multiusuário por loja (atendente com permissões).
7. Subdomínio / domínio próprio por loja.
8. Tempo real com push (substituir polling).
9. Layouts alternativos de cardápio.

## 2. Decisões principais

| Tema | Decisão | Motivo |
|---|---|---|
| Arquitetura | Monólito modular em Next.js | Modularidade no código sem overhead de infra; adequado para dev solo |
| Personalização | Visual + funcionalidades on/off + regras de negócio, via painel | Sem código por cliente; onboarding rápido |
| WhatsApp | Link `wa.me` com pedido pré-formatado, atrás de `WhatsAppProvider` | Custo zero, sem risco de banimento; Cloud API pluga depois |
| Pagamento | Offline (dinheiro com troco, cartão na entrega, Pix na chave), atrás de `PaymentProvider` | Como as pizzarias já trabalham; gateway pluga depois |
| Taxa de entrega | Fixa e por bairro; `by_distance` só com interface | Geocoding tem custo/qualidade ruim; bairro cobre a maioria |
| Tempo real | Polling (5s no painel) | Simples, funciona na Vercel; troca isolada em um módulo |
| Tenancy | Banco compartilhado, coluna `store_id` | Simples; isolamento centralizado e testado |

## 3. Stack

- **Next.js 15** (App Router), TypeScript `strict`. Server Actions + Route Handlers como backend.
- **Postgres** (Neon) + **Drizzle ORM**, migrations versionadas.
- **Better Auth**: email + senha, sessão no banco. Papéis: `store_owner` (via `store_members`) e `super_admin`.
- **Zod** para validação de toda entrada e dos `jsonb` de configuração.
- **Tailwind** + **shadcn/ui**; tema da loja aplicado via CSS variables.
- **Vercel Blob** para imagens.
- **Upstash Redis** para rate limit.
- **Sentry** para erros.
- **Vitest** (unit + integração com Postgres em Docker), **Playwright** (E2E).
- Hospedagem: **Vercel** + **Neon**.
- Dinheiro sempre **inteiro em centavos** (`*_cents`); nunca float.
- Timestamps em UTC no banco; cálculo e exibição no `timezone` da loja.

## 4. Estrutura de módulos

```
src/
  app/                      # rotas finas: UI + chamada de serviço
    [slug]/                 # cardápio público
    [slug]/pedido/[token]/  # acompanhamento do pedido
    painel/                 # painel do lojista
    admin/                  # super-admin
    api/                    # route handlers (polling, futuros webhooks)
  modules/
    stores/      # loja, tema, horários, features, regras, status aberto/fechado
    catalog/     # categorias, tamanhos, produtos, preços, grupos de adicionais
    orders/      # criação, precificação, máquina de status
    delivery/    # DeliveryFeeStrategy
    payments/    # PaymentProvider (OfflinePaymentProvider)
    whatsapp/    # WhatsAppProvider (WaMeLinkProvider)
    metrics/     # agregações
    auth/        # sessão, papéis, requireStoreAccess
    admin/       # criação de loja, templates, auditoria
  shared/        # db client, money, DomainError, utilidades
```

### Regras

1. Cada módulo expõe apenas `index.ts` (API pública). Internos livres (`service.ts`, `repo.ts`, `schema.ts`, `types.ts`, testes).
2. Módulos importam outros módulos somente via `index.ts` — garantido por `eslint-plugin-boundaries`; lint falha caso contrário.
3. `app/` nunca acessa o banco diretamente; só chama serviços.
4. Todo serviço recebe `storeId` explícito; todo repo filtra por `store_id`.
5. Preço é sempre calculado no servidor. O cliente envia apenas IDs, quantidades e observações.

### Pontos de extensão

| Interface | Implementação MVP | Futuro |
|---|---|---|
| `WhatsAppProvider` | `WaMeLinkProvider` (`buildOrderLink`, `buildStatusLink`) | `CloudApiProvider` (envio automático + bot) |
| `PaymentProvider` | `OfflinePaymentProvider` | `PixGatewayProvider` |
| `DeliveryFeeStrategy` | `fixed`, `by_neighborhood` | `by_distance` |
| `OrderService.create(input, channel)` | `channel = 'web'` | `channel = 'whatsapp'` (bot) |

## 5. Modelo de dados

Todas as tabelas de tenant possuem `store_id` indexado.

### Loja e configuração

```
stores
  id, slug (unique), name, whatsapp_phone (E.164), address, lat, lng,
  logo_url, banner_url, timezone (default 'America/Sao_Paulo'),
  order_seq int default 0,
  theme jsonb           { primary: '#RRGGBB', secondary: '#RRGGBB', font }
  features jsonb        { delivery, pickup, dine_in, half_and_half, addons,
                          coupons (false, pós-MVP), scheduling (false, pós-MVP) }
  rules jsonb           { min_order_cents, prep_time_min, delivery_time_min,
                          half_price_rule: 'highest' | 'average',
                          auto_print_on_accept: boolean,
                          delivery_fee: { strategy: 'fixed' | 'by_neighborhood' | 'by_distance',
                                          fixed_cents? } }
  payment_methods jsonb { cash, card_on_delivery, pix_key? }
  manual_status         'auto' | 'force_open' | 'force_closed'
  created_at, updated_at

store_hours     id, store_id, weekday (0-6), opens_at (time), closes_at (time)
                -- vários turnos por dia; closes_at < opens_at = vira a meia-noite
delivery_zones  id, store_id, neighborhood, fee_cents
delivery_tiers  id, store_id, max_km, fee_cents       -- pós-MVP (by_distance)
```

Os campos `jsonb` têm schema Zod; novas flags não exigem migration.

### Usuários e auditoria

```
users, sessions, accounts, verifications   -- Better Auth; users.role: 'user' | 'super_admin'
store_members   user_id, store_id, role ('owner')
audit_logs      id, actor_user_id, store_id, action, metadata jsonb, created_at
```

### Cardápio

```
categories            id, store_id, name, position, active
category_sizes        id, store_id, category_id, name ('Broto','Média','Grande'),
                      max_flavors (1|2), position
products              id, store_id, category_id, name, description, image_url,
                      price_cents (null quando a categoria tem tamanhos),
                      allows_half, active, available, position
product_size_prices   product_id, category_size_id, price_cents
option_groups         id, store_id, name ('Borda','Adicionais'), min, max, position
options               id, store_id, group_id, name, price_cents, available, position
product_option_groups product_id, group_id
```

- `active = false` funciona como soft delete; `available = false` significa esgotado.
- **Meio a meio:** o cliente escolhe um `category_size` e até `max_flavors` produtos da mesma categoria com `allows_half`. O preço de cada sabor vem de `product_size_prices`; aplica-se `half_price_rule` (`highest` = sabor mais caro, padrão; `average` = média, arredondada para cima ao centavo).

### Pedidos

```
orders
  id (uuid), store_id, number (int, sequencial por loja), public_token (128 bits, unique),
  idempotency_key (unique por store_id),
  channel ('web' | 'whatsapp'),
  status ('received' | 'preparing' | 'out_for_delivery' | 'ready' | 'completed' | 'cancelled'),
  fulfillment ('delivery' | 'pickup' | 'dine_in'),
  customer_name, customer_phone (E.164), address jsonb, table_label,
  payment_method ('cash' | 'card_on_delivery' | 'pix'), change_for_cents,
  notes, cancel_reason,
  subtotal_cents, delivery_fee_cents, discount_cents (0 no MVP), total_cents,
  created_at, updated_at

order_items          id, order_id, product_name, size_name, flavors jsonb,
                     quantity, unit_price_cents, total_cents, notes
order_item_options   id, order_item_id, group_name, option_name, price_cents
order_status_events  id, order_id, status, at, by_user_id
```

- Itens do pedido guardam **cópia** de nomes e preços; alterações no cardápio não afetam histórico nem métricas.
- Acompanhamento usa `public_token`, nunca `id` ou `number`.
- Métricas são SQL agregado sobre `orders` / `order_items`; sem tabela própria no MVP.

## 6. Fluxo do pedido (cliente)

1. **Cardápio `/{slug}`**: renderizado no servidor com cache, revalidado quando o lojista edita. Status aberto/fechado calculado por `isStoreOpen(store, hours, now)`. Loja fechada: navegação permitida, checkout bloqueado com "Abre hoje às HH:MM". Itens esgotados exibidos desabilitados.
2. **Carrinho**: client-side, `localStorage` por `slug`, guarda apenas IDs, quantidades e observações. Modal do item: tamanho, sabores, adicionais (validação de min/max por grupo), observação.
3. **Checkout**: tipo de pedido (somente os habilitados), nome, telefone (normalizado para E.164), endereço com autocompletar por CEP (ViaCEP) e select de bairro quando a estratégia é `by_neighborhood`, mesa quando `dine_in`, forma de pagamento (somente as aceitas), troco para dinheiro, chave Pix exibida quando aplicável.
4. **Cotação**: Server Action `quoteOrder` recalcula tudo no servidor e retorna subtotal, taxa, total e itens inválidos. Divergências são mostradas e o carrinho é atualizado.
5. **Criação**: `OrderService.create(input, 'web')`, sendo `input` = `{ storeId, idempotencyKey, expectedTotalCents, items: ItemInput[], customer, fulfillment, payment }`:
   - `ItemInput` sem tamanho: `{ productId, optionIds, quantity, notes }`.
   - `ItemInput` com tamanho: `{ sizeId, flavorIds (1..max_flavors; 1 sabor = pizza inteira), optionIds, quantity, notes }`.

   1. Validação Zod.
   2. Loja aberta? Tipo de pedido e pagamento habilitados?
   3. Carrega produtos, tamanhos e opções filtrando por `store_id`; verifica `active` e `available`.
   4. `PricingService` (função pura) calcula itens e subtotal.
   5. `DeliveryFeeStrategy` calcula a taxa; verifica pedido mínimo.
   6. Se `total ≠ expectedTotalCents` → `PRICE_CHANGED`.
   7. Transação: `UPDATE stores SET order_seq = order_seq + 1 WHERE id = $1 RETURNING order_seq`; insere pedido, itens, opções e evento `received`.
   8. Se `idempotency_key` já existe para a loja, retorna o pedido existente.
   9. Retorna `{ orderId, number, publicToken }`.
6. **Após criar**: redireciona para `/{slug}/pedido/{public_token}`. Página mostra status (polling 10s) e botão **"Enviar pedido no WhatsApp"** gerado por `WhatsAppProvider.buildOrderLink(order)` → `https://wa.me/<loja>?text=<mensagem codificada>` com número, itens, sabores, adicionais, endereço, pagamento, troco, total e link de acompanhamento. O pedido já está no painel independentemente do envio.

## 7. Painel do lojista

### Máquina de status

```
delivery: received → preparing → out_for_delivery → completed
pickup:   received → preparing → ready            → completed
dine_in:  received → preparing → ready            → completed
cancelled: a partir de qualquer estado não-final, motivo obrigatório
```

`received` = aguardando aceite; **Aceitar** → `preparing`. Transições validadas no servidor com `UPDATE ... WHERE status = <esperado>`; cada transição gera `order_status_events`.

### Fila de pedidos `/painel`

- Kanban por status (desktop/tablet); lista com abas (celular).
- Polling a cada 5s: `GET /api/painel/orders?since=<cursor>` retorna apenas mudanças.
- Pedido novo: som em loop até ser aberto, título da aba "(N) Novo pedido", notificação do navegador se permitida.
- Botão **"Iniciar atendimento"** ao abrir o painel: desbloqueia áudio e ativa Wake Lock.
- Card do pedido: itens, endereço/mesa, pagamento/troco, avançar status, cancelar, imprimir.
- **"Avisar cliente"**: `WhatsAppProvider.buildStatusLink(order)` abre `wa.me` para o telefone do cliente com mensagem do status atual.

### Impressão

- `/painel/pedidos/{id}/imprimir` com CSS `@page { size: 80mm auto }` e `window.print()`.
- Opção `auto_print_on_accept`.
- Documentar Chrome `--kiosk-printing` para impressão silenciosa.
- Comanda: número, horário, tipo, cliente, endereço/mesa, itens com sabores e adicionais, observações, pagamento, troco, total.

### Cardápio `/painel/cardapio`

- CRUD de categorias (reordenação por arrastar), tamanhos por categoria, produtos com preço por tamanho, grupos de adicionais reutilizáveis.
- Tela **"Disponibilidade"**: lista com switches para marcar esgotado rapidamente.
- Upload de imagem com redimensionamento/compressão no navegador antes do envio ao Blob.

### Configurações `/painel/loja`

- **Aparência**: logo, banner, cores com preview ao vivo e alerta de contraste.
- **Funcionamento**: horários por dia (vários turnos), botões "Fechar agora" / "Abrir agora" / "Automático".
- **Entrega**: tipos habilitados, estratégia de taxa, bairros e valores.
- **Pagamento**: métodos aceitos, chave Pix.
- **Regras**: pedido mínimo, tempos, regra do meio a meio, impressão automática.

### Métricas `/painel/metricas`

- Período: hoje, 7 dias, 30 dias, personalizado (fuso da loja).
- Indicadores: faturamento e ticket médio (todos os pedidos exceto `cancelled`), nº de pedidos, nº de cancelamentos.
- Gráficos: top 10 produtos, pedidos por hora do dia, distribuição por tipo de pedido e por canal.

### Super-admin `/admin`

- Lista e criação de lojas (nome, slug, WhatsApp, email do dono); convite por link para o dono definir senha.
- **Templates de cardápio**: Pizzaria, Hamburgueria, Lanchonete (categorias, tamanhos, adicionais comuns).
- **Checklist de onboarding** no painel da loja: logo, horários, bairros, pagamento, cardápio.
- **"Acessar como loja"** para suporte, registrado em `audit_logs`.

## 8. Erros

Serviços lançam `DomainError { code, details }`; a UI traduz para português. Erros inesperados vão ao Sentry e exibem mensagem genérica.

| code | Situação | Comportamento |
|---|---|---|
| `STORE_CLOSED` | loja fechada no momento da criação | mensagem com próximo horário de abertura |
| `ITEM_UNAVAILABLE` | item/opção esgotado ou inativo | item marcado no carrinho para remoção |
| `PRICE_CHANGED` | total recalculado ≠ `expectedTotalCents` | exibe novos valores e pede nova confirmação |
| `BELOW_MIN_ORDER` | subtotal < pedido mínimo | mensagem com valor mínimo |
| `ZONE_NOT_SERVED` | bairro não atendido | sugere retirada |
| `INVALID_OPTIONS` | grupo fora de min/max, sabores demais, sabor de outra categoria | erro no modal do item |
| `FULFILLMENT_DISABLED` | tipo de pedido desabilitado | checkout atualizado |
| `PAYMENT_DISABLED` | forma de pagamento desabilitada | checkout atualizado |
| `INVALID_TRANSITION` | transição de status inválida ou conflito | painel recarrega o pedido |
| `RATE_LIMITED` | excesso de pedidos/logins | mensagem para tentar mais tarde |

## 9. Segurança e LGPD

- **Isolamento**: `storeId` do painel vem sempre da sessão via `requireStoreAccess(session)`, nunca de parâmetro do cliente. Teste automatizado garante que loja A não lê nem altera dados da loja B.
- **Server Actions** são endpoints públicos: cada uma valida autenticação e entrada com Zod.
- **Rate limit** (Upstash): criação de pedido por IP e por telefone; login por IP/email. Campo honeypot no checkout.
- **Tema**: cores validadas como `#RRGGBB` antes de virarem CSS variables.
- **Upload**: apenas `image/jpeg`, `image/png`, `image/webp`, máximo 5MB.
- **`wa.me`**: texto sempre com `encodeURIComponent`.
- **Senhas**: hash pelo Better Auth.
- **Auditoria**: "Acessar como loja" registrado.
- **LGPD**: página de acompanhamento exibe apenas primeiro nome, status, itens e total; token de 128 bits; política de privacidade no rodapé do cardápio; a loja é controladora dos dados do cliente final e a plataforma é operadora.

## 10. Casos de borda

- Pedido perto do fechamento: vale o horário da criação.
- Turno que vira a meia-noite (ex.: 18:00–00:30): tratado e testado em `isStoreOpen`.
- Carrinho antigo no `localStorage`: revalidado na cotação.
- Produto removido: soft delete; pedidos antigos preservados por cópia.
- Dois aparelhos no painel: conflito de status resolvido por `UPDATE ... WHERE status = <esperado>`.
- Painel sem conexão: faixa "Sem conexão — tentando reconectar", backoff exponencial; ações com falha permitem retry.
- Cliente não envia mensagem no WhatsApp: pedido já está no painel.

## 11. Testes

- **Unitários (Vitest, TDD)**: `PricingService`, `DeliveryFeeStrategy`, `isStoreOpen`, máquina de status, builders de mensagem `wa.me` (snapshot), schemas Zod.
- **Integração (Vitest + Postgres em Docker)**: `OrderService.create` (transação, idempotência, numeração sem colisão sob concorrência), isolamento entre lojas em todos os serviços, conflito de status.
- **E2E (Playwright)**:
  1. Cliente monta pizza meio a meio com borda, delivery, finaliza.
  2. Pedido aparece no painel, é aceito, avança status; acompanhamento reflete.
  3. Lojista marca item esgotado; cardápio reflete.
  4. Super-admin cria loja a partir de template; loja fica acessível.
- **CI (GitHub Actions)** em cada PR: lint (inclui fronteiras), typecheck, unit, integração, E2E.
- **Seed**: loja "Pizzaria Demo" completa (cardápio, imagens, horários, bairros, pedidos fictícios) para desenvolvimento e demonstração de vendas.

## 12. Fases de entrega

| Fase | Entrega |
|---|---|
| **F0 Fundação** | Next.js, Drizzle + Neon, Better Auth, CI, lint de fronteiras, estrutura `modules/`, `shared/` |
| **F1 Cardápio público** | `stores` + `catalog` (leitura), tema, horários, `/{slug}` com seed |
| **F2 Gestão do cardápio e loja** | CRUD do cardápio, tamanhos, adicionais, disponibilidade, configurações, upload |
| **F3 Pedido** | carrinho, checkout, `PricingService`, taxa, `OrderService`, acompanhamento, `wa.me` |
| **F4 Fila de pedidos** | polling, alerta sonoro, status, impressão 80mm, "Avisar cliente" |
| **F5 Métricas** | indicadores e gráficos por período |
| **F6 Super-admin e lançamento** | criação de loja, templates, checklist, "Acessar como loja", deploy, domínio |

Marco de demonstração: fim da F3. Pronto para prospecção: fim da F6.
