FROM node:20-slim

# Install dependencies for Rhubarb
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libc6 \
    unzip \
    libsndfile1 \
    libportaudio2 \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Download and setup Rhubarb
RUN curl -L -o rhubarb.zip https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.13.0/Rhubarb-Lip-Sync-1.13.0-Linux.zip && \
    unzip rhubarb.zip && \
    mv Rhubarb-Lip-Sync-1.13.0-Linux/rhubarb /usr/local/bin/ && \
    mv Rhubarb-Lip-Sync-1.13.0-Linux/res /usr/local/bin/ && \
    chmod +x /usr/local/bin/rhubarb && \
    rm -rf Rhubarb-Lip-Sync-1.13.0-Linux* rhubarb.zip

WORKDIR /app

# Install Node.js dependencies
COPY ./package*.json ./
RUN npm install

# Copy application code
COPY ./ ./

# Expose the port your app runs on
EXPOSE 8080

# Start the application
CMD ["npm", "run", "start"]
