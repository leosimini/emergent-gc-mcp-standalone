# Multi-stage build for production MCP Server
FROM node:18-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production build
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 mcpserver

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p logs && chown mcpserver:nodejs logs

USER mcpserver

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "src/server.js"]