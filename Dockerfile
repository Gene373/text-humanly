# syntax=docker/dockerfile:1

# Единый образ для деплоя на PaaS (Render, Timeweb Cloud, Railway, VPS).
# Собирает клиент и сервер в один сервис: Express раздаёт статику и API с одного origin.

# ---------- клиент ----------
FROM node:22-alpine AS client-build
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ---------- сервер ----------
FROM node:22-alpine AS server-build
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/prisma ./prisma
COPY server/prisma.config.ts ./
COPY server/tsconfig.json ./

# Генерация Prisma Client не требует подключения к БД
RUN npx prisma generate

COPY server/src ./src
RUN npx tsc --noEmit

# ---------- рантайм ----------
FROM node:22-alpine AS runtime
WORKDIR /app/server

ENV NODE_ENV=production

COPY server/package*.json ./
# tsx нужен в рантайме (запускает TypeScript напрямую)
RUN npm ci

COPY --from=server-build /app/server/src/generated ./src/generated
COPY --from=server-build /app/server/prisma ./prisma
COPY --from=server-build /app/server/prisma.config.ts ./
COPY server/src ./src

# Корневой сертификат НУЦ Минцифры (нужен для api.giga.chat)
COPY server/certs ./certs
ENV NODE_EXTRA_CA_CERTS=/app/server/certs/russian_trusted_root_ca_pem.crt

# Собранный клиент — сервер раздаёт его сам
COPY --from=client-build /app/client/dist /app/client/dist

EXPOSE 4000

# Миграции применяются при старте контейнера
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
