# Contribuer a Youcus

## Prerequis

- Node 20 (voir `.nvmrc`).
- npm (workspaces).
- Docker (base MySQL de developpement).

## Mise en place

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run db:up
```

## Branches

- `main` : branche stable.
- Branches de travail : `feat/...`, `fix/...`, `chore/...`, `docs/...`, `ci/...`.

## Commits conventionnels

Format : `type(portee): description`.

Types : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`.

## Avant de pousser

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Toute PR doit passer la CI (lint, types, tests, build).

## Conventions de redaction

Pas de tirets cadratins dans les documents et l'interface. Interface en francais.
