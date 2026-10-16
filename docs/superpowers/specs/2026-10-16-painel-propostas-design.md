# Painel da loja — aplicar as propostas do canvas

- **Data:** 2026-10-16
- **Status:** aguardando revisão
- **Branch:** `frontend-shadcn`
- **Fonte do design:** canvas privado "Painel Naquela Mesa" (pranchas `Proposta · …` e o componente `Sidebar` com `brand=yes`). O super admin (`PropostaAdmin`) **fica de fora** deste spec.
- **Depende de:** spec do Painel (`2026-10-15-frontend-painel-design.md`), já implementado. Este spec substitui as partes dele que mudam.

## 1. Objetivo

Levar ao código as pranchas aprovadas no canvas: tema Naquela Mesa no painel, barra lateral nova, Primeiros passos flutuante, cards de pedido redesenhados, Histórico e Métricas novos, Cardápio com produtos e adicionais na mesma tela, e Configurações da loja com barra de salvar única.

Regra de negócio quase não muda. O servidor ganha só peças pequenas (§9), sem migração SQL.

## 2. Decisões tomadas por mim (revisar)

As pranchas deixaram estes pontos em aberto. Cada um tem uma decisão padrão; troque o que não servir.

| # | Ponto | Decisão |
|---|---|---|
| D1 | (a) Ações do card de pedido | Como na prancha: botão principal largo (Aceitar/Pronto/…), ícones Imprimir e WhatsApp, "⋯" só com "Cancelar pedido". Telefone vira ícone de ligar na linha do cliente. |
| D2 | (b) Alcance de "Cores do painel" | Só o painel da equipe. O cardápio do cliente segue sempre as cores da loja. |
| D3 | (c) Itens extras no menu da loja | Nenhum além da prancha: Aparência, Horários e status, Pedidos e pagamento, Ver cardápio, Sair. |
| D4 | Onde guardar "Cores do painel" | Na loja (vale para toda a equipe): chave nova `theme.panelColors` no jsonb, `"naquela"` por padrão. |
| D5 | Modo escuro | Continua existindo. A paleta Naquela ganha uma versão escura quente (§3.2). "Cores da loja" no escuro usa o escuro neutro de hoje com a primária da loja. |
| D6 | "Na mesa" | Renomeia **só no painel** (bloco de tipos de pedido e filtros). Cliente, comanda e WhatsApp continuam "Consumo no local". Idem "Retirada": rótulo curto só no painel; "Retirada no balcão" segue no resto. |
| D7 | Adicionais liga/desliga e regra do meio a meio | Mantidos (a prancha omitiu). Adicionais vira uma linha com chave em Regras; o meio a meio mostra o seletor "Sabor mais caro / Média dos sabores" quando ligado. |
| D8 | Filtro de status do Histórico | Todos / Concluídos / Cancelados, como na prancha. Pedidos em andamento aparecem em "Todos" com selo neutro. |
| D9 | Soma em R$ no Histórico | Exclui cancelados (igual ao faturamento das Métricas). |
| D10 | Primeiros passos | Card flutuante em todas as telas do painel; fecha no ×; volta a cada novo login enquanto houver passo pendente. |
| D11 | Contagem "N novos" na barra lateral | Sim, ao vivo, reaproveitando o endpoint de versão da fila. |
| D12 | Adicionais do cardápio quando a loja desligou adicionais | A seção aparece com aviso "Adicionais desligados na loja" e link para Pedidos e pagamento. |
| D13 | Celular | Barra lateral continua gaveta. Cardápio no celular: seletor com dois grupos (Categorias / Adicionais). Demais telas: o layout das pranchas quebra em coluna. |
| D14 | Segunda fechada na prancha | Só exemplo. O seed não muda (E2E depende dele). |

## 3. Tema do painel

### 3.1 Escopo

