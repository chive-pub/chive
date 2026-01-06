# =============================================================================
# Chive Documentation Dockerfile
# =============================================================================
# Simple nginx image serving pre-built static files
# Build locally with: pnpm docusaurus build
#
# Build: docker build -t chive-docs:latest -f docs/Dockerfile .
# Run:   docker run -p 8080:80 chive-docs:latest
# =============================================================================

FROM nginx:alpine

# Copy custom nginx config
COPY docs/nginx.conf /etc/nginx/conf.d/default.conf

# Copy pre-built static files
COPY docs/build /usr/share/nginx/html

# Health check (use curl with IPv4 to avoid IPv6 resolution issues)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -sf http://127.0.0.1:80/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
