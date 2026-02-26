# =============================================================
# Backend Dockerfile — Multi-Stage Build
# Stage 1: Build TypeScript (needs devDependencies)
# Stage 2: Production runtime (only production deps)
# =============================================================

# ── Stage 1: Builder ──────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY services/ai-calling/package*.json ./

# Install ALL dependencies (including devDeps for TypeScript compilation)
RUN npm ci

# Copy source code
COPY services/ai-calling/ ./

# Build TypeScript
RUN npm run build

# ── Stage 2: Production ──────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY services/ai-calling/package*.json ./

# Install production dependencies ONLY
RUN npm ci --omit=dev && npm cache clean --force

# Copy built output from builder
COPY --from=builder /app/dist ./dist

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run
CMD ["node", "dist/index.js"]
