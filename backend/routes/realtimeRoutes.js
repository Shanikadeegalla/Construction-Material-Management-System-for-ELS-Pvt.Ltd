import express from 'express';
import { handleSSEConnection } from '../utils/realtimeEvents.js';

const router = express.Router();

// SSE subscription endpoint: GET /api/realtime/events?token=...
router.get('/events', handleSSEConnection);

export default router;
