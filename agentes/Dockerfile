# Se construye desde la RAÍZ del repositorio para incluir .claude/agents (las instrucciones de los agentes).
# En Railway: variable RAILWAY_DOCKERFILE_PATH=agentes/Dockerfile y sin "Root Directory".
FROM node:22-slim AS build
WORKDIR /app/agentes
COPY agentes/package.json agentes/package-lock.json ./
RUN npm ci
COPY agentes/tsconfig.json ./
COPY agentes/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app/agentes
COPY --from=build /app/agentes/node_modules ./node_modules
COPY --from=build /app/agentes/dist ./dist
COPY agentes/package.json ./
COPY .claude/agents /app/.claude/agents
USER node
CMD ["node", "dist/servidor.js"]
