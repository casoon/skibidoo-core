# syntax=docker/dockerfile:1

# Build stage
FROM node:24-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# Production stage
FROM node:24-alpine AS runner

# Add non-root user
RUN addgroup --system --gid 1001 nodejs &&     adduser --system --uid 1001 skibidoo

WORKDIR /app

# Copy built files
COPY --from=builder --chown=skibidoo:nodejs /app/dist ./dist
COPY --from=builder --chown=skibidoo:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=skibidoo:nodejs /app/package.json ./

# Set user
USER skibidoo

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3     CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Default command (can be overridden with MODE env var)
CMD ["node", "dist/index.js"]
