# Atalhos do Naquela Mesa. Rode `make` ou `make help` para ver os comandos.

PORT ?= 3000
export PORT

.DEFAULT_GOAL := help
.PHONY: help setup update dev build start test e2e e2e-db check env db-up db-migrate db-seed db-studio admin owner

help: ## Lista os comandos
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36mmake %-12s\033[0m %s\n", $$1, $$2}'

setup: env ## Primeira vez: dependências, .env.local, banco e loja demo
	npm install
	$(MAKE) db-up db-migrate db-seed

update: ## Depois de mudanças no código: git pull, dependências, migrações e demo
	git pull --ff-only
	npm install
	$(MAKE) db-up db-migrate db-seed

dev: db-up db-migrate ## Servidor de desenvolvimento (PORT=3000 por padrão)
	npm run dev

build: ## Build de produção
	npm run build

start: build ## Build e servidor de produção
	npm run start

test: ## Lint, tipos, testes unitários e de integração
	npm run lint
	npm run typecheck
	npm test
	npm run test:int

# O E2E recria e altera a Pizzaria Demo: roda num banco próprio para não mexer nos dados do `make dev`.
E2E_DATABASE_URL ?= postgres://naquela:naquela@localhost:5434/naquela_mesa_e2e

e2e: export DATABASE_URL = $(E2E_DATABASE_URL)
e2e: db-up e2e-db db-migrate build ## Testes E2E (Playwright), no banco naquela_mesa_e2e
	ADMIN_PASSWORD=e2e-senha-123 npm run admin:ensure -- e2e-admin@naquelamesa.test "E2E Admin"
	CI=1 npm run test:e2e

check: test e2e ## Tudo o que o CI roda

env: ## Cria .env.local a partir do exemplo (com segredo aleatório) se ainda não existir
	@if [ ! -f .env.local ]; then \
		sed "s#^BETTER_AUTH_SECRET=.*#BETTER_AUTH_SECRET=$$(openssl rand -base64 32)#" .env.example > .env.local; \
		echo ".env.local criado"; \
	else \
		echo ".env.local já existe (mantido)"; \
	fi

db-up: ## Sobe o Postgres local (Docker); reaproveita um que já esteja na porta 5434
	@npm run db:up --silent 2>/dev/null || \
		(docker ps --format '{{.Ports}}' | grep -q ':5434->' && echo "Postgres já rodando na porta 5434 — usando o existente") || \
		(echo "Não consegui subir o Postgres. Veja: docker compose up db"; exit 1)

e2e-db: export DATABASE_URL = $(E2E_DATABASE_URL)
e2e-db: ## Cria o banco do E2E se ainda não existir
	node --import tsx scripts/ensure-database.ts

db-migrate: ## Aplica as migrações
	npm run db:migrate

db-seed: ## Recria a loja Pizzaria Demo (/pizzaria-demo) e o dono demo
	npm run seed:demo

db-studio: ## Abre o Drizzle Studio
	npm run db:studio

admin: ## Cria/promove super-admin: make admin EMAIL=voce@exemplo.com SENHA=... [NOME="Seu Nome"]
	@test -n "$(EMAIL)" -a -n "$(SENHA)" || (echo "Uso: make admin EMAIL=... SENHA=... [NOME=...]"; exit 1)
	ADMIN_PASSWORD="$(SENHA)" npm run admin:ensure -- "$(EMAIL)" "$(or $(NOME),Super Admin)"

owner: ## Vincula dono a uma loja: make owner SLUG=pizzaria-demo EMAIL=... SENHA=... [NOME=...]
	@test -n "$(SLUG)" -a -n "$(EMAIL)" -a -n "$(SENHA)" || (echo "Uso: make owner SLUG=... EMAIL=... SENHA=... [NOME=...]"; exit 1)
	npm run owner:ensure -- "$(SLUG)" "$(EMAIL)" "$(SENHA)" "$(or $(NOME),Dono da loja)"
