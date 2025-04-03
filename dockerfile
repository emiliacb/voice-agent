FROM node:20-slim

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
RUN curl -L -o Rhubarb-Lip-Sync-1.13.0-Linux.zip https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/Rhubarb-Lip-Sync-1.13.0-Linux.zip && \
    unzip Rhubarb-Lip-Sync-1.13.0-Linux.zip && \
    chmod +x Rhubarb-Lip-Sync-1.13.0-Linux/rhubarb && \
    rm Rhubarb-Lip-Sync-1.13.0-Linux.zip

ENV PATH="/app/Rhubarb-Lip-Sync-1.13.0-Linux:${PATH}"

EXPOSE 3000
CMD ["node", "index.mjs"]
