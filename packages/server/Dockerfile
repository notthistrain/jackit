# Stage 1: Compile native dependencies (better-sqlite3)
#
# Prerequisites: This Dockerfile expects pre-built artifacts:
#   - packages/server/dist/  (TypeScript compiled via `mwtsc`)
#   - packages/admin/dist/   (Astro frontend built via `astro build`)
# Run `deploy.sh` or use GitHub CI to build these first.
#
FROM node:18-alpine AS deps

RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /build

# Copy workspace config and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json packages/server/pnpm-workspace.yaml ./packages/server/
COPY packages/admin/package.json ./packages/admin/

# Export standalone node_modules via pnpm deploy (includes install + compile)
RUN pnpm deploy --prod --filter @upgrade-component/server /deploy

# Stage 2: Runtime
FROM node:18-alpine

RUN apk add --no-cache libstdc++

WORKDIR /app

# Copy standalone node_modules from deploy output
COPY --from=deps /deploy/node_modules ./node_modules
# Copy pre-built application artifacts
COPY packages/server/dist ./dist
COPY packages/server/bootstrap.js ./
COPY packages/admin/dist ./admin
COPY packages/server/config.example.toml ./config.example.toml

EXPOSE 7001

CMD ["node", "./bootstrap.js"]
