# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./

# Генерируем Prisma Client (подключение к БД не требуется)
RUN npx prisma generate

COPY src ./src
RUN npx tsc --noEmit

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
# tsx нужен в рантайме (запускает TypeScript напрямую), поэтому ставим все зависимости
RUN npm ci

COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY src ./src

# Корневой сертификат НУЦ Минцифры (нужен для api.giga.chat)
COPY certs ./certs
ENV NODE_EXTRA_CA_CERTS=/app/certs/russian_trusted_root_ca_pem.crt

EXPOSE 4000

# Миграции применяются при старте контейнера
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
