# Reforma do frontend — Admin, login e telas de conta

- **Data:** 2026-10-15
- **Status:** implementado
- **Branch:** `frontend-shadcn`
- **Depende de:** Fundação, Cardápio público e Painel da loja, todos concluídos.

## 1. Contexto e objetivo

Subprojeto 4 de 4. Leva o resto do app para shadcn/ui: login, convite (criar acesso / nova senha), conta sem loja, painel do super-admin, página inicial, privacidade e erro global. Fecha a reforma removendo `src/app/_components/form-controls.tsx` e `styles.ts`.

Sem regra de negócio nova e sem mudança de servidor: actions, autenticação, convites e auditoria ficam como estão.

## 2. Decisões

- **Telas de conta** (login, convite, sem loja): `Card` centralizado com a marca "Naquela Mesa" acima. Sempre claras (fora do `PanelThemeProvider`, como hoje).
- **Admin:** topo fixo com título, saudação, `ModeToggle` e "Sair"; seções em `Card` (Nova loja, Lojas, Registro de suporte); lojas em `Table` no desktop. Ações por loja: "Acessar como loja" e "Gerar link de acesso" (este abre um `Dialog` com o formulário e o link gerado, em vez de ocupar a célula da tabela).
- **Primitivas de formulário compartilhadas:** `form-fields.tsx` (`TextField`, `SubmitButton`, `FieldError`, `FormMessage`) e `native-select.tsx` saem de `src/app/painel/_components` para `src/app/_components`, usadas por painel, admin e convite.
- `SignOutButton` vira `Button` do shadcn (ícone + "Sair").
- **Página inicial e privacidade:** só tokens (sem `neutral-*`/`dark:` manual). Início ganha link "Entrar" discreto para donos de loja.
- **Erro global:** renderiza fora do layout raiz (sem garantia do CSS do app); fica como está.

## 3. Contratos mantidos (E2E)

Rótulos e nomes acessíveis usados pelos testes: `Email`, `Senha`, `Entrar`, `p[role=alert]` do erro de login; formulário `Nova loja` com `Nome da loja`, `Endereço (slug)`, `WhatsApp da loja`, `Email do dono`, `Modelo de cardápio` (select nativo), `Criar loja`, campo `Link de acesso`; linha da loja com `Acessar como loja`; região `Registro de suporte` com itens de lista; convite com `Seu nome`, `Senha`, `Confirmar senha`, `Criar acesso`, títulos `Acesso à <loja>` e `Link inválido ou expirado.`; `Painel do super-admin`.

## 4. Testes

- E2E: suíte atual verde; novo teste do link de acesso pelo `Dialog` (loja sem dono gera link e mostra o campo `Link de acesso`).
- Lint, typecheck, unitários e build verdes; `grep` sem `neutral-`, `red-`, `green-` (exceto WhatsApp) e `dark:` manual em `src/app`.

## 5. Fora do escopo

Recuperação de senha por email, busca/paginação de lojas no admin, edição de loja pelo admin.
