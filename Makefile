.DEFAULT_GOAL := help

# Docker Desktop's CLI symlink may be on PATH while its credential helper is not.
# Resolve the installed CLI directory without hard-coding a machine-specific path.
DOCKER_CLI_DIR := $(shell command -v docker | while IFS= read -r cli; do \
	while [ -L "$$cli" ]; do \
		base=$$(dirname "$$cli"); target=$$(readlink "$$cli"); \
		if [ "$${target\#/}" != "$$target" ]; then cli="$$target"; else cli="$$base/$$target"; fi; \
	done; \
	dir=$$(dirname "$$cli"); \
	if [ -x "$$dir/docker-credential-desktop" ]; then printf '%s' "$$dir"; fi; \
done)
ifneq ($(DOCKER_CLI_DIR),)
export PATH := $(PATH):$(DOCKER_CLI_DIR)
endif

COMPOSE ?= docker compose
RUN = $(COMPOSE) run --rm --no-deps -T

.PHONY: help start config build up ps stop down clean-volumes versions frontend-shell backend-shell frontend-run backend-run
.PHONY: frontend-install frontend-dev frontend-build frontend-preview
.PHONY: install backend-install backend-dev backend-build app-build test frontend-test backend-test
.PHONY: lint frontend-lint backend-lint lint-fix frontend-lint-fix backend-lint-fix
.PHONY: typecheck frontend-typecheck format-check frontend-format-check backend-format-check
.PHONY: format frontend-format backend-format check frontend-check backend-check
.PHONY: tooling-build tooling-install commitlint commits-check workflows-check
.PHONY: generate api-smoke

# Sequential recipes fail immediately; generated artifacts are committed, not regenerated in CI.
generate:
	$(COMPOSE) --profile tools build api-node api-go
	$(RUN) api-node npm ci
	$(RUN) api-node npm run generate:openapi
	$(RUN) api-node npm run generate:sdk
	$(RUN) api-go go mod download
	$(RUN) api-go go tool oapi-codegen --config ../oapi-codegen.yaml ../openapi.json

api-smoke:
	$(COMPOSE) exec -T -e API_SMOKE_URL=http://localhost:5173 frontend npm test -- src/api/health.live.test.ts

help:
	@printf '%s\n' \
	  'make start          Build images, install dependencies and start both applications' \
	  'make config         Validate Compose configuration' \
	  'make build          Build development images' \
	  'make up             Build and start development environments' \
	  'make ps             Show environment status' \
	  'make stop           Stop environments, keeping containers and caches' \
	  'make down           Remove project containers and network, keeping caches' \
	  'make clean-volumes  Remove project containers, network, dependencies and caches' \
	  'make versions       Show Node.js, npm and Go versions in containers' \
	  'make frontend-install  Install frontend dependencies from the lockfile' \
	  'make frontend-dev      Start the Vite dev server in the background' \
	  'make frontend-build    Build the frontend application' \
	  'make frontend-preview  Serve the production build (run frontend-dev first)' \
	  'make frontend-shell Open an interactive frontend container shell' \
	  'make backend-shell  Open an interactive backend container shell' \
	  'make frontend-run CMD="node --version"  Run a frontend command without TTY' \
	  'make backend-run CMD="go version"      Run a backend command without TTY'
	@printf '%s\n' \
	  'make install        Install frontend and backend dependencies from lockfiles' \
	  'make backend-dev    Start or rebuild the backend server' \
	  'make app-build      Build both applications (backend/bin/api, frontend/dist)' \
	  'make test           Run frontend and backend tests once' \
	  'make lint           Check frontend and backend with linters' \
	  'make typecheck      Check frontend TypeScript types' \
	  'make format-check   Check Prettier and gofmt without editing sources' \
	  'make check          Run all checks, tests and application builds' \
	  'make frontend-check / backend-check  Run checks for one side (CI)' \
	  'make format         Apply Prettier and gofmt to sources' \
	  'make lint-fix       Apply available ESLint and golangci-lint fixes'
	@printf '%s\n' \
	  'make tooling-build / tooling-install  Prepare commitlint in Docker' \
	  'make commitlint     Check a commit message from stdin' \
	  'make commits-check Validate history after adoption of Conventional Commits' \
	  'make workflows-check  Validate CI and release workflows with actionlint'
	@printf '%s\n' 'make generate       Generate OpenAPI, frontend SDK and Go server from TypeSpec in Docker'
	@printf '%s\n' 'make api-smoke      Check SDK against running frontend/backend (make up first)'
	@printf '%s\n' 'make migrate        Apply ordered PostgreSQL migrations (separate from API startup)' 'make database-test  Test HTTP/storage using isolated PostgreSQL database'

