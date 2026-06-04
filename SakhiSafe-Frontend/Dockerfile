FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src
COPY --from=builder /app/media ./media
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/postcss.config.mjs ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/components.json ./

EXPOSE 3000

CMD ["npm", "run", "start"]
