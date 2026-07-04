import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import inventoryRoutes from './routes/inventory.js';
import supplierRoutes from './routes/suppliers.js';
import purchaseRequestRoutes from './routes/purchaseRequests.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import bomRoutes from './routes/bom.js';
import materialUsageRoutes from './routes/materialUsage.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { handleEncryption } from './middleware/encryptionMiddleware.js';

// Load env vars
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // Body parser
app.use(handleEncryption);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-requests', purchaseRequestRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/material-usage', materialUsageRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(
  PORT,
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`)
);