- `(shell)/layout.tsx` envolve tudo num `<div data-panel-theme="naquela|loja">`. O valor vem de `store.theme.panelColors`.
- Os tokens do shadcn são redefinidos em `globals.css` só dentro desse atributo. Login, admin, cardápio público e impressão não mudam.
- "Cores da loja": a primária e a secundária da loja entram como variáveis inline no wrapper, com a cor de texto calculada pelos helpers de `src/modules/stores/theme.ts`. Regra herdada: a cor da loja nunca é usada como cor de texto sobre fundo claro.
- A fonte Pacifico (`pacifico.variable`, `scriptFont` em `src/app/_components/brand-theme.ts`) é carregada no wrapper, para a marca do rodapé.
- Tokens extras: `--brand` (marca), `--primary-hover`, `--chart-1`, `--chart-2`, `--ok`, `--ok-foreground`, `--tint` (fundo de item selecionado).

### 3.2 Valores

| Token | Naquela claro | Naquela escuro | Loja claro | Loja escuro |
|---|---|---|---|---|
| `--background`, `--card`, `--popover` | `#FFFFFF` | `#1C1410` / card `#261C16` | neutro de hoje | neutro escuro de hoje |
| `--foreground` | `#3B2A20` | `#F6EADB` | hoje | hoje |
| `--muted`, `--secondary`, `--sidebar` | `#F6EADB` | `#2E231C` | hoje | hoje |
| `--muted-foreground` | `#6E5644` | `#C9B49C` | hoje | hoje |
| `--border`, `--input`, `--sidebar-border` | `#EBDCC8` | `#3D2F25` | hoje | hoje |
| `--accent`, `--sidebar-accent` | `#EBDCC8` | `#3D2F25` | tint da primária | hoje |
| `--primary`, `--sidebar-primary`, `--ring`, `--chart-1` | `#B5481C` | `#D9622B` | primária da loja | primária da loja |
| `--primary-foreground` | `#FFFFFF` | `#FFFFFF` | calculado | calculado |
| `--primary-hover` | `#8A3A17` | `#E9A27A` | primária escurecida (`color-mix`) | idem |
| `--chart-2` | `#E9A27A` | `#E9A27A` | secundária da loja | idem |
| `--brand` | `#D9622B` | `#E9A27A` | `#D9622B` | `#E9A27A` |
| `--tint` | `#FDF5EE` | `#33241B` | `color-mix(primária 8%, branco)` | `color-mix(primária 18%, background)` |
| `--ok` / `--ok-foreground` | `#F6EADB` / `#8A3A17` | `#2E231C` / `#E9A27A` | `#f5f5f5` / `#404040` | neutro |

Fixos nos dois temas: cancelado `#FDECEC`/`#B42318`, aberto `#E8F5EC`/`#1E6B3A` (ponto `#22A05B`), chave desligada `#d6d3d1`, sombra do card flutuante `0 12px 32px rgba(59,42,32,.16)`. No escuro, cancelado e aberto usam as variantes já existentes de `destructive` e um verde equivalente com contraste ≥ 4.5:1.

Raios: cards 14px, campos 10px, botões pequenos 8px, pílulas 999px. Títulos de página: 26px/700.

## 4. Shell

### 4.1 Barra lateral (`panel-sidebar.tsx`, `nav.ts`)

- Aberta 256px, recolhida 56px (`--sidebar-width-icon: 3.5rem`). Fundo `--sidebar`. Sem rótulos de grupo; grupos separados por linhas finas de 1px.
- **Topo = botão com o nome da loja** (`DropdownMenu`):
  - avatar 36px (logo ou inicial sobre `--primary`), com ponto de status no canto (verde aberto, cinza fechado);
  - nome (15px/700, truncado) e, embaixo, o status: "Aberto · fecha 23:30" (verde) ou "Fechado · abre hoje às 18:00" (muted, texto de `formatOpenStatus`). Abertura manual: "Aberto agora"; fechamento manual: "Fechado agora";
  - chevron; `aria-label="{Nome} — abrir menu da loja"`.
  - Itens do menu: rótulo "Configurações da loja"; Aparência (`/painel/loja?aba=aparencia`), Horários e status (`?aba=horarios`), Pedidos e pagamento (`?aba=pedidos`); separador; Ver cardápio (`/{slug}`, nova aba); Sair.
  - Recolhida: só o avatar.
