# Reforma do frontend — Cardápio público

- **Data:** 2026-10-15
- **Status:** aguardando revisão
- **Branch:** `frontend-shadcn`
- **Depende de:** `docs/superpowers/specs/2026-10-15-frontend-fundacao-design.md` (concluída)

## 1. Contexto e objetivo

Subprojeto 2 de 4 da reforma do frontend. Refaz com shadcn/ui as telas públicas da loja: cardápio (`/[slug]`), item, sacola/checkout (`/[slug]/sacola`) e acompanhamento (`/[slug]/pedido/[token]`), além do rodapé e da página "Loja não encontrada".

Dores que motivam: visual amador e cardápio sem identidade da loja. O resultado deve parecer um app de delivery profissional com a marca da loja (cor, fonte, logo, capa).

**Sem mudança de regra de negócio:** cálculo de preço (`priceItem`), sacola (`cart-context`, `cart-storage`), `quote` e `placeOrder` do servidor, idempotência e honeypot continuam como estão. A única mudança de dados é de leitura: o acompanhamento passa a receber `logoUrl` e `theme` da loja.

## 2. Decisões tomadas

- Base visual neutra (Fundação); cardápio sempre claro.
- **Topo com foto de capa:** reaproveita o `bannerUrl` existente (upload já existe em `/painel/loja`). Sem migração.
- **Lista de produtos:** linhas (estilo iFood), foto à direita com botão "+".
- **Item:** tela cheia com foto no topo; sem foto, bloco na cor primária da loja. Abre por cima do cardápio com `?item=<id>` na URL (voltar do celular fecha; link compartilhável).
- **Checkout em 4 etapas** com `?etapa=N` na URL (voltar do celular volta uma etapa).
- Implementação: reescrever as telas no lugar, quebrando `item-dialog.tsx` e `checkout.tsx` em componentes focados; lógica de domínio intocada.

## 3. Design

### 3.1 Tema e estrutura

- **`StoreShell`** (`src/app/[slug]/_components/store-shell.tsx`, servidor): recebe `theme` e `children`; renderiza a `div` com `style={themeCssVariables(theme)}` e o `StoreThemeRoot`. Substitui os wrappers atuais em `page.tsx` e `sacola/page.tsx` e passa a envolver também `pedido/[token]/page.tsx`.
- **`StoreThemeRoot`** (`src/app/[slug]/_components/store-theme-root.tsx`, cliente): recebe as variáveis; em `useEffect` aplica cada uma em `document.documentElement.style` e as remove no cleanup. Motivo: Dialog, Sheet, Select e DropdownMenu do shadcn renderizam em portal no `<body>`, fora do wrapper.
- **`getOrderTracking`** (`src/modules/orders/service.ts`): o objeto `store` passa a incluir `logoUrl` e `theme`. O tipo de retorno é atualizado.
- **`themeCssVariables`**: remove as chaves `--brand-primary` e `--brand-primary-foreground` (as telas usam `bg-primary`/`text-primary-foreground`). `--brand-secondary*` continua (selo de status, gradiente). Testes de `theme.test.ts` atualizados.
- **Limpeza:** remover classes `dark:` das telas públicas reescritas e as referências a `bg-(--brand-primary)`.

### 3.2 Topo e categorias

- **`StoreHeader`**:
  - Capa: `bannerUrl` com `aspect-[3/1]` (máx. ~220px de altura no desktop), `object-cover`. Sem `bannerUrl`: gradiente `from-primary to-brand-secondary`.
  - Logo (`logoUrl`) sobreposto à borda inferior da capa, quadrado arredondado com borda branca e sombra; sem logo, inicial do nome em `bg-card text-primary`.
  - Nome em `h1` (`font-heading`), endereço em `text-muted-foreground`, selo de status (`Badge`) com o texto atual de `OpenStatus` ("Aberto agora", "Fechado", etc.).
- **`CategoryNav`**: abas `sticky top-0` com rolagem horizontal (`ScrollArea` ou overflow nativo); aba ativa `bg-primary text-primary-foreground`, demais `bg-secondary`. A aba ativa acompanha a seção visível via `IntersectionObserver`; clique faz rolagem suave até a seção. A âncora `categoria-<id>` continua.

