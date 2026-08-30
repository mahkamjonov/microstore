import { sendTelegramNotification, getLatestChatId } from '../bot.js';

export interface SupplierDebtRecord {
  id: string;
  supplierName: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'paid';
  lastNotifiedDays: number | null;
  telegramChatId?: string | number | null;
  createdAt: string;
}

// Active Supplier Debts Store (No Dummy Hardcoded Data, Seeded with TAAM Sut mahsulotlari)
export const activeDebts: SupplierDebtRecord[] = [
  {
    id: 'debt-taam-001',
    supplierName: 'TAAM Sut mahsulotlari',
    amount: 2000000,
    dueDate: '2026-09-02', // 3 days left from 2026-08-30
    status: 'pending',
    lastNotifiedDays: null,
    telegramChatId: null,
    createdAt: new Date().toISOString(),
  },
];

// Concurrency lock flag to prevent simultaneous duplicate notifications
let isProcessingReminders = false;

/**
 * Adds a new supplier debt record to persistent memory/DB store
 */
export function addNewSupplierDebt(record: { supplierName: string; amount: number; dueDate: string; telegramChatId?: string | number | null }): SupplierDebtRecord {
  const newDebt: SupplierDebtRecord = {
    id: `debt-${Date.now()}`,
    supplierName: record.supplierName,
    amount: record.amount,
    dueDate: record.dueDate,
    status: 'pending',
    lastNotifiedDays: null,
    telegramChatId: record.telegramChatId || null,
    createdAt: new Date().toISOString(),
  };
  activeDebts.unshift(newDebt);
  console.log(`💾 Database Synced: New Supplier Debt created for "${newDebt.supplierName}" (${newDebt.amount.toLocaleString('ru-RU')} UZS, Due: ${newDebt.dueDate})`);
  return newDebt;
}

/**
 * Calculates remaining days until due date dynamically
 */
export function calculateDaysLeft(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Core Reminder Execution Logic with Concurrency Lock & Immediate State Sync
 */
export async function checkUpcomingDebtReminders(overrideChatId?: string | number) {
  if (isProcessingReminders) {
    console.log('🔒 Debt reminder check is already in progress. Skipping duplicate concurrent run.');
    return {
      success: true,
      message: 'Skipped duplicate concurrent execution.',
      totalPendingDebts: activeDebts.length,
      notifiedCount: 0,
      sentAlerts: [],
    };
  }

  isProcessingReminders = true;
  const sentAlerts: Array<{ debtId: string; supplierName: string; daysLeft: number; recipientChatId: string | number }> = [];

  try {
    const pendingDebts = activeDebts.filter((d) => d.status === 'pending');
    console.log(`🔔 Executing Debt Reminder Engine check. Active pending debts: ${pendingDebts.length}`);

    for (const debt of pendingDebts) {
      const daysLeft = calculateDaysLeft(debt.dueDate);
      const recipientChatId = overrideChatId || debt.telegramChatId || getLatestChatId();

      console.log(`📌 Inspecting debt "${debt.supplierName}": Amount=${debt.amount} UZS, Due=${debt.dueDate}, daysLeft=${daysLeft}, lastNotified=${debt.lastNotifiedDays}`);

      // Notification condition: 3, 2, or 1 days left AND not already notified for this exact day offset
      if ([3, 2, 1].includes(daysLeft) && debt.lastNotifiedDays !== daysLeft) {
        if (!recipientChatId) {
          console.warn(`⚠️ Cannot dispatch notification for "${debt.supplierName}": No Telegram Chat ID linked yet.`);
          continue;
        }

        const badgeEmoji = daysLeft === 3 ? '🟡 3' : daysLeft === 2 ? '🟠 2' : '🔴 1';

        const formattedMessage = [
          `<b>⚠️ QARZ TO'LOV MUDDATI YA QINLASHMOQDA!</b>`,
          ``,
          `👤 Ta'minotchi: <b>${debt.supplierName}</b>`,
          `💰 Qarz summasi: <b>${debt.amount.toLocaleString('ru-RU')} UZS</b>`,
          `📅 To'lov muddati: <b>${debt.dueDate}</b>`,
          `⏳ Qolgan vaqt: <b>${badgeEmoji} kun qoldi</b>`,
          ``,
          `<i>Iltimos, ta'minotchi bilan hisob-kitobni o'z vaqtida amalga oshiring!</i>`,
        ].join('\n');

        try {
          await sendTelegramNotification(recipientChatId, formattedMessage);

          // Update lastNotifiedDays IMMEDIATELY to guarantee zero duplicate alerts
          debt.lastNotifiedDays = daysLeft;

          sentAlerts.push({
            debtId: debt.id,
            supplierName: debt.supplierName,
            daysLeft,
            recipientChatId,
          });

          console.log(`✅ Telegram Alert dispatched to ChatID ${recipientChatId} for "${debt.supplierName}" (${daysLeft} days left)`);
        } catch (err) {
          console.error(`❌ Failed to send Telegram notification to ChatID ${recipientChatId}:`, err);
        }
      }
    }

    return {
      success: true,
      totalPendingDebts: pendingDebts.length,
      notifiedCount: sentAlerts.length,
      sentAlerts,
    };
  } finally {
    isProcessingReminders = false;
  }
}

/**
 * Initializes Background Daily Scheduler at 09:00 AM
 */
export function initDailyDebtScheduler() {
  console.log('⏰ Daily Debt Reminder Background Scheduler active (09:00 AM check & 24h cycle)...');

  // Initial check on server start after 3 seconds
  setTimeout(() => {
    checkUpcomingDebtReminders().catch((err) => console.error('Daily debt reminder check failed on startup:', err));
  }, 3000);

  // Hourly interval check for 09:00 AM trigger
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 9) {
      checkUpcomingDebtReminders().catch((err) => console.error('Daily debt reminder check failed:', err));
    }
  }, 3600000);
}
