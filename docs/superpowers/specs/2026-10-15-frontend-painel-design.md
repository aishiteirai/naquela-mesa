# Reforma do frontend — Painel da loja

- **Data:** 2026-10-15
- **Status:** implementado (branch `claude/frontend-reforma-mmdfui`, a partir da `frontend-shadcn`)
- **Branch:** `frontend-shadcn`
- **Depende de:** Fundação (`2026-10-15-frontend-fundacao-design.md`) e Cardápio público (`2026-10-15-frontend-cardapio-design.md`), ambos concluídos.

## 1. Contexto e objetivo

Subprojeto 3 de 4. Refaz o painel da loja (`/painel/*`) com shadcn/ui. Dores do dono: **navegação** (links soltos no topo), **editar o cardápio** (categorias empilhadas, produto em outra página, disponibilidade e adicionais espalhados) e **configurar a loja** (página longa e misturada, sem campo de fonte). A fila de pedidos **não** é dor: recebe só o visual novo, sem mudar o fluxo.

Sem regra de negócio nova. Mudanças de servidor permitidas, todas pequenas:

- `saveProductAction` deixa de redirecionar e devolve sucesso (o painel lateral fecha sozinho).
- O schema do perfil da loja passa a aceitar `theme.font`, e `saveProfileAction` lê o campo `font`.

## 2. Decisões tomadas

- Navegação em **barra lateral agrupada** (shadcn Sidebar).
- Cardápio em **uma tela**: categorias à esquerda, produtos no meio, edição num **painel lateral** (`Sheet`) controlado pela URL (`?produto=` / `?novo=`). Chave de disponível na própria linha (fim da página Disponibilidade).
- Configurações da loja em **abas**, com **prévia ao vivo** do tema na aba Aparência.
- Reescrita no lugar, reaproveitando as actions existentes.

## 3. Design

### 3.1 Estrutura e navegação

- `npx shadcn@4.21.5 add sidebar table` (traz `tooltip` e dependências).
- **Route groups:** as páginas com shell vão para `src/app/painel/(shell)/…` com `(shell)/layout.tsx` (sidebar). `src/app/painel/layout.tsx` mantém só o que vale para tudo (`PanelThemeProvider`, acesso). A impressão (`/painel/pedidos/[id]/imprimir`) fica fora de `(shell)`, sem sidebar. URLs não mudam.
- **`PanelSidebar`**:
  - Topo: logo (ou inicial) e nome da loja; link "Ver cardápio" (nova aba).
  - Grupos e itens:
    - **Operação:** Pedidos (`/painel`), Histórico (`/painel/pedidos`), Métricas (`/painel/metricas`).
    - **Cardápio:** Produtos (`/painel/cardapio`), Adicionais (`/painel/cardapio/adicionais`).
    - **Loja:** Configurações (`/painel/loja`).
  - Rodapé: `ModeToggle` e "Sair".
  - Desktop recolhe para ícones (cookie padrão do shadcn); celular abre como gaveta pelo botão ☰ (`SidebarTrigger`) no topo do conteúdo.
  - Item ativo: `isNavItemActive(pathname, href)` — `/painel` só ativo em `/painel` exato; demais ativos no prefixo (`/painel/cardapio` não ativa em `/painel/cardapio/adicionais`: o item mais específico vence). Componente cliente com `usePathname` dentro de `Suspense`.
- Topo do conteúdo (`SidebarInset`): `SidebarTrigger`, título da página, banner de suporte (impersonação) quando houver.
- **Sem** contador de pedidos novos na sidebar (exigiria polling em todas as páginas; a fila já alerta com som).
- **Redirecionamentos** (rotas antigas): `/painel/disponibilidade` → `/painel/cardapio`; `/painel/cardapio/produtos/novo?categoria=X` → `/painel/cardapio?categoria=X&novo=X`; `/painel/cardapio/produtos/[id]` → `/painel/cardapio?produto=[id]` (categoria do produto selecionada).

### 3.2 Cardápio (`/painel/cardapio`)

- Parâmetros: `categoria` (id; padrão: primeira), `produto` (id em edição), `novo` (id da categoria do produto novo). `parsePanelParams` valida contra o catálogo carregado; inválidos são ignorados.
- **Coluna de categorias** (celular: `Select` no topo): nome, contagem de produtos, `Badge` "Inativa". "+ Categoria" abre `Dialog` com o formulário atual de nova categoria.
- **Cabeçalho da categoria:** nome; botão "Tamanhos" → `Sheet` com o `SizesEditor` atual; botão "+ Produto" → `?novo=<categoria>`; menu ⋯ (`DropdownMenu`): "Renomear / ativar" (`Dialog` com `CategoryForm`), "Mover para cima", "Mover para baixo" (`moveCategoryAction`).
- **Linha de produto:** miniatura (ou inicial), nome, preço (regra atual "a partir de"), `Badge` "Inativo"; `Switch` "Disponível" (`toggleProductAvailabilityAction`, toast "Calabresa marcada como esgotada/disponível"); menu ⋯: "Editar", "Mover para cima/baixo" (`moveProductAction`). Clicar na linha abre `?produto=<id>`.
- **`ProductSheet`** (`Sheet` à direita; tela cheia no celular): o `ProductForm` atual com campos shadcn — nome, descrição, foto (`ImageUploadField`), preços por tamanho ou preço único, meio a meio (`Switch`), grupos de adicionais (`Checkbox`). Abrir/fechar como o `?item=` do cardápio público (`pushState`; voltar do navegador fecha). Ao salvar com sucesso: fecha, toast "Produto salvo", `router.refresh()`. Erros de campo no próprio painel.
- **Adicionais** (`/painel/cardapio/adicionais`): um `Card` por grupo (nome, regra mín/máx, opções com preço). Cada opção com `Switch` "Disponível" (`toggleOptionAvailabilityAction`). "Novo grupo", editar grupo e editar/adicionar opção usam os formulários atuais restilizados.

