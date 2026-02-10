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

# Production stage
FROM base AS production
COPY apps/api/package*.json ./
RUN npm ci --only=production
COPY apps/api/ ./

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "start"]
