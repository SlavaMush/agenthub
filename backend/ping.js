// Ping Protocol — Agent-to-Agent messaging layer
// Based on Sibyl Ping Protocol specification

const pingSessions = new Map(); // sessionId -> { ws, agentAddress, capabilities, lastPing }
const messageQueue = new Map(); // agentAddress -> { messages: [], ws }

export const pingProtocol = {
  // Handle new WebSocket connection
  handleConnection(ws, req) {
    const agentAddress = req.headers['x-agent-address'] || 'unknown';
    
    ws.agentAddress = agentAddress;
    ws.isAlive = true;
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (err) {
        console.error('Ping: Invalid message format', err);
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });
    
    ws.on('close', () => {
      this.handleDisconnect(ws);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      protocol: 'ping/1.0',
      serverTime: Date.now(),
      agentAddress
    }));
    
    console.log(`Ping: Agent ${agentAddress} connected`);
  },
  
  // Handle incoming message
  handleMessage(ws, message) {
    switch (message.type) {
      case 'register':
        this.handleRegister(ws, message);
        break;
      case 'ping':
        this.handlePing(ws, message);
        break;
      case 'pong':
        this.handlePong(ws, message);
        break;
      case 'message':
        this.handleAgentMessage(ws, message);
        break;
      case 'subscribe':
        this.handleSubscribe(ws, message);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(ws, message);
        break;
      case 'capabilities':
        this.handleCapabilities(ws, message);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${message.type}` }));
    }
  },
  
  // Agent registers with capabilities
  handleRegister(ws, message) {
    const { agentAddress, capabilities, reputationTier } = message;
    
    ws.agentAddress = agentAddress;
    ws.capabilities = capabilities || [];
    ws.reputationTier = reputationTier || 1;
    
    pingSessions.set(ws.sessionId || agentAddress, {
      ws,
      agentAddress,
      capabilities: ws.capabilities,
      reputationTier: ws.reputationTier,
      registeredAt: Date.now(),
      lastPing: Date.now()
    });
    
    // Deliver queued messages
    this.deliverQueuedMessages(agentAddress, ws);
    
    ws.send(JSON.stringify({
      type: 'registered',
      agentAddress,
      capabilities: ws.capabilities,
      reputationTier: ws.reputationTier,
      serverTime: Date.now()
    }));
    
    console.log(`Ping: Agent ${agentAddress} registered with capabilities: ${ws.capabilities.join(', ')}`);
  },
  
  // Heartbeat ping
  handlePing(ws, message) {
    const session = pingSessions.get(ws.sessionId || ws.agentAddress);
    if (session) {
      session.lastPing = Date.now();
    }
    
    ws.send(JSON.stringify({
      type: 'pong',
      requestId: message.requestId,
      serverTime: Date.now()
    }));
  },
  
  // Handle pong response
  handlePong(ws, message) {
    // Latency measurement
    const latency = Date.now() - (message.clientTime || Date.now());
    console.log(`Ping: Pong from ${ws.agentAddress}, latency: ${latency}ms`);
  },
  
  // Agent-to-agent message
  handleAgentMessage(ws, message) {
    const { to, payload, priority, ttl, signature } = message;
    
    if (!to) {
      return ws.send(JSON.stringify({ type: 'error', error: 'Missing recipient' }));
    }
    
    const outboundMessage = {
      type: 'message',
      from: ws.agentAddress,
      to,
      payload,
      priority: priority || 'normal',
      ttl: ttl || 300000, // 5 min default
      timestamp: Date.now(),
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Try direct delivery
    const recipientSession = this.findSessionByAddress(to);
    if (recipientSession && recipientSession.ws.readyState === 1) {
      recipientSession.ws.send(JSON.stringify(outboundMessage));
      ws.send(JSON.stringify({
        type: 'sent',
        messageId: outboundMessage.messageId,
        delivered: true
      }));
    } else {
      // Queue for later delivery
      this.queueMessage(to, outboundMessage);
      ws.send(JSON.stringify({
        type: 'sent',
        messageId: outboundMessage.messageId,
        delivered: false,
        queued: true
      }));
    }
  },
  
  // Subscribe to topics
  handleSubscribe(ws, message) {
    const { topics } = message;
    ws.subscriptions = ws.subscriptions || new Set();
    
    for (const topic of topics) {
      ws.subscriptions.add(topic);
    }
    
    ws.send(JSON.stringify({
      type: 'subscribed',
      topics: Array.from(ws.subscriptions)
    }));
  },
  
  handleUnsubscribe(ws, message) {
    const { topics } = message;
    if (ws.subscriptions) {
      for (const topic of topics) {
        ws.subscriptions.delete(topic);
      }
    }
    
    ws.send(JSON.stringify({
      type: 'unsubscribed',
      topics: Array.from(ws.subscriptions || [])
    }));
  },
  
  handleCapabilities(ws, message) {
    ws.capabilities = message.capabilities || [];
    
    const session = pingSessions.get(ws.sessionId || ws.agentAddress);
    if (session) {
      session.capabilities = ws.capabilities;
    }
    
    ws.send(JSON.stringify({
      type: 'capabilities_updated',
      capabilities: ws.capabilities
    }));
  },
  
  handleDisconnect(ws) {
    pingSessions.delete(ws.sessionId || ws.agentAddress);
    console.log(`Ping: Agent ${ws.agentAddress} disconnected`);
  },
  
  // Find session by agent address
  findSessionByAddress(address) {
    for (const [, session] of pingSessions) {
      if (session.agentAddress === address) {
        return session;
      }
    }
    return null;
  },
  
  // Queue message for offline agent
  queueMessage(address, message) {
    if (!messageQueue.has(address)) {
      messageQueue.set(address, { messages: [] });
    }
    const queue = messageQueue.get(address);
    queue.messages.push(message);
    
    // Limit queue size
    if (queue.messages.length > 100) {
      queue.messages.shift();
    }
  },
  
  // Deliver queued messages when agent comes online
  deliverQueuedMessages(address, ws) {
    const queue = messageQueue.get(address);
    if (queue && queue.messages.length > 0) {
      for (const message of queue.messages) {
        ws.send(JSON.stringify(message));
      }
      queue.messages = [];
      console.log(`Ping: Delivered ${queue.messages.length} queued messages to ${address}`);
    }
  },
  
  // Broadcast to all agents with capability
  broadcastToCapability(capability, message) {
    let count = 0;
    for (const [, session] of pingSessions) {
      if (session.capabilities.includes(capability) && session.ws.readyState === 1) {
        session.ws.send(JSON.stringify(message));
        count++;
      }
    }
    return count;
  },
  
  // Broadcast to tier
  broadcastToTier(minTier, message) {
    let count = 0;
    for (const [, session] of pingSessions) {
      if (session.reputationTier >= minTier && session.ws.readyState === 1) {
        session.ws.send(JSON.stringify(message));
        count++;
      }
    }
    return count;
  },
  
  // Get connected agents
  getConnectedAgents() {
    const agents = [];
    for (const [, session] of pingSessions) {
      if (session.ws.readyState === 1) {
        agents.push({
          address: session.agentAddress,
          capabilities: session.capabilities,
          reputationTier: session.reputationTier,
          connectedAt: session.registeredAt,
          lastPing: session.lastPing
        });
      }
    }
    return agents;
  },
  
  // Health check - ping all connections
  healthCheck() {
    const dead = [];
    for (const [id, session] of pingSessions) {
      if (session.ws.readyState !== 1 || !session.ws.isAlive) {
        dead.push(id);
        session.ws.terminate();
      } else {
        session.ws.isAlive = false;
        session.ws.ping();
      }
    }
    for (const id of dead) {
      pingSessions.delete(id);
    }
    return { alive: pingSessions.size, cleaned: dead.length };
  }
};

// Heartbeat interval
setInterval(() => {
  pingProtocol.healthCheck();
}, 30000); // 30 seconds

export default pingProtocol;