- **Pedidos** em destaque (44px, 15px/600). Inativo: fundo `--card`. Ativo: fundo `--primary`, texto branco. Selo "N novos" quando N > 0. Recolhida: ícone e ponto `--brand`.
- Depois, linha fina e os itens **Cardápio** (`/painel/cardapio`), **Histórico** (`/painel/pedidos`), **Métricas** (`/painel/metricas`): 36px, ativo com fundo `--accent` e peso 600.
- Saem da navegação: Produtos e Adicionais (viram Cardápio), Configurações e Ver cardápio (vão para o menu da loja).
- **Rodapé:** "Painel por" (11px muted) e "Naquela Mesa" em Pacifico 20px `--brand`, link para a raiz do site (`/`); à direita, o `ModeToggle` atual (32px, mantém o menu Claro/Escuro/Sistema e o `aria-label="Alternar tema"`). Recolhida: só o botão de tema.
- **N novos:** componente cliente que consulta `/api/painel/pedidos/versao` (já devolve `received`) a cada 15s e quando a aba volta ao foco; na tela de Pedidos usa o mesmo valor do `QueuePoller`, sem segunda consulta. Valor inicial vem do servidor no layout.
- Celular: gaveta como hoje; o menu da loja funciona dentro dela e fecha a gaveta ao navegar.

### 4.2 Topo do conteúdo

- 56px, borda inferior. Botão de recolher (`aria-label="Recolher barra lateral"` no desktop, "Abrir menu" no celular), separador e trilha: Pedidos/Histórico/Métricas → "Operação / …"; Cardápio → "Cardápio"; Configurações → "Loja / Configurações". `PageTitle` passa a ler um mapa próprio em `nav.ts`.

### 4.3 Primeiros passos flutuante

- Sai do topo de `/painel` e vira `FloatingChecklist` (cliente) renderizado no `(shell)/layout.tsx`, alimentado por `getOnboardingChecklist(store)`.
- Fixo em `right: 24px; bottom: 24px`, 360px (celular: `min(360px, 100vw - 32px)`, 16px das bordas), acima do conteúdo e abaixo de dialogs. `role="region" aria-label="Primeiros passos"`.
- Conteúdo: título "Primeiros passos"; "{n} de 5 concluídos"; barra de progresso (`--muted` com preenchimento `--primary`); lista: pendente = link com círculo vazio, feito = check e texto riscado em muted; rodapé "Fechou? Ele volta no próximo login até tudo ficar pronto."; botão × `aria-label="Fechar primeiros passos"`.
- Links de cada passo vão direto para a aba certa: logo → `?aba=aparencia`, horários → `?aba=horarios`, entrega e Pix → `?aba=pedidos`, cardápio → `/painel/cardapio`.
- Some com 5 de 5.
- **Persistência:** `SessionUser` ganha `sessionId` (id da sessão do better-auth). Fechar grava `localStorage["primeiros-passos-fechado"] = sessionId`. O card aparece quando o valor salvo é diferente da sessão atual. Leitura e escrita em try/catch; sem `localStorage`, o card aparece. Para não piscar, o card só monta depois de ler o storage.

## 5. Pedidos (fila)

