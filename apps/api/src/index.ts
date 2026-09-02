import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { authGuard } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import { getRevenuesHandler, upsertRevenueHandler } from './controllers/revenueController.js';
import { getSuppliersHandler, createSupplierHandler, createTransactionHandler } from './controllers/supplierController.js';
import { getAnalyticsHandler } from './controllers/analyticsController.js';
import { getStoresHandler, createStoreHandler, deleteStoreHandler } from './controllers/storeController.js';
import { checkUpcomingDebtReminders, initDailyDebtScheduler, activeDebts, addNewSupplierDebt } from './services/debtReminder.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Express CORS Configuration (compliant for Netlify, Local, and Mobile)
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Tx-Id', 'Accept', 'X-Store-Id', 'x-store-id'],
  credentials: true,
}));
app.options('*', cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});
app.use('/api/', apiLimiter);

// Health check ping (Public)
app.get('/api/v1/health/ping', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'MicroStore Direct Auth API', timestamp: new Date().toISOString() });
});

// Authentication Routes Router (Public /register & /login + Protected /cashiers)
app.use('/api/v1/auth', authRouter);
app.use('/api/auth', authRouter);

// Store Management Routes (Protected)
app.get('/api/v1/stores', authGuard, getStoresHandler);
app.get('/api/stores', authGuard, getStoresHandler);
app.post('/api/v1/stores', authGuard, createStoreHandler);
app.post('/api/stores', authGuard, createStoreHandler);
app.delete('/api/v1/stores/:id', authGuard, deleteStoreHandler);
app.delete('/api/stores/:id', authGuard, deleteStoreHandler);

// Daily Revenue Routes (Protected)
app.get('/api/v1/revenues', authGuard, getRevenuesHandler);
app.post('/api/v1/revenues', authGuard, upsertRevenueHandler);

// Supplier Debt Routes & Sync (Protected)
app.get('/api/v1/suppliers', authGuard, getSuppliersHandler);
app.post('/api/v1/suppliers', authGuard, createSupplierHandler);
app.post('/api/v1/suppliers/:id/transaction', authGuard, createTransactionHandler);

const createDebtSyncHandler = (req: express.Request, res: express.Response) => {
  const { supplierName, name, amount, currentBalance, dueDate, phone, telegramChatId } = req.body || {};
  const sName = supplierName || name;
  const sAmount = amount || currentBalance || 0;

  if (!sName || !dueDate) {
    return res.status(400).json({ success: false, error: 'supplierName and dueDate are required' });
  }

  const debt = addNewSupplierDebt({
    supplierName: String(sName).trim(),
    amount: parseFloat(sAmount) || 0,
    dueDate: String(dueDate).trim(),
    telegramChatId,
  });

  return res.status(201).json({
    success: true,
    message: "Yangi ta'minotchi qarzi bazaga saqlandi va sinxronlandi",
    data: debt,
  });
};

app.post('/api/v1/suppliers/create-debt', createDebtSyncHandler);
app.post('/api/debts', createDebtSyncHandler);

// Analytics Routes (Protected)
app.get('/api/v1/analytics', authGuard, getAnalyticsHandler);

// Manual Test Endpoint for Supplier Debt Reminders
const testDebtReminderHandler = async (req: express.Request, res: express.Response) => {
  try {
    const { supplierName, amount, dueDate, telegramChatId } = req.body || {};

    if (supplierName && amount && dueDate) {
      activeDebts.unshift({
        id: `debt-test-${Date.now()}`,
        supplierName: String(supplierName).trim(),
        amount: parseFloat(amount) || 1000000,
        dueDate: String(dueDate).trim(),
        status: 'pending',
        lastNotifiedDays: null,
        telegramChatId: telegramChatId || null,
        createdAt: new Date().toISOString(),
      });
      console.log(`➕ Test Debt added for "${supplierName}" (dueDate: ${dueDate})`);
    }

    const result = await checkUpcomingDebtReminders(telegramChatId);
    return res.status(200).json({
      message: "Supplier debt reminder check executed successfully.",
      ...result,
      allActiveDebts: activeDebts,
    });
  } catch (err: any) {
    console.error('Debt reminder test endpoint error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/v1/admin/test-debt-reminder', testDebtReminderHandler);
app.get('/api/v1/admin/test-debt-reminder', testDebtReminderHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 MicroStore Direct Auth API Server running on port ${PORT}`);
    initDailyDebtScheduler();
  });
}

export default app;
