FROM node:22-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS runner

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app
RUN groupadd --system uocc && useradd --system --gid uocc uocc

COPY --from=builder --chown=uocc:uocc /app/.next/standalone ./
COPY --from=builder --chown=uocc:uocc /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER uocc
EXPOSE 3000
CMD ["node", "server.js"]
