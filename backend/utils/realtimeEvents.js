import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

// Connected SSE clients: Map of clientId -> { id, res, user }
const clients = new Map();

/**
 * Handle incoming SSE connection request
 * Route: GET /api/realtime/events
 */
export const handleSSEConnection = async (req, res) => {
  // Extract token from query or authorization header
  let token = req.query.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  let user = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.id).select('-password');
    } catch (err) {
      console.warn('SSE auth token verification failed:', err.message);
    }
  }

  // Set SSE HTTP response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'X-Accel-Buffering': 'no'
  });

  const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const clientInfo = {
    id: clientId,
    res,
    user: user ? { _id: user._id, role: user.role, name: user.name, email: user.email } : null
  };

  clients.set(clientId, clientInfo);

  // Send initial welcome/connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, status: 'connected', time: new Date() })}\n\n`);

  // Clean up on disconnect
  req.on('close', () => {
    clients.delete(clientId);
  });
};

/**
 * Broadcast an event to all connected SSE clients or filtered clients
 * @param {string} eventType - The SSE event name (e.g. 'PR_CREATED', 'PO_STATUS_CHANGED')
 * @param {object} payload - The event data to serialize into JSON
 * @param {object} [options] - Optional filter options: { targetRole, recipientId }
 */
export const broadcastRealtimeEvent = (eventType, payload, options = {}) => {
  const { targetRole, recipientId } = options;
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const [clientId, client] of clients.entries()) {
    try {
      if (targetRole && client.user && client.user.role !== targetRole) {
        continue;
      }
      if (recipientId && client.user && String(client.user._id) !== String(recipientId)) {
        continue;
      }
      client.res.write(message);
    } catch (err) {
      console.error(`Error sending SSE event to client ${clientId}:`, err.message);
      clients.delete(clientId);
    }
  }
};

// Periodic heartbeat to prevent proxies/browsers from closing idle connections
setInterval(() => {
  for (const [clientId, client] of clients.entries()) {
    try {
      client.res.write(': heartbeat\n\n');
    } catch (err) {
      clients.delete(clientId);
    }
  }
}, 25000);
