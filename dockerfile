FROM --platform=linux/amd64 node:20-slim

# Install dependencies for Rhubarb and curl for downloading
RUN apt-get update && apt-get install -y \
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

EXPOSE 3000
CMD ["node", "index.mjs"]
