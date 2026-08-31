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
import { startTelegramBotPolling, activeOtps, registeredUsers, normalizePhoneNumber } from './bot.js';
import { checkUpcomingDebtReminders, initDailyDebtScheduler, activeDebts, addNewSupplierDebt } from './services/debtReminder.js';

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
    phone: normalizePhoneNumber(phone || '+998 90 123 45 67'),
    name: name || 'Telegram Foydalanuvchisi',
    chatId: 0,
    createdAt: Date.now(),
  });

  console.log(`📌 Register OTP "${otpStr}" synced to API server memory. Total active: ${activeOtps.size}`);
  return res.status(200).json({ success: true });
});

// Real Strict OTP Code Verification Endpoint
app.post('/api/v1/auth/verify-otp', (req, res) => {
  const { code, otp, phone } = req.body;
  const receivedCode = String(code || otp || '').trim();
  const normalizedPhone = phone ? normalizePhoneNumber(String(phone)) : undefined;

  console.log(`🔍 OTP Check -> Stored active count: ${activeOtps.size} | Received Code: "${receivedCode}" | Phone: "${normalizedPhone || 'N/A'}"`);

  if (!receivedCode || receivedCode.length !== 4) {
    return res.status(400).json({
      status: 400,
      message: 'INVALID_CODE',
      error: "Kiritilgan kod xato, 4 xonali kodni to'liq kiriting.",
    });
  }

  let validRecord: { phone: string; name: string; chatId: number; role?: 'owner' | 'cashier'; storeId?: string; createdAt: number } | undefined;
  let matchedOtpKey: string | undefined;
  let phoneFoundInDb = false;

  for (const [storedCode, record] of activeOtps.entries()) {
    const recordPhone = normalizePhoneNumber(record.phone);
    if (normalizedPhone && recordPhone === normalizedPhone) {
      phoneFoundInDb = true;
    }

    // Explicit server log on code comparison as requested
    console.log(`OTP Check -> Stored: ${storedCode} | Received: ${receivedCode}`);

    if (String(storedCode).trim() === receivedCode) {
      if (!normalizedPhone || recordPhone === normalizedPhone) {
        validRecord = record;
        matchedOtpKey = storedCode;
        break;
      }
    }
  }

  // Fallback direct map lookup
  if (!validRecord && activeOtps.has(receivedCode)) {
    validRecord = activeOtps.get(receivedCode);
    matchedOtpKey = receivedCode;
  }

  // 1. Return PHONE_NOT_FOUND if phone was provided but not in DB
  if (normalizedPhone && !phoneFoundInDb && activeOtps.size > 0 && !validRecord) {
    return res.status(400).json({
      status: 400,
      message: 'PHONE_NOT_FOUND',
      error: "Ushbu telefon raqami bo'yicha aktiv tasdiqlash kodi topilmadi!",
    });
  }

  // 2. Return INVALID_CODE if code doesn't match
  if (!validRecord || !matchedOtpKey) {
    return res.status(400).json({
      status: 400,
      message: 'INVALID_CODE',
      error: "Kiritilgan 4-xonali kod xato!",
    });
  }

  // 3. Expiration Check (10 Minutes TTL)
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const isExpired = Date.now() - validRecord.createdAt > TEN_MINUTES_MS;

  if (isExpired) {
    activeOtps.delete(matchedOtpKey);
    return res.status(400).json({
      status: 400,
      message: 'CODE_EXPIRED',
      error: "Tasdiqlash kodining muddati o'tgan! Qaytadan Telegram bot orqali yangi kod oling.",
    });
  }

  // OTP is valid! Consume it from memory store
  activeOtps.delete(matchedOtpKey);

  const existingUser = registeredUsers.get(validRecord.phone) || registeredUsers.get(normalizePhoneNumber(validRecord.phone));
  const role = validRecord.role || existingUser?.role || 'owner';
  const storeId = validRecord.storeId || existingUser?.storeId || 'store_main';

  console.log(`✅ OTP "${receivedCode}" verified successfully for ${validRecord.phone} (role: ${role}, storeId: ${storeId})`);

  return res.status(200).json({
    success: true,
    is_new_user: false,
    user: {
      id: existingUser?.id || `user-${receivedCode}`,
      name: validRecord.name || existingUser?.name || 'Foydalanuvchi',
      phone: validRecord.phone,
      username: 'microstore_user',
      role: role,
      storeId: storeId,
    },
  });
});

// Daily Revenue Routes
app.get('/api/v1/revenues', authGuard, getRevenuesHandler);
app.post('/api/v1/revenues', authGuard, upsertRevenueHandler);

// Supplier Debt Routes & Sync
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

// Analytics Routes
app.get('/api/v1/analytics', authGuard, getAnalyticsHandler);

// Manual Test Endpoint for Supplier Debt Telegram Reminders
const testDebtReminderHandler = async (req: express.Request, res: express.Response) => {
  try {
    const { supplierName, amount, dueDate, telegramChatId } = req.body || {};

    // Dynamically inject a test debt if provided in request body
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
      message: "Telegram bot supplier debt reminder check executed successfully.",
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
app.post('/api/admin/test-debt-reminder', testDebtReminderHandler);
app.get('/api/admin/test-debt-reminder', testDebtReminderHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 MicroStore API Server running on port ${PORT}`);
    startTelegramBotPolling();
    initDailyDebtScheduler();
  });
}

export default app;
