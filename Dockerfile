FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

# ---
FROM base AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json apps/dashboard/

RUN pnpm install --frozen-lockfile

# ---
FROM base AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
# Prisma client generation requires DATABASE_URL at generate time (not runtime)
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY . .

# Explicitly generate Prisma client (postinstall may have run, but belt-and-suspenders)
RUN pnpm --filter dashboard exec prisma generate
RUN pnpm --filter dashboard build

# ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# public/ must be at the same relative path the standalone server expects
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

# standalone output mirrors monorepo structure: server.js is at apps/dashboard/server.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static

USER nextjs

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "apps/dashboard/server.js"]

# ---
FROM base AS worker-runner

WORKDIR /app

ENV NODE_ENV=production

# Worker needs all deps including tsx (devDependency used at runtime)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules

# Copy only worker-specific source directories (not all of src/) to keep image lean
COPY apps/dashboard/src/workers ./apps/dashboard/src/workers
COPY apps/dashboard/src/lib ./apps/dashboard/src/lib
COPY apps/dashboard/prisma ./apps/dashboard/prisma
COPY apps/dashboard/tsconfig.json ./apps/dashboard/tsconfig.json

# tsx runs TypeScript directly; no pre-compilation needed
CMD ["node", "--import", "tsx/esm", "apps/dashboard/src/workers/container-creation.ts"]
