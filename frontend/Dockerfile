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
# Deliberately below the box's RAM. A high ceiling makes an out-of-memory kill *more* likely,
# not less: V8 grows toward the limit before collecting hard, so on a small machine it
# allocates past physical memory and the kernel kills the build with no error at all. CI
# overrides this via BUILD_HEAP_MB where more memory is available.
ARG BUILD_HEAP_MB=1536
ENV NODE_OPTIONS="--max_old_space_size=$BUILD_HEAP_MB"
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
