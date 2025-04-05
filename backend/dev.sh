#!/bin/bash
echo "🔄 Rebuilding..."
docker stop voice-agent 2>/dev/null || true
docker rm voice-agent 2>/dev/null || true
docker build --platform linux/amd64 -t voice-agent:latest -f Dockerfile .
docker run --platform linux/amd64 --rm -p 8080:3000 --name voice-agent voice-agent:latest
