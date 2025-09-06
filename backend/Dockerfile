FROM node:20-slim

# Install system dependencies for Rhubarb and other tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libc6 \
    unzip \
    libsndfile1 \
    libportaudio2 \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm i --only=production && npm cache clean --force

# Copy .env file only if ENV=local
RUN if [ "$ENV" = "local" ] && [ -f .env ]; then \
        echo "Copying .env file for local environment"; \
        cp .env .env.backup; \
    else \
        echo "Skipping .env file copy (ENV=$ENV)"; \
    fi

# Copy final app files
COPY . .

# Expose the port your app runs on
EXPOSE 8080

# Start the application
CMD ["npm", "run", "start"]
