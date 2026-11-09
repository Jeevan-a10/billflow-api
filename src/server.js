require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, getStatus } = require('./config/db');
const requestTracer = require('./middleware/requestTracer');
const { createRateLimiter } = require('./middleware/rateLimiter');
const { requireApiKey } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Route imports
const healthRoutes = require('./routes/healthRoutes');
const planRoutes = require('./routes/planRoutes');
const customerRoutes = require('./routes/customerRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const usageRoutes = require('./routes/usageRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(requestTracer);
app.use(createRateLimiter({ windowMs: 60000, max: 200 }));
app.use(requireApiKey);

// Mount API Routes
app.use('/health', healthRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/plans', planRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/usage', usageRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5002;

let server = null;

const startServer = async () => {
  await connectDB();
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      const dbStatus = getStatus();
      console.log(`[BillFlow API] Engine online at http://localhost:${PORT} (${dbStatus.mode})`);
      resolve(server);
    });
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
