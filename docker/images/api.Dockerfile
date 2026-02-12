# Multi-stage Dockerfile for Express.js API
FROM node:20-alpine AS base
WORKDIR /app

# Development stage
FROM base AS development
COPY apps/api/package*.json ./
RUN npm install
COPY apps/api/ ./

COPY docker/scripts/api-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "dev"]

# Builder stage — compile TypeScript
FROM base AS builder
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api/ ./
RUN npm run build

# Migrations stage — has drizzle-kit + source for schema operations
FROM builder AS migrations
CMD ["sh"]

# Production stage — minimal runtime
FROM base AS production
COPY apps/api/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

# Copy migration files for runtime migrations on startup
COPY --from=builder /app/drizzle ./drizzle

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/index.js"]