- Colunas: fundo `--muted`, raio 14, contador em pílula branca. Títulos e "Nenhum pedido." iguais a hoje.
- "Iniciar atendimento": tamanho padrão, ícone de sino; textos iguais.
- **Card de pedido** (`order-card.tsx`), `article aria-label="Pedido #0165"`:
  1. `#0165` (18px/700), selo de status e, à direita, hora "19:42 · há 3 min" (relativo calculado no cliente e atualizado a cada minuto). Selos: Novo = `--primary` com texto branco; Em preparo = `--ok`; Pronto/Saiu para entrega = contorno neutro; Concluído = `--ok`; Cancelado = cores fixas de cancelado. Na fila, `received` aparece como "Novo" (mapa de rótulos curto do painel; `statusLabel` global não muda).
  2. Chip do tipo (ícone + "Delivery" / "Retirada" / "Na mesa"), nome do cliente e ícone de ligar (`tel:`, `aria-label="Ligar para {nome}"`, telefone no `title`).
  3. Endereço (só delivery), com ícone de alfinete.
  4. Itens entre linhas tracejadas: "1× Grande — ½ Calabresa + ½ Mussarela", adicionais "+ Borda: Catupiry", observações como hoje.
  5. Pagamento ("Dinheiro · troco p/ R$ 100", "Pix", "Cartão") e total "R$ 84,90" (17px/700).
  6. Ações: principal (`advanceLabel`, ícone, `aria-label` igual a hoje, ex. "Aceitar #0165"); Imprimir (`aria-label="Imprimir comanda #0165"`); WhatsApp em contorno, sem o verde (`aria-label="Avisar cliente #0165 no WhatsApp"`); "⋯" (`aria-label="Mais ações do pedido #0165"`) com "Cancelar pedido", que abre um `Dialog` com o `CancelForm` atual (campo "Motivo do cancelamento", "Confirmar cancelamento", "Voltar"). Sem "⋯" em status final.
- Actions do servidor inalteradas.

## 6. Histórico e Métricas

### 6.1 Histórico (`/painel/pedidos`)

- Título "Histórico de pedidos" e subtítulo `<span>{n} pedido(s)</span> · {período} · {R$ soma}` (contagem em elemento próprio).
- Filtros num `form role="search"` que aplicam sozinhos (sem botão "Filtrar"):
  - busca (`aria-label="Buscar"`, placeholder "Buscar por nº, nome ou telefone"), aplica no Enter e após 400ms parado;
  - botão de período ("Últimos 7 dias" + calendário) que abre um `Popover`: Hoje, Últimos 7 dias, Últimos 30 dias, Personalizado (campos De/Até e botão "Aplicar" dentro do popover; erros de período aparecem ali);
  - grupo segmentado `aria-label="Status"`: Todos / Concluídos / Cancelados (`aria-pressed`);
  - botão "Tipo" com `Popover`: Todos / Delivery / Retirada / Na mesa.
  - Tudo continua em parâmetros de URL (`periodo`, `de`, `ate`, `status`, `q`, `pagina`, e o novo `tipo=delivery|pickup|dine_in`), com `router.replace`.
- Tabela: Pedido (número e, embaixo, "13/10, 22:14"), Cliente, Tipo (ícone + rótulo curto), Status (selo), Total (600, à direita), chevron. A linha inteira continua abrindo o `Sheet` de detalhe, e o botão mantém `aria-label="Ver pedido #…"`. O detalhe mostra a data completa com ano.
- Paginação, estado vazio ("Nenhum pedido encontrado."), carregando e erro: textos de hoje, visual novo. Celular: cartões de hoje com o visual novo.

### 6.2 Métricas (`/painel/metricas`)

- Subtítulo "Últimos 7 dias · 10/10/2026 a 16/10/2026" (igual a hoje).
- Período: grupo segmentado `aria-label="Período"` Hoje / 7 dias / 30 dias + botão "Personalizado" com o mesmo popover do Histórico. Aplica sozinho.
- KPIs com ícone (Faturamento, Pedidos, Ticket médio, Cancelamentos); nota "Valores sem os pedidos cancelados."
- Cards:
  - **Mais vendidos**: posição, nome, barra fina e "8 · R$ 339,20". A lista mantém `ul/li`.
  - **Pedidos por hora**: colunas verticais com valor em cima e "19h" embaixo, em `ul/li`.
  - **Por tipo de pedido** e **Por canal**: barra única empilhada (`--chart-1`, `--chart-2` e uma terceira cor `--brand` para o 3º item) + legenda "12 · R$ 971,00". Nas Métricas os rótulos de tipo são os completos.
