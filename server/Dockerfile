# Build context = repository root (YC-11): the image builds the client too and the API serves
# it, so front and API share one origin and the session cookie is first-party on mobile.
#   docker build -f server/Dockerfile .

# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
# openssl requis par les moteurs Prisma sur Alpine (musl).
RUN apk add --no-cache openssl
# VERSIO[N]: the file exists only once deploy.sh has released (YC-106); package.json keeps the
# COPY valid when it does not.
COPY package.json package-lock.json VERSIO[N] ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY client client
COPY server server
# The client calls the API on its own origin.
RUN VITE_API_URL=/api npm run build --workspace client
RUN cd server && npx prisma generate && npm run build

# --- runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
# openssl requis par les moteurs Prisma (migrate deploy + requetes) sur Alpine.
RUN apk add --no-cache openssl
ENV NODE_ENV=production
# Port ecoute par le serveur (aligne sur l'ingress Sevalla par defaut).
ENV PORT=8080
ENV CLIENT_DIST=/app/client/dist
# Dependencies from the build (generated Prisma client + prisma CLI needed by
# `prisma migrate deploy` at start). Workspaces hoist them to /app/node_modules.
# VERSION sits at /app, one level above WORKDIR: /api/health reads it (YC-106).
COPY --from=build /app/package.json /app/VERSIO[N] ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
WORKDIR /app/server
EXPOSE 8080
# Applique les migrations puis demarre l'API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
