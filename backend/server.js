import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
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
import materialRequestRoutes from './routes/materialRequestRoutes.js';
import materialTransferNoteRoutes from './routes/materialTransferNoteRoutes.js';
import quotationRoutes from './routes/quotations.js';
import invoiceRoutes from './routes/invoices.js';
import paymentRoutes from './routes/paymentRoutes.js';
import materialCategoryRoutes from './routes/materialCategoryRoutes.js';
import { fileURLToPath } from 'url';
import { handleWebhook } from './controllers/paymentController.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { handleEncryption } from './middleware/encryptionMiddleware.js';
import { UPLOAD_DIR } from './config/uploadDir.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to Database
connectDB();

const app = express();

// Middlewares
// CORS_ORIGIN may hold a comma-separated allow-list (e.g. the deployed
// frontend URL); when unset every origin is allowed, as in local development.
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));

// Stripe requires the raw request body to verify webhook signatures, so this
// route must be registered before express.json() parses the body.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json()); // Body parser
app.use(handleEncryption);

// Serve static uploads using absolute path independent of Node launch directory
app.use('/uploads', express.static(UPLOAD_DIR));
console.log(`Serving uploads from: ${UPLOAD_DIR}`);


// Mount routes
app.use('/api/auth', authRoutes);
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
app.use('/api/material-requests', materialRequestRoutes);
app.use('/api/material-transfer-notes', materialTransferNoteRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/material-categories', materialCategoryRoutes);
app.use('/api', siteInventoryRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// On Vercel the app is invoked as a serverless function (see the default
// export below) and must not bind a port itself.
if (!process.env.VERCEL) {
  app.listen(
    PORT,
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`)
  );
}

export default app;
