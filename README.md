# Voice Agent

A web-based voice agent application with a frontend interface and backend processing capabilities.

[https://voice-agent-front.onrender.com/](https://voice-agent-front.onrender.com/)

## Project Structure

```
voice-agent/
├── frontend/
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   └── package.json
├── backend/
│   ├── index.mjs
│   ├── Dockerfile
│   ├── dev.sh
│   └── package.json
└── .gitignore
```

## Architecture

The application consists of three main components:

### Frontend (`/frontend`)
- **Vite-based** vanilla web application
- **Pure CSS animations** for lip-sync visualization
- **Real-time audio processing** with Web Audio API

### Backend (`/backend`)
- **Hono.js** lightweight web framework
- **Docker** for easy deployment
- **Rate limiting** with IP and route-based protection
- **CORS configuration** for secure cross-origin requests

## Local Development

### Requirements

- Node.js (v18+)
- Docker (v20+)

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend

We provide a development script that automatically rebuilds and restarts the container when you make changes to the backend code:

```bash
# Make the script executable (first time only)
chmod +x dev.sh

# Start development mode
./dev.sh
```

This will:
- Build the Docker container
- Start it in the foreground showing all logs
- Automatically rebuild and restart when you make changes
- Make the service available at http://localhost:8080

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0). This means:

- ✅ You are free to share and adapt this work for non-commercial purposes
- ✅ You must give appropriate credit
- ✅ You must share any derivative works under the same license
- ❌ You cannot use this work for commercial purposes

For more information, see [Creative Commons BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