- Sem dado novo no servidor.

## 7. Cardápio (produtos + adicionais)

### 7.1 Tela

- Uma rota só: `/painel/cardapio`. `/painel/cardapio/adicionais` vira redirect para `/painel/cardapio` em `next.config.ts`; a pasta da rota sai e as actions de adicionais vão para `cardapio/adicionais-actions.ts`.
- Cabeçalho: "Cardápio", subtítulo "Produtos por categoria e os grupos de adicionais, num lugar só." e botão "Ver como cliente" (`/{slug}`, nova aba).
- Coluna esquerda (240px), num `nav aria-label="Cardápio"` com duas listas:
  - "Categorias" (lista com `aria-label="Categorias do cardápio"`): nome + nº de produtos; selo "Inativa" mantido; botão "+ Categoria" (abre o dialog atual).
  - linha fina; "Adicionais": nome do grupo + nº de opções; botão "+ Grupo de adicionais".
  - Selecionado: fundo `--accent`, peso 600, `aria-current="true"`.
- **Painel da categoria:** título; botão "{n} tamanhos" (`aria-label` contém "Tamanhos"); "+ Produto"; "⋯" da categoria (itens de hoje). Linhas de produto: foto/inicial 48px, nome, "a partir de R$ 32,90" e dica de adicional (ícone + nome do primeiro grupo, "+N" se houver mais), texto "Disponível"/"Esgotado" (vermelho) + chave (`aria-label="Disponível: {nome}"`), lápis (botão `Editar {nome}`), "⋯" com Mover para cima, Mover para baixo, **Ocultar/Mostrar no cardápio** (novo).
- **Painel do grupo:** título, subtítulo `ruleLabel` + "· usado em N produtos"; "Editar grupo"; "+ Opção" (abre o painel do grupo com uma linha nova em foco); lista de opções com preço ("+ R$ 8,00" ou "grátis"), "Disponível"/"Esgotado" + chave (`aria-label="Disponível: {opção}"`), lápis que abre o painel do grupo; faixa "Usado em:" com chips que abrem o painel do produto.

### 7.2 Painel do produto (`Sheet` 520px)

- Cabeçalho: avatar, nome, categoria, fechar. Título acessível "Editar produto" / "Novo produto".
- Informações: tile de foto tracejado 96px (mesmo upload de hoje, `aria-label="Foto do produto"`), Nome, Descrição.
- Preços: "Preços" + "vazio = não vende nesse tamanho"; grade de 3 com prefixo "R$" e `aria-label="Preço {tamanho}"`; categoria sem tamanhos mantém o campo "Preço".
- "Meio a meio" em linha com chave e "Cliente pode combinar com outro sabor" (só quando algum tamanho aceita 2 sabores).
- Adicionais: cartões que ligam/desligam (`role="switch"`), com nome, regra em minúsculas e resumo das opções; link "+ Novo grupo" sempre visível. Criar grupo por aqui abre o painel do grupo; ao salvar, o grupo novo já volta marcado no produto.
- Visibilidade: "Aparece no cardápio" / "Desligado: some do cardápio sem apagar" (campo `active`).
- Rodapé: "Cancelar" e "Salvar produto".

### 7.3 Painel do grupo (`Sheet` 540px)

- Cabeçalho: "Grupo de adicionais" (ou "Novo grupo de adicionais") e "Usado em N produtos".
- "Nome do grupo".
- "Regra de escolha": cartões Opcional ("cliente pode pular") / Obrigatório ("precisa escolher para adicionar"); contadores "Mínimo" (só no obrigatório, de 1 até o máximo) e "Até N opções" (1 a 50); prévia "O cliente vê: “{ruleLabel}”".
- "Opções": linhas editáveis no lugar (nome, preço com "+ R$", chave disponível) e "+ Opção". Dica "Preço R$ 0 = grátis. A chave pausa a opção sem apagar."
- "Produtos que usam este grupo": chips (abrem o produto) e a dica de que o vínculo se faz no produto.
- Rodapé: "Cancelar" e "Salvar grupo" (salva grupo e opções juntos, numa transação).
- Fora de escopo (não construir): quantidade por opção, "N grátis", foto da opção, preço por produto, reordenar arrastando, apagar opção/grupo.

