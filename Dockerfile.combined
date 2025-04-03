FROM node:20-slim AS backend

# Install dependencies for Rhubarb and curl for downloading
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libc6 \
    unzip \
    libsndfile1 \
    libportaudio2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node.js dependencies
COPY backend/package*.json ./
RUN npm install

# Copy application code
COPY backend/ ./

# Download and setup Rhubarb
RUN curl -L -o rhubarb.zip https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/Rhubarb-Lip-Sync-1.13.0-Linux.zip && \
    unzip rhubarb.zip && \
    mv Rhubarb-Lip-Sync-1.13.0-Linux/rhubarb /usr/local/bin/ && \
    mv Rhubarb-Lip-Sync-1.13.0-Linux/res /usr/local/bin/ && \
    chmod +x /usr/local/bin/rhubarb && \
    rm -rf Rhubarb-Lip-Sync-1.13.0-Linux* rhubarb.zip

# Build frontend
FROM node:20-slim AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm install vite@latest
RUN npm run build

# Final stage
FROM ubuntu:22.04

# Install Node.js
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends \
    nodejs \
    nginx \
    libc6 \
    libsndfile1 \
    libportaudio2 \
    && rm -rf /var/lib/apt/lists/*

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy frontend build and static files
COPY --from=frontend /frontend/dist /usr/share/nginx/html/
COPY --from=frontend /frontend/public /usr/share/nginx/html/public

# Copy backend and its node_modules
COPY --from=backend /app /app
COPY --from=backend /usr/local/bin/rhubarb /usr/local/bin/rhubarb
COPY --from=backend /usr/local/bin/res /usr/local/bin/res

# Configure nginx
RUN mkdir -p /var/log/nginx /var/cache/nginx && \
    chown -R www-data:www-data /var/log/nginx /var/cache/nginx /usr/share/nginx/html && \
    ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log

WORKDIR /app

# Expose port 80
EXPOSE 80

# Start both nginx and the Node.js backend
CMD ["sh", "-c", "service nginx start && NODE_ENV=production node index.mjs"]
