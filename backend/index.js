import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

import { memoryRoutes } from './routes/memory.js';
import { serviceRoutes } from './routes/services.js';
import { agentRoutes } from './routes/agents.js';
import { x402Middleware, x402Routes } from './x402.js';
import { pingProtocol } from './ping.js';
import { reputationRoutes } from './routes/reputation.js';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    version: '1.0.0',
    chain: 'base-sepolia'
  });
});

// API Routes
app.use('/api/memory', memoryRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/reputation', reputationRoutes);
app.use('/api/x402', x402Routes);

app.use('/api/paid', x402Middleware);
app.get('/api/paid/quote', (req, res) => {
  res.json({
    ok: true,
    chain: 'base-sepolia',
    payer: req.x402?.from || null,
    txHash: req.x402?.txHash || null,
    settled: Boolean(req.x402?.submitted),
  });
});

// WebSocket for Ping Protocol
wss.on('connection', (ws, req) => {
  console.log('Ping Protocol: New WebSocket connection');
  pingProtocol.handleConnection(ws, req);
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  AgentHub Backend — Base Sepolia                              ║
║  Port: ${PORT}                                                  ║
║  x402: Enabled | Ping Protocol: Active                       ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export { app, server, wss };