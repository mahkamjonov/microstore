import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { authGuard } from './middleware/auth.js';
import { telegramAuthHandler } from './controllers/authController.js';
import { getRevenuesHandler, upsertRevenueHandler } from './controllers/revenueController.js';
import { getSuppliersHandler, createSupplierHandler, createTransactionHandler } from './controllers/supplierController.js';
import { getAnalyticsHandler } from './controllers/analyticsController.js';
import { startTelegramBotPolling, activeOtps } from './bot.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});
app.use('/api/', apiLimiter);

// Health check ping
app.get('/api/v1/health/ping', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'MicroStore API', timestamp: new Date().toISOString() });
});

// Auth Routes
app.post('/api/v1/auth/telegram', telegramAuthHandler);

// Register generated OTP endpoint (for sync)
app.post('/api/v1/auth/register-otp', (req, res) => {
  const { otp, phone, name } = req.body;
  if (!otp || String(otp).trim().length !== 4) {
    return res.status(400).json({ success: false, error: 'Invalid OTP format' });
  }

  const otpStr = String(otp).trim();
  activeOtps.set(otpStr, {
    phone: phone || '+998 90 123 45 67',
    name: name || 'Telegram Foydalanuvchisi',
    chatId: 0,
    createdAt: Date.now(),
  });

  console.log(`📌 Register OTP "${otpStr}" synced to API server memory. Total active: ${activeOtps.size}`);
  return res.status(200).json({ success: true });
});

// Real Strict OTP Code Verification Endpoint
app.post('/api/v1/auth/verify-otp', (req, res) => {
  const { otp } = req.body;

  if (!otp || String(otp).trim().length !== 4) {
    return res.status(400).json({
      success: false,
      error: "Kiritilgan kod xato, 4 xonali kodni to'liq kiriting.",
    });
  }

  const otpStr = String(otp).trim();
  const validRecord = activeOtps.get(otpStr);

  console.log(`🔍 Checking OTP "${otpStr}". Active OTPs count: ${activeOtps.size}`);

  // Strict check: Block unverified / mock random codes
  if (!validRecord) {
    return res.status(400).json({
      success: false,
      error: "Kiritilgan kod xato yoki muddati o'tgan!",
    });
  }

  // OTP is valid! Consume it from memory store
  activeOtps.delete(otpStr);

  return res.status(200).json({
    success: true,
    is_new_user: true,
    user: {
      id: `tg-${otpStr}`,
      name: validRecord.name || 'Telegram Foydalanuvchisi',
      phone: validRecord.phone || '+998 90 123 45 67',
      username: 'microstore_user',
    },
  });
});

// Daily Revenue Routes
app.get('/api/v1/revenues', authGuard, getRevenuesHandler);
app.post('/api/v1/revenues', authGuard, upsertRevenueHandler);

// Supplier Debt Routes
app.get('/api/v1/suppliers', authGuard, getSuppliersHandler);
app.post('/api/v1/suppliers', authGuard, createSupplierHandler);
app.post('/api/v1/suppliers/:id/transaction', authGuard, createTransactionHandler);

// Analytics Routes
app.get('/api/v1/analytics', authGuard, getAnalyticsHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 MicroStore API Server running on port ${PORT}`);
    startTelegramBotPolling();
  });
}

export default app;
