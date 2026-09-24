# Dockerfile multi-stage — Vírgula, Contábil
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Estágio de produção
FROM node:22-alpine AS runner

WORKDIR /app

# Chromium e tela virtual (Xvfb) usados pelos robôs do PGMEI e da CND
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto xvfb

ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_DIR=/app/storage
ENV DATA_DIR=/app/data
ENV CHROME_PATH=/usr/lib/chromium/chromium
# false = Chrome com janela numa tela virtual (Xvfb): passa melhor pela verificação anti-robô
ENV PGMEI_HEADLESS=false

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server

RUN mkdir -p /app/storage/cnds /app/storage/guias_mei /app/storage/relatorios /app/data/mei

EXPOSE 3000

# /app/storage: PDFs de CND, relatórios do MEI e dossiês
# /app/data: carteira multi-CNPJ e últimas consultas do MEI
VOLUME ["/app/storage", "/app/data"]

CMD ["npx", "tsx", "server.ts"]
