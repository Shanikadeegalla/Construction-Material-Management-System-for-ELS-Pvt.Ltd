import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import inventoryRoutes from './routes/inventory.js';
import supplierRoutes from './routes/suppliers.js';
import purchaseRequestRoutes from './routes/purchaseRequests.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import bomRoutes from './routes/bom.js';
import materialUsageRoutes from './routes/materialUsage.js';
import notificationRoutes from './routes/notifications.js';
import projectRoutes from './routes/projectRoutes.js';
import materialRoutes from './routes/materials.js';
import siteInventoryRoutes from './routes/siteInventoryRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import itemMasterRoutes from './routes/itemMasterRoutes.js';
import materialIssuanceRoutes from './routes/materialIssuanceRoutes.js';
import quotationRoutes from './routes/quotations.js';
import invoiceRoutes from './routes/invoices.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { stripeWebhookHandler } from './controllers/paymentController.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { handleEncryption } from './middleware/encryptionMiddleware.js';

// Load env vars
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middlewares
app.use(cors());

// Stripe requires the raw request body to verify webhook signatures, so this
// route must be registered before express.json() parses the body.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json()); // Body parser
app.use(handleEncryption);

// Serve static uploads
app.use('/uploads', express.static(path.resolve('uploads')));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-requests', purchaseRequestRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/material-usage', materialUsageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/item-master', itemMasterRoutes);
app.use('/api/min', materialIssuanceRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', siteInventoryRoutes);

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
