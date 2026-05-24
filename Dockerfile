# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# ---- deps: install node_modules into a cached layer ----
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

# ---- dev: bind-mounted source, hot reload ----
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
# pnpm install on boot is near-instant when node_modules + lockfile already match;
# it self-heals if a teammate added a dep.
CMD ["sh", "-c", "pnpm install --prefer-offline && pnpm prisma generate && pnpm dev"]

# ---- builder: produce a built Next.js app ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm prisma generate
RUN pnpm build

# ---- prod: minimal runtime image ----
FROM base AS prod
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Copy the entire built app — `next start` reads from .next/, public/, and the
# Prisma client out of node_modules. Tradeoff: image is larger (~500 MB) than a
# standalone build (~150 MB), but the layout matches dev so debugging is easier.
COPY --from=builder /app ./
EXPOSE 3000
# At boot: apply pending migrations (idempotent) then start the production server.
# instrumentation.ts will bootstrap the first admin from ADMIN_EMAIL/ADMIN_PASSWORD.
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm start"]
