# Base image
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Builder stage
FROM base AS builder
WORKDIR /app
COPY . .
# We assume we are running from the app directory context in Railway/Render
# If running from monorepo root, adjust paths accordingly. 
# For simple app deployment, we copy the specific app source.
WORKDIR /app/stora/apps/api
RUN pnpm install
RUN pnpm build

# Runner stage
FROM base AS runner
WORKDIR /app

COPY --from=builder /app/stora/apps/api/package.json .
COPY --from=builder /app/stora/apps/api/dist ./dist
COPY --from=builder /app/stora/apps/api/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