### 7.4 URL

- Mantém `?categoria=`, `?produto=`, `?novo=`. Novos: `?grupo=<id>` (painel do grupo selecionado; exclui `categoria`), `?editar-grupo=<id>` e `?novo-grupo=1` (overlays, com voltar fechando). `parsePanelParams` valida o id do grupo contra o catálogo; `createUrlOverlay` limpa as chaves novas.

## 8. Configurações da loja

### 8.1 Geral

- Abas `?aba=aparencia|horarios|pedidos` com os mesmos rótulos, em controle segmentado.
- Seções viram cards com `aria-label` próprio.
- **Barra de salvar única por aba**, fixa no rodapé: "Alterações não salvas nesta aba" + "Descartar" + "Salvar". Só aparece com alteração pendente. "Descartar" volta ao último salvo. Mensagens de sucesso por aba: "Aparência salva.", "Horários salvos.", "Pedidos e pagamento salvos.". As abas continuam montadas, então o rascunho sobrevive à troca de aba. Aviso ao sair da página com alteração pendente (`beforeunload`).

### 8.2 Aparência

- **Identidade:** Nome da loja; Endereço e WhatsApp lado a lado (WhatsApp com máscara brasileira, convertido para E.164 antes de enviar); tiles tracejados "Logo" ("Enviar") e "Capa" ("Enviar foto (horizontal)") com miniatura depois do envio, mantendo `alt="Prévia: {rótulo}"`.
- **Cores e fonte do cardápio:** "O que o cliente vê. A prévia ao lado muda na hora."; cartões "Cor principal" e "Cor secundária" com amostra e hex (o `input type=color` continua sendo o alvo do rótulo); fonte em cartões de rádio `aria-label="Fonte dos títulos"`: "Moderna" (sem serifa) e "Clássica" (com serifa).
- **Cores do painel:** "Só para a equipe. Não muda o cardápio."; rádios "Naquela Mesa" (padrão) e "Cores da loja" (principal e secundária, com as cores atuais). A escolha muda o painel na hora; salva com "Salvar"; "Descartar" volta.
- **Prévia** fixa ao lado (sticky), sempre clara; mantém `data-testid="theme-preview"` e `preview-cart-button`.

### 8.3 Horários e status

- **Status agora:** pílula à direita ("Aberto · fecha às 23:30", "Fechado · abre hoje às 18:00", "Aberto agora (manual)", "Fechado agora (manual)"); três cartões Automático ("segue os turnos") / Abrir agora ("até voltar ao automático") / Fechar agora ("pausa pedidos"), com `aria-pressed`. O texto de apoio fica fora do nome acessível (`aria-hidden`). Status continua salvando na hora, fora da barra de salvar.
- **Turnos:** "Fechar antes de abrir = vira a meia-noite (18:00 às 00:30)."; 7 linhas Domingo…Sábado: chave `aria-label="Abre {Dia}"`; ligado mostra os turnos como chips editáveis "18:00 – 23:30" em 24h (dois campos de texto `HH:MM` com máscara, nunca `input type=time`), cada um com remover (`aria-label="Remover turno {n} de {Dia}"`), e botão + (`aria-label="Adicionar turno em {Dia}"`); desligado mostra "Fechado". Ligar um dia cria 18:00–23:00. Erro de sobreposição aparece na linha do dia.

### 8.4 Pedidos e pagamento