### 3.3 Configurações da loja (`/painel/loja`)

- `Tabs` controladas por `?aba=` (`aparencia` padrão, `horarios`, `pedidos`); `parseSettingsTab` valida.
- **Aparência:** nome, endereço, WhatsApp, logo, capa, cor principal, cor secundária, **fonte dos títulos** (`Select` Sans/Serif). Ao lado (abaixo no celular), **`ThemePreview`**: mini-celular com capa (ou gradiente), logo, nome, uma linha de produto e o botão "Ver sacola", atualizado enquanto o formulário muda (estado local; cores via `readableTextColor` de `@/modules/stores/client`; fonte via `--font-geist-sans`/`--font-lora`).
- **Horários e status:** status manual (Automático / Abrir agora / Fechar agora) em botões segmentados com `aria-pressed` (mantém o contrato do E2E), editor de turnos.
- **Pedidos e pagamento:** `OperationsForm` atual (tipos de pedido, cardápio, regras, taxa de entrega, pagamento) e editor de bairros. (Ajuste ao mockup de 4 abas: entrega, regras e pagamento salvam numa única action hoje; dividir exigiria mudar o servidor.)

### 3.4 Pedidos, histórico, métricas

- **Fila (`/painel`):** mesmo fluxo e componentes de lógica (`QueuePoller`, som, aceitar/avançar/cancelar, imprimir, avisar no WhatsApp). Visual: `Card` por pedido, `Badge` de status/tipo, `Button` para ações, `Alert` para avisos (`QueueNotice`), "Iniciar atendimento" em destaque, checklist de onboarding em `Card`.
- **Histórico (`/painel/pedidos`):** filtros (período, status, busca) com `Input`/`Select`/`Button`; lista em `Table` no desktop e cards no celular; detalhe do pedido como hoje.
- **Métricas:** cards de número (`Card`) e barras (`BarList`) com tokens; filtros de período com componentes shadcn.
- **Impressão:** layout inalterado, só fora do shell.

### 3.5 Geral

- Telas do painel sem cores fixas (`neutral-*`, `red-*`, `green-*`), sem `dark:` manual (os tokens já seguem o modo escuro), exceto o verde do WhatsApp.
- `src/app/_components/styles.ts` e `form-controls.tsx`: o painel deixa de usar; o que sobrar para admin/login fica para o subprojeto 4.

## 4. Fora do escopo

Contador ao vivo na sidebar; excluir produto; arrastar para reordenar; mudança no fluxo da fila; admin e login (subprojeto 4).

## 5. Testes

- **Unitários:** `isNavItemActive` (casos `/painel`, `/painel/pedidos`, `/painel/cardapio`, `/painel/cardapio/adicionais`, subrotas); `parseSettingsTab`; `parsePanelParams` (categoria válida/inválida, produto de outra categoria, `novo` inválido).
- **Integração:** salvar perfil com `theme.font = "serif"` persiste e mantém `primary`/`secondary`.
- **E2E** (`make e2e`, banco `naquela_mesa_e2e`):
  - atualizar `painel.spec.ts`, `painel-pedidos.spec.ts`, `painel-metricas.spec.ts`, `painel-auth.spec.ts`, `painel-tema.spec.ts` e `helpers.ts` (`setStoreStatus`) para a nova navegação e formulários;
  - novos: `Switch` de disponível esconde o "Adicionar" no cardápio público; editar produto pelo painel lateral (`?produto=`) e o voltar do navegador fecha; a prévia muda ao digitar nova cor; sidebar no celular abre pelo ☰ e navega; rotas antigas redirecionam.
- Suíte completa verde: lint, typecheck, unitários, integração, build, E2E.

## 6. Critério de pronto

Painel inteiro dentro do shell com sidebar; cardápio em tela única com painel lateral e chaves de disponibilidade; configurações em abas com prévia e campo de fonte; fila/histórico/métricas com componentes shadcn; rotas antigas redirecionando; seção 5 verde; commits na `frontend-shadcn`.

## 7. Notas da implementação

- `sidebar`, `table` e `tooltip` foram gerados a partir do código-fonte do shadcn (fixture radix-nova da sidebar e arquivos base do radix com o estilo nova aplicado), porque o registry `ui.shadcn.com` não era acessível no ambiente. `use-mobile` usa `useSyncExternalStore` (a versão original faz `setState` em efeito, recusado pelo lint).
- Novo `@/modules/catalog/client` (só `menu.ts` e `editor-types.ts`): componentes cliente do painel precisam de `startingPriceCents` sem puxar o banco.
- Redirecionamentos em `next.config.ts` (`redirects()`, 307). `/painel/cardapio/produtos/novo?categoria=X` vai para `/painel/cardapio?novo=X&categoria=X` (a query original é repassada).
- Histórico: o detalhe do pedido abre num painel lateral (`Sheet`) a partir da linha da tabela (desktop) ou do cartão (celular), em vez do `<details>` expansível.
- `parsePanelParams`: produto aberto seleciona a categoria dele, mesmo com outra em `categoria`; `produto` vence `novo`.
- Filtros GET (histórico, métricas) usam `<select>` nativo com visual de `Input` (`NativeSelect`), para funcionar sem JS.
