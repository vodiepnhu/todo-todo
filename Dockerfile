FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY tgtd-AI-RAG/package.json tgtd-AI-RAG/package.json
COPY tgtd-Agent/package.json tgtd-Agent/package.json
COPY tgtd-Backend/package.json tgtd-Backend/package.json
COPY tgtd-Frontend/package.json tgtd-Frontend/package.json

RUN npm ci

FROM deps AS seed

ENV NODE_ENV=development \
    ENABLE_LOCAL_DEMO_ACCOUNT=true

COPY . .

CMD ["sh", "-c", "npm --workspace tgtd-Backend run seed:demo && npm --workspace tgtd-Backend run seed:demo-data"]

FROM deps AS builder

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
ARG NEXT_PUBLIC_ENABLE_LOCAL_DEMO_ACCOUNT=false
ARG NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY

ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED} \
    NEXT_PUBLIC_ENABLE_LOCAL_DEMO_ACCOUNT=${NEXT_PUBLIC_ENABLE_LOCAL_DEMO_ACCOUNT} \
    NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY}

COPY . .

RUN npm run build:webpack

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/tgtd-Frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/tgtd-Frontend/.next/static ./tgtd-Frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/tgtd-Frontend/public ./tgtd-Frontend/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "tgtd-Frontend/server.js"]
