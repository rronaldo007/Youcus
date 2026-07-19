# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
# openssl requis par les moteurs Prisma sur Alpine (musl).
RUN apk add --no-cache openssl
COPY package.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
# openssl requis par les moteurs Prisma (migrate deploy + requetes) sur Alpine.
RUN apk add --no-cache openssl
ENV NODE_ENV=production
# Port ecoute par le serveur (aligne sur l'ingress Sevalla par defaut).
ENV PORT=8080
COPY package.json ./
# On reprend les dependances du build (client Prisma genere + CLI prisma
# necessaire a `prisma migrate deploy` au demarrage en prod).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
EXPOSE 8080
# Applique les migrations puis demarre l'API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
