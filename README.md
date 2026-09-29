# Youcus

Une couche d'etude superposee a YouTube : import de playlists, lecteur sans
distraction, prise de notes Markdown synchronisees a la video, suivi de
progression. Aucun telechargement, APIs officielles Google/YouTube.

## Stack

- **Client** : Vite, React, TypeScript, TanStack Query, Tailwind CSS v3.
- **Serveur** : Express, TypeScript, Prisma, MySQL.
- **Tests** : Vitest (+ Testing Library cote client, Supertest cote serveur).
- **Outils** : Docker, GitHub Actions. Deploiement sur Sevalla.

## Structure (monorepo npm workspaces)

```
Youcus/
├── client/            # front Vite + React + TS + Tailwind
├── server/            # back Express + TS + Prisma
├── docs/              # design, contrats d'API
├── .github/workflows/ # CI (ci.yml) et CD (cd.yml)
├── docker-compose.yml # db + api/web (profils dev & prod)
└── package.json       # workspaces (client, server)
```

## Demarrage rapide

Prerequis : Node 20 (voir `.nvmrc`), npm, Docker.

```bash
npm install                 # installe les workspaces
cp .env.example .env        # variables d'environnement
npm run prisma:generate     # genere le client Prisma
npm run db:up               # lance MySQL (Docker)

# dans deux terminaux :
npm run dev                 # client  -> http://localhost:5173
npm run dev:server          # serveur -> http://localhost:4000
```

Ou en une commande (MySQL et Redis dans Docker, API et client sur la machine) :

```bash
npm run up      # ./scripts/start.sh : migrations, API, client ; « pret » seulement si tout repond
npm run down    # ./scripts/stop.sh  : arrete ce que ce depot a lance, garde le volume de la base
```

Journaux et fichiers de PID : `/tmp/youcus-dev/`.

Toute la stack en conteneurs (dev **ou** prod, un seul `docker-compose.yml`) :

Le mode est choisi via **`COMPOSE_PROFILES`** dans `.env` (lu automatiquement par
Docker Compose) — c'est le toggle dev <-> prod, sans flag `-f` :

```bash
# .env : COMPOSE_PROFILES=dev   -> db + api-dev + web-dev  (hot-reload, source montee)
# .env : COMPOSE_PROFILES=prod  -> db + api     + web      (images buildees)
docker compose up            # lance le profil actif ; la db tourne dans les deux

# ponctuel, sans editer .env :
COMPOSE_PROFILES=prod docker compose up --build
```

Dev : client -> http://localhost:5173, api -> http://localhost:4000 (ou `API_PORT`).

## Scripts racine

| Script | Role |
|--------|------|
| `npm run dev` / `dev:server` | Lance le client / le serveur |
| `npm run up` / `down` | Lance / arrete toute la stack locale (`scripts/start.sh`, `scripts/stop.sh`) |
| `npm run build` | Build client puis serveur |
| `npm run lint` / `typecheck` / `test` | Qualite sur tous les workspaces |
| `npm run prisma:generate` | Genere le client Prisma |
| `npm run db:up` / `db:down` | Demarre / arrete MySQL via Docker (workflow natif) |
| `npm run stack` | Lance toute la stack Docker selon `COMPOSE_PROFILES` (.env) |
| `npm run stack:build` | Idem en forcant le rebuild des images (profil prod) |