- **Tipos de pedido:** tiles `role="switch"` Delivery / Retirada / Na mesa. Erro "ative ao menos um tipo de pedido" embaixo.
- **Taxa de entrega:** segmentado "Fixa" / "Por bairro". Fixa: campo "R$" (`aria-label="Valor da taxa fixa"`). Por bairro: lista editável dentro do card (linhas do `ZonesEditor` atual, botão "+ Bairro" com `aria-label="Adicionar bairro"`). Os bairros ficam guardados mesmo no modo Fixa.
- **Regras:** Pedido mínimo (R$), Preparo (min), Entrega (min); linhas com chave "Imprimir comanda ao aceitar", "Meio a meio" (com o seletor de regra de preço quando ligado) e "Adicionais" ("grupos de adicionais no cardápio").
- **Pagamento** ("Pagamento na entrega ou retirada"): tiles Dinheiro / Cartão / Pix; campo "Chave Pix". Pix desligado envia `pixKey` nulo e guarda o texto no rascunho; Pix ligado exige chave ("Informe a chave Pix").
- Um só "Salvar" grava operação e bairros juntos, numa transação.

## 9. Servidor (mudanças pequenas, sem migração)

1. `stores/settings.ts`: `storeThemeSchema.panelColors = z.enum(["naquela", "store"]).default("naquela")`. `settings-service.ts` aceita `panelColors` opcional no perfil; `saveProfileAction` lê o campo.
2. `stores/hours.ts`: `OpenStatus` ganha `closesAt: string | null` (fechamento do turno atual; nulo em manual e fechado).
3. `auth`: `SessionUser.sessionId`.
4. `orders/history.ts`: filtro `fulfillment` e `revenueCents` (soma sem cancelados) no `OrderHistoryPage`.
5. `catalog`: `saveOptionGroup(storeId, {id?, name, minSelect, maxSelect, options: [{id?, name, priceCents, available}]})` transacional (cria ou atualiza; opção que some da lista não é apagada, porque apagar está fora de escopo); action devolve o id. `setProductActive(storeId, productId, active)` + action. O uso de cada grupo ("usado em N produtos" e os chips) é calculado no painel a partir de `optionGroupIds` dos produtos, sem consulta nova.
6. `stores`: `saveOperationsWithZones` que grava operação e bairros numa transação; Pix ligado sem chave é rejeitado.
7. Rótulos curtos do painel (`PANEL_FULFILLMENT_LABELS`, `PANEL_STATUS_LABELS`) num módulo do painel; os mapas globais não mudam.

## 10. Testes

- **Unitários/integração novos ou atualizados:** `hours.test.ts` (`closesAt`), `settings-service.int.test.ts` (`panelColors`: padrão, salvar, inválido, omitido preserva; asserção da linha 60), `history.int.test.ts` (tipo e soma), testes de `saveOptionGroup` e `setProductActive`, `nav.test.ts`, `panel-params.test.ts` (grupo), lógica do card flutuante (decidir se mostra, dado sessionId salvo/atual) e do "há N min".
- **E2E a ajustar:** `painel-auth` (Ver cardápio e Sair dentro do menu da loja; Cardápio no lugar de Produtos/Adicionais), `painel-tema` (Sair; cor de fundo esperada), `painel-pedidos` (cancelar pelo "⋯"), `admin` (texto "1 de 5 concluídos"), `painel-metricas` (segmentados, popover, filtros sem botão), `painel` (seletores do cardápio, fonte em rádio, botões "Salvar", região "Turnos", turnos sobrepostos), `painel-forms` (tile "Cartão", "Salvar").
- **E2E novos:** tema Naquela padrão e troca para cores da loja; Primeiros passos fecha e volta após novo login; editar grupo de adicionais (regra, opção nova, chave) e ligar o grupo num produto; filtro por tipo no Histórico; barra de salvar com Descartar.

## 11. Fora de escopo

- Super admin (`PropostaAdmin`).
- Itens que a prancha do grupo deixou de fora (§7.3).
- Apagar e reordenar grupos/opções.
- Mudar textos para o cliente (D6).
