# Use the official Node.js runtime as the base image
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# Install dependencies based on package manifests
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source files
COPY . .

# Build the Next.js app
RUN npm run build

# Production image
FROM node:20-alpine AS release
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=base /usr/src/app/package.json ./
COPY --from=base /usr/src/app/package-lock.json ./
COPY --from=base /usr/src/app/.next ./.next
COPY --from=base /usr/src/app/public ./public
COPY --from=base /usr/src/app/next-env.d.ts ./next-env.d.ts
COPY --from=base /usr/src/app/tsconfig.json ./tsconfig.json
COPY --from=base /usr/src/app/app ./app
COPY --from=base /usr/src/app/components ./components
COPY --from=base /usr/src/app/lib ./lib

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["npm", "run", "start"]
