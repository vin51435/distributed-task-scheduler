.PHONY: up down logs build lint test format wait-for-db

up:
	docker compose -f docker/compose/dev.yml up -d

up-infra:
	docker compose -f docker/compose/base.yml -f docker/compose/infra.yml up -d

down:
	docker compose -f docker/compose/dev.yml down

logs:
	docker compose -f docker/compose/dev.yml logs -f

build:
	npx nx run-many -t build

lint:
	npx nx run-many -t lint

test:
	npx nx run-many -t test

format:
	npx prettier --write "**/*.{ts,js,json,md,yml,yaml}"

format-check:
	npx prettier --check "**/*.{ts,js,json,md,yml,yaml}"

typecheck:
	npx tsc --noEmit -p tsconfig.base.json

wait-for-db:
	npx ts-node tools/scripts/wait-for-db.ts
