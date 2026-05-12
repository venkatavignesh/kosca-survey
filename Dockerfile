# syntax=docker/dockerfile:1.6
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci --prefer-offline; else npm install --prefer-offline; fi

FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Tools stage: prisma + tsx + bcryptjs for migrate/seed at runtime ----
# Built independently of source so it's cached across normal code changes.
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS tools
WORKDIR /tools
RUN --mount=type=cache,target=/root/.npm \
    npm init -y >/dev/null \
 && npm install --no-audit --no-fund --omit=dev --no-package-lock --prefer-offline \
      prisma@7.8.0 @prisma/client@7.8.0 @prisma/adapter-pg@7.8.0 \
      pg@8.20.0 tsx@4.21.0 bcryptjs@3.0.3 dotenv@17.4.2

# ---- Runner ----
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl postgresql-client tini bash tzdata \
 && cp /usr/share/zoneinfo/Asia/Kolkata /etc/localtime \
 && echo Asia/Kolkata > /etc/timezone
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Kolkata

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Tools FIRST (rarely changes -> stays cached on most rebuilds)
COPY --from=tools /tools /app/tools

# Then app artifacts (changes on every code edit)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh \
 && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

ENTRYPOINT ["/sbin/tini", "--", "/docker-entrypoint.sh"]
CMD ["node", "server.js"]
