FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts ./
# ponytail: stub DATABASE_URL — prisma config loader requires it, generate doesn't connect
RUN DATABASE_URL="postgresql://stub:stub@stub:5432/stub" npx prisma generate

FROM deps AS builder
WORKDIR /app
# ponytail: NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
# Pass as ARG so docker-compose build.args can override per-env.
ARG NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
ENV NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=$NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED
ARG NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=""
ENV NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=$NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
ARG NEXT_PUBLIC_MIDTRANS_ENV="sandbox"
ENV NEXT_PUBLIC_MIDTRANS_ENV=$NEXT_PUBLIC_MIDTRANS_ENV
# ponytail: SW cache VERSION — deterministic per commit when the deployer passes
# `--build-arg SW_VERSION=$(git rev-parse --short HEAD)`. Empty (.git excluded
# from context) → scripts/gen-sw-version.mjs falls back to a build timestamp,
# so every deploy still auto-invalidates returning PWAs.
ARG SW_VERSION=""
ENV SW_VERSION=$SW_VERSION
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/app/generated ./app/generated
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "server.js"]
