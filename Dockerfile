# Production Dockerfile for Clack Track
# Multi-stage build for smaller image size

# Stage 1: Build
FROM node:20-bookworm-slim AS builder

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.cjs ./
COPY public/ ./public/
COPY src/ ./src/
COPY prompts/ ./prompts/

# Build server and client
RUN npm run build

# Stage 2: Production
FROM node:20-bookworm-slim AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production dependencies only (skip prepare/husky scripts)
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy prompts (required at runtime)
COPY prompts/ ./prompts/

# Copy migrations (required for database setup)
COPY migrations/ ./migrations/

# Create non-root user
RUN groupadd -r clacktrack && useradd -r -g clacktrack clacktrack
RUN chown -R clacktrack:clacktrack /app
USER clacktrack

# Expose web server port
EXPOSE 3000

# Health check - verify server is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/').then(() => process.exit(0)).catch(() => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command - starts the server
CMD ["node", "dist/index.js"]
