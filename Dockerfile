# syntax=docker/dockerfile:1

# ===== Builder Stage =====
FROM oven/bun:1.3-alpine AS builder

WORKDIR /app

# Copy package files and tsconfig
COPY package.json bun.lock tsconfig.json ./

# Install all dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY src ./src

# Build
RUN bun run build

# ===== Production Stage =====
FROM oven/bun:1.3-alpine AS runner

# Add non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 skibidoo

WORKDIR /app

# Copy package files for production dependencies
COPY package.json bun.lock ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Copy built files
COPY --from=builder --chown=skibidoo:nodejs /app/dist ./dist

# Set user
USER skibidoo

# Environment
ENV BUN_ENV=production
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Default command (can be overridden with MODE env var)
CMD ["bun", "run", "dist/index.js"]
