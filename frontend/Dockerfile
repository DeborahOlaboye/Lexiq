FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_ vars must be present at build time — passed from docker-compose args
ARG NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID
# lib/contracts.ts is imported by client components, so this is baked into the browser
# bundle. Supplied only at runtime it stays the zero-address fallback and every read fails.
ARG NEXT_PUBLIC_LEXIQ_ADDRESS
ENV NEXT_PUBLIC_LEXIQ_ADDRESS=$NEXT_PUBLIC_LEXIQ_ADDRESS
ENV NODE_OPTIONS="--max_old_space_size=3072"
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