### 3.3 Lista de produtos

- **`ProductRow`** (substitui `ProductCard` e `AddToCartButton`):
  - Continua `<article>` com nome em `<h3>` (E2E dependem disso).
  - Descrição com `line-clamp-2`, preço em `text-primary font-semibold` ("a partir de" quando tem tamanhos — regra atual de `priceLabel`).
  - Foto 80×80 à direita, arredondada, com botão "+" (`aria-label="Adicionar <nome>"`) sobreposto no canto. Sem foto: só o botão "+" à direita.
  - A linha inteira é clicável (abre o item); o botão "+" faz o mesmo.
  - Esgotado: `Badge` "Esgotado", foto em `grayscale`, sem "+", linha não clicável. (Substitui o `opacity` que reduzia contraste.)
- Seções por categoria com `h2` (`font-heading`) e `id` âncora.

### 3.4 Item em tela cheia

- **Abertura e URL** (`src/app/[slug]/_components/item-param.ts` + hook):
  - Abrir: `history.pushState` acrescentando `item=<productId>` à query atual.
  - Fechar (botão ←, ESC, tocar no "×" do desktop, voltar do navegador): o fechamento por UI chama `history.back()` quando a entrada foi criada pelo próprio cardápio; ao abrir direto por link, fecha com `replaceState` removendo o parâmetro.
  - `parseItemParam(value, menu)` retorna o produto se o id existe e está disponível; senão `null` (e o parâmetro é removido com `replaceState`).
  - O estado lê `useSearchParams()` (dentro do Suspense já existente da página).
- **`ItemSheet`** (`Dialog` do shadcn):
  - Celular: tela cheia (`inset-0`, sem bordas arredondadas). Desktop (`sm:`): modal centralizado `max-w-xl`, altura máx. 90vh.
  - Topo: foto do produto `aspect-video`; sem foto, bloco `bg-primary` com altura reduzida (~96px) e o nome do produto em `text-primary-foreground`. Botão ← sobreposto no canto superior esquerdo.
  - Corpo rolável, em seções (componentes próprios):
    - Título, descrição.
    - **Tamanho** (`RadioGroup`): nome + preço; selo "Obrigatório".
    - **Meio a meio** (só quando o tamanho permite, regra atual `halfAllowed`): `RadioGroup` com "Só este sabor" + sabores elegíveis.
    - **Adicionais**: um bloco por grupo (`Checkbox`), selo com a regra (min/max) — mesmos grupos e filtragem atuais.
    - **Observação** (`Textarea`).
  - Rodapé fixo: quantidade (− n +, 1..`MAX_ITEM_QUANTITY`) e botão "Adicionar · R$ X". Desabilitado enquanto `priceItem` lança erro; a mensagem (`errorText` atual) aparece acima do botão.
  - Ao adicionar: `cart.add`, fecha o item e mostra toast (sonner) "<nome> adicionado à sacola".
- **`CartBar`**: barra fixa no rodapé, `bg-primary`, "Ver sacola · N itens · R$ X", só com itens na sacola.

### 3.5 Checkout em etapas

- Um único `<form>` com quatro `fieldset`; os inativos ficam com `hidden` (continuam montados, então `FormData`, `buildPayload`, idempotência e honeypot `website` não mudam).
  1. **Sacola** — itens (quantidade − +, remover, opções listadas), subtotal. Vazia: estado vazio com "Voltar ao cardápio".
  2. **Entrega** — "Como você quer receber?" (botões segmentados sobre `RadioGroup`); entrega: endereço (CEP com auto-preenchimento atual, rua, número, complemento, bairro com taxa, cidade, referência); retirada: endereço da loja; consumo no local: Mesa.
  3. **Seus dados** — nome, WhatsApp.
  4. **Pagamento e revisão** — forma de pagamento (segmentado), troco quando dinheiro, observação; ao entrar na etapa roda o `quote` atual e mostra subtotal, entrega e total; botão "Confirmar pedido".
- **Navegação:**
  - `?etapa=N` via `pushState`; voltar do navegador volta etapa. `parseStepParam(value)` aceita 1–4, padrão 1.
  - "Continuar" chama `reportValidity()` só no `fieldset` atual.
  - URL com etapa > 1 ao carregar a página: começa na etapa 1 (campos ainda vazios).
  - Qualquer mudança em itens, entrega ou pagamento invalida o quote (regra atual `setQuote(null)`).
