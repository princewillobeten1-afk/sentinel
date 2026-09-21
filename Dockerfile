# Base image with libc6-compat for alpine compatibility with native modules
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app

# Stage 1: Install all dependencies (including devDependencies needed for build)
FROM base AS deps
COPY package.json package-lock.json ./
COPY .npmrc ./
RUN npm ci --legacy-peer-deps

# Stage 2: Build Next.js application
FROM base AS builder
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Production runner
FROM base AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install production-only dependencies
COPY package.json package-lock.json ./
COPY .npmrc ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built application and required runtime files
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/next.config.mjs ./next.config.mjs
COPY --from=builder /usr/src/app/server.js ./server.js
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/app ./app
COPY --from=builder /usr/src/app/lib ./lib
COPY --from=builder /usr/src/app/components ./components
COPY --from=builder /usr/src/app/db ./db
COPY --from=builder /usr/src/app/instrumentation.ts ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/v1/health || exit 1

CMD ["node", "server.js"]
