# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY services/ai-calling/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY services/ai-calling/ ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run
CMD ["node", "dist/index.js"]
