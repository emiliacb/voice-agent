# Voice Agent

A web-based voice agent application with a frontend interface and backend processing capabilities.

## Project Structure

```
voice-agent/
├── frontend/           # Frontend application built with Vite
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   └── package.json
├── backend/           # Backend Node.js server
│   ├── index.mjs
│   └── package.json
├── nginx.conf        # Nginx configuration
└── dockerfile       # Docker configuration
```

## Local Development

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
node index.mjs
```

## Docker Deployment

To build and run the application using Docker:

1. Build the Docker image:
```bash
docker build --platform linux/amd64 -t voice-agent:latest .
```

3. To build the backend container:
```bash
docker build --platform linux/amd64 -f Dockerfile.backend -t voice-agent-backend:latest .
```

3. Run the combined container:
```bash
docker run --platform linux/amd64 --name voice-agent --rm -p 8080:80 voice-agent:latest
```

4. Rebuild and rerun example:
```bash
docker build --no-cache --platform linux/amd64 -t voice-agent:latest .
docker rm -f voice-agent
docker run --platform linux/amd64 --name voice-agent --rm -p 8080:80 voice-agent:latest
```

The application will be available at `http://localhost:8080`.

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0). This means:

- ✅ You are free to share and adapt this work for non-commercial purposes
- ✅ You must give appropriate credit
- ✅ You must share any derivative works under the same license
- ❌ You cannot use this work for commercial purposes

For more information, see [Creative Commons BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
