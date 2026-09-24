# Dockerfile multi-stage para AuditaCNPJ / Carbono
FROM node:22-alpine AS builder

WORKDIR /app

# Dependências de compilação
COPY package*.json ./
RUN npm install

# Código fonte
COPY . .

# Build do frontend React + Vite
RUN npm run build

# Estágio de Produção
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_DIR=/app/storage
ENV DATA_DIR=/app/data

# Copiar dependências e código compilado
COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/node_modules ./node_modules

# Criar estrutura de diretórios para montagem de volumes
RUN mkdir -p /app/storage/cnds /app/storage/guias_mei /app/storage/relatorios /app/data

# Expor porta 3000
EXPOSE 3000

# Volumes montados para persistência:
# /app/storage: Armazenamento dos PDFs de CNDs, DAS do MEI e Dossiês
# /app/data: Base de dados da carteira Multi-CNPJ
VOLUME ["/app/storage", "/app/data"]

# Iniciar servidor
CMD ["npx", "tsx", "server.ts"]
