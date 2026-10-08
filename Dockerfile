# As Aventuras do Piper — imagem Docker (Epiper Tecnologia)
# Etapa 1: instala as dependências (better-sqlite3 é nativo; as ferramentas de build
# só entram aqui, caso o binário pronto não exista para o processador da VPS).
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Etapa 2: imagem final, pequena, sem ferramentas de build
FROM node:20-bookworm-slim
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data XP_RATE=2
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js ./
COPY public ./public
# os personagens ficam em /data (volume), fora da imagem: atualizar o jogo não apaga ninguém
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