- **Erros do servidor:**
  - `stepForField(path)`: `items*` → 1; `fulfillment`, `address.*`, `tableLabel` → 2; `customer.*` → 3; `payment.*`, `notes` → 4; desconhecido → 4.
  - Erro com `fieldErrors`: vai para a menor etapa entre os campos com erro e destaca os campos (`aria-invalid`, mensagem abaixo).
  - Erro geral (loja fechada, abaixo do mínimo, preço mudou): `Alert` na etapa 4; abaixo do mínimo também mostra botão "Voltar à sacola".
- **Topo:** "← <título da etapa> · N de 4" + barra de progresso (4 segmentos). **Rodapé fixo:** total (subtotal até haver quote; depois total do quote) + botão principal ("Continuar" / "Confirmar pedido").
- **Pedido feito:** tela de sucesso (número do pedido, "Enviar no WhatsApp" verde, "Acompanhar pedido"). Ao exibir, `replaceState` remove `?etapa`, para voltar não reabrir o formulário.

### 3.6 Acompanhamento do pedido

- Envolto por `StoreShell` com o tema da loja; topo compacto (logo + nome).
- **`OrderTimeline`**: `timelineFor(fulfillment, status)` retorna as etapas do fluxo (`FLOWS` de `status.ts`) com estado `done | current | upcoming`; rótulos de `statusLabel`. Etapas feitas com ✓, atual em `text-primary` destacada, futuras `text-muted-foreground`. `data-testid="order-status"` continua no rótulo do status atual.
- Cancelado: `Alert variant="destructive"` no lugar da linha do tempo.
- `Card` com itens e totais (subtotal, entrega, total, pagamento); botão "Falar com a loja no WhatsApp"; link "Voltar ao cardápio". `AutoRefresh` de 10 s até status final, como hoje.

### 3.7 Outras telas

- `StoreFooter` (link de privacidade) e `not-found.tsx` do `[slug]` restilizados com tokens.

## 4. Fora do escopo

- Carrossel de "mais pedidos" / destaques.
- Rota própria por produto.
- Mudanças no painel (pré-visualização de tema, header novo) — subprojeto 3.
- Pix online, cupons.

## 5. Testes

- **Unitários** (Vitest, lógica pura em `.ts`):
  - `stepForField`: cada prefixo e o desconhecido.
  - `parseStepParam`: `null`, "0", "1", "4", "5", "abc".
  - `parseItemParam`: id válido, inexistente, esgotado, `null`.
  - `timelineFor`: delivery em `preparing`; pickup em `ready`; `completed`; `cancelled`.
  - `themeCssVariables` sem as chaves `--brand-primary*`.
- **E2E** (Playwright):
  - Atualizar `pedido.spec.ts` (novo fluxo de item e etapas), `menu.spec.ts` e o seletor de cor em `painel.spec.ts` (`--primary:#1d4ed8`).
  - Novos:
    - link com `?item=<id>` abre o produto; voltar do navegador fecha e mantém o cardápio;
    - no checkout, voltar do navegador volta uma etapa com os campos preenchidos;
    - pedido abaixo do mínimo mostra o alerta e o botão "Voltar à sacola";
    - loja sem `bannerUrl` mostra o topo em gradiente (sem `<img>` de capa);
    - `Select`/conteúdo em portal dentro da loja herda `--primary` da loja (variável presente no `<html>` enquanto na loja e ausente após sair para `/login`).
  - Smoke em viewport de celular (Playwright `devices["Pixel 7"]`) para o fluxo completo de pedido.
- Suíte completa verde: lint, typecheck, unitários, integração, build, E2E.

## 6. Critério de pronto

As telas públicas usam só componentes shadcn e tokens (sem `--brand-primary*`, sem `dark:` nas telas públicas, sem `neutral-*` fixo); item em tela cheia com `?item=`; checkout em 4 etapas com `?etapa=`; acompanhamento com linha do tempo e tema da loja; testes da seção 5 verdes; commits na branch `frontend-shadcn`.
