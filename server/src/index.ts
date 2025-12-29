import express from 'express';
import cors from 'cors';
import http from 'http';
import tvRoutes from './routes/tvRoutes';
import { TVWebSocketProxy } from './services/TVWebSocketProxy';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'LG TV Discovery & Proxy Service' });
});

// Routes
app.use('/api/tv', tvRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket Proxy
const wsProxy = new TVWebSocketProxy();
wsProxy.initialize(server);

server.listen(PORT, () => {
  console.log(`🚀 LG TV Discovery & Proxy Server running on port ${PORT}`);
  console.log(`📡 Discovery endpoint: http://localhost:${PORT}/api/tv/discover`);
  console.log(`🔗 WebSocket Proxy: ws://localhost:${PORT}/tv-proxy?ip=<TV_IP>&port=3001`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  wsProxy.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