config:
	$(COMPOSE) config --quiet

build: config
	$(COMPOSE) build

# Keep preparation sequential, including when invoked with make -j.
start:
	$(MAKE) build
	$(MAKE) stop
	$(MAKE) install
	$(MAKE) migrate
	$(MAKE) up
	$(MAKE) ps

up: config
	$(COMPOSE) up -d --build

ps:
	$(COMPOSE) ps

stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down

clean-volumes:
	$(COMPOSE) down --volumes

versions:
	$(RUN) frontend node --version
	$(RUN) frontend npm --version
	$(RUN) backend go version
	$(RUN) backend golangci-lint version

frontend-install:
	$(RUN) frontend npm ci

frontend-dev:
	$(COMPOSE) up -d frontend

frontend-build:
	$(RUN) frontend npm run build

frontend-preview:
	$(COMPOSE) exec -T frontend npm run preview

frontend-shell:
	$(COMPOSE) run --rm --no-deps frontend sh

backend-shell:
	$(COMPOSE) run --rm --no-deps backend sh

frontend-run:
	$(if $(strip $(CMD)),,$(error Specify CMD, for example CMD="node --version"))
	$(RUN) frontend $(CMD)

backend-run:
	$(if $(strip $(CMD)),,$(error Specify CMD, for example CMD="go version"))
	$(RUN) backend $(CMD)

install: frontend-install backend-install

backend-install:
	$(RUN) backend go mod download
	$(RUN) backend go mod verify

backend-dev:
	$(COMPOSE) up -d --force-recreate backend

backend-build:
	$(RUN) backend go build -o bin/api ./cmd/api

app-build: frontend-build backend-build

frontend-test:
	$(RUN) frontend npm test

backend-test:
	$(RUN) backend go test ./...

test: frontend-test backend-test

frontend-lint:
	$(RUN) frontend npm run lint

backend-lint:
	$(RUN) backend golangci-lint run

lint: frontend-lint backend-lint

frontend-lint-fix:
	$(RUN) frontend npm run lint:fix

backend-lint-fix:
	$(RUN) backend golangci-lint run --fix

lint-fix: frontend-lint-fix backend-lint-fix

frontend-typecheck:
	$(RUN) frontend npm run typecheck

typecheck: frontend-typecheck

frontend-format-check:
	$(RUN) frontend npm run format:check

backend-format-check:
	$(RUN) backend sh -ec 'files=$$(gofmt -l cmd internal); if [ -n "$$files" ]; then printf "%s\n" "$$files"; exit 1; fi'

format-check: frontend-format-check backend-format-check

frontend-format:
	$(RUN) frontend npm run format

backend-format:
	$(RUN) backend gofmt -w cmd internal

format: frontend-format backend-format

frontend-check: frontend-lint frontend-typecheck frontend-format-check frontend-test frontend-build

backend-check: backend-lint backend-format-check backend-test backend-build

check: config frontend-check backend-check

# Tooling uses a separate profile so application startup stays lightweight.
tooling-build:
	$(COMPOSE) --profile tools build tooling

tooling-install:
	$(RUN) tooling npm ci --prefix tools

# Read a complete commit message from stdin.
commitlint:
	@$(RUN) tooling tools/node_modules/.bin/commitlint --config tools/commitlint.config.mjs

# Validate all commits since adoption; the original Hexlet history is excluded.
commits-check:
	$(RUN) tooling sh tools/check-commits.sh

workflows-check:
	docker run --rm -v "$(CURDIR):/repo:ro" -w /repo rhysd/actionlint:1.7.12 -color .github/workflows/ci.yml .github/workflows/release-please.yml

.PHONY: db-up migrate database-test

db-up:
	$(COMPOSE) up -d --wait postgres

migrate: db-up
	$(RUN) backend go run ./cmd/migrate

# Test database is a distinct service with disposable storage. No production cleanup.
database-test:
	$(COMPOSE) --profile test up -d --wait postgres-test
	$(RUN) -e DATABASE_URL=postgres://booking_test:booking_test@postgres-test:5432/booking_test?sslmode=disable backend go run ./cmd/migrate
	$(RUN) -e TEST_DATABASE_URL=postgres://booking_test:booking_test@postgres-test:5432/booking_test?sslmode=disable backend go test -count=1 -tags integration ./...
