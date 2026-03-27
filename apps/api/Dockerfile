FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

# Install all deps (including devDeps for tsx)
RUN pnpm install --frozen-lockfile=false

# Copy source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

# Run migrations and start
CMD npx prisma migrate deploy --schema packages/db/prisma/schema.prisma && cd apps/api && node_modules/.bin/tsx src/index.ts
