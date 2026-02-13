# Multi-stage Dockerfile for Next.js
# Stage 1: Base
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY apps/nextjs/package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Development
FROM base AS development
COPY apps/nextjs/package*.json ./
RUN npm install
COPY apps/nextjs/ ./
COPY VERSION /etc/app-version

# Copy entrypoint
COPY docker/scripts/nextjs-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "dev"]

# Stage 3: Builder
FROM base AS builder
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY apps/nextjs/package*.json ./
RUN npm ci
COPY apps/nextjs/ ./
COPY VERSION /etc/app-version
RUN npm run build

# Stage 4: Production
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
