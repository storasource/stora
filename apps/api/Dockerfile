# Base image
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Builder stage
FROM base AS builder
WORKDIR /app
COPY . .
WORKDIR /app/stora/apps/api
# Force independent install to ensure local node_modules
RUN pnpm install --config.recursive-install=false
RUN pnpm build

# Runner stage
FROM base AS runner
WORKDIR /app

# Copy package.json and install PROD dependencies only
COPY --from=builder /app/stora/apps/api/package.json .
# Use npm for final install to avoid pnpm workspace complexity in final image
RUN npm install --omit=dev

# Copy built artifacts
COPY --from=builder /app/stora/apps/api/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
