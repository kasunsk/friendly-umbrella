# Multi-stage build for backend
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Copy TypeScript config files
COPY tsconfig.json ./
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/shared/tsconfig.json ./packages/shared/

# Install dependencies
RUN npm ci

# Copy Prisma schema file only (needed for client generation, exclude seed.ts)
COPY packages/backend/prisma/schema.prisma ./packages/backend/prisma/schema.prisma

# Generate Prisma Client
WORKDIR /app/packages/backend
RUN npm run db:generate

# Copy source code
WORKDIR /app
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared

# Build shared package first (dependency)
WORKDIR /app/packages/shared
RUN npm run build

# Build backend (exclude seed.ts from compilation)
WORKDIR /app/packages/backend
RUN npm run build

# Production backend image
FROM node:20-alpine AS backend

WORKDIR /app

COPY package*.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --only=production

COPY --from=backend-builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=backend-builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/backend/prisma ./packages/backend/prisma

WORKDIR /app/packages/backend

EXPOSE 8000

CMD ["node", "dist/index.js"]












