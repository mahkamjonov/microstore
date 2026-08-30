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

// In-Memory & Persistent Active Supplier Debts Store
export const activeDebts: SupplierDebtRecord[] = [
  {
    id: 'debt-001',
    supplierName: 'Omonjon Aka (Guruch Ta\'minoti)',
    amount: 2500000,
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days left
    status: 'pending',
    lastNotifiedDays: null,
    telegramChatId: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'debt-002',
    supplierName: 'Sardorbek (Yog\' va Un Ombori)',
    amount: 1800000,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days left
    status: 'pending',
    lastNotifiedDays: null,
    telegramChatId: null,
    createdAt: new Date().toISOString(),
  },
];

/**
 * Calculates remaining days until due date
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
 * Core Reminder Execution Logic (Triggered by Daily Cron or Test Endpoint)
 */
export async function checkUpcomingDebtReminders(overrideChatId?: string | number) {
  const sentAlerts: Array<{ debtId: string; supplierName: string; daysLeft: number; recipientChatId: string | number }> = [];

  const pendingDebts = activeDebts.filter((d) => d.status === 'pending');

  console.log(`🔔 Executing Debt Reminder Engine check. Total pending debts: ${pendingDebts.length}`);

  for (const debt of pendingDebts) {
    const daysLeft = calculateDaysLeft(debt.dueDate);
    const recipientChatId = overrideChatId || debt.telegramChatId || getLatestChatId();

    console.log(`📌 Checking debt "${debt.supplierName}": due=${debt.dueDate}, daysLeft=${daysLeft}, lastNotified=${debt.lastNotifiedDays}`);

    // Notification condition: 3, 2, or 1 days left AND not already notified for this exact day offset
    if ([3, 2, 1].includes(daysLeft) && debt.lastNotifiedDays !== daysLeft) {
      if (!recipientChatId) {
        console.warn(`⚠️ Cannot dispatch notification for "${debt.supplierName}": No valid telegramChatId available.`);
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
        
        // Update notification state to prevent duplicate alerts
        debt.lastNotifiedDays = daysLeft;
        
        sentAlerts.push({
          debtId: debt.id,
          supplierName: debt.supplierName,
          daysLeft,
          recipientChatId,
        });

        console.log(`✅ Telegram alert sent to ChatID ${recipientChatId} for "${debt.supplierName}" (${daysLeft} days left)`);
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
}

/**
 * Initializes Background Daily Scheduler at 09:00 AM
 */
export function initDailyDebtScheduler() {
  console.log('⏰ Daily Debt Reminder Background Scheduler initialized (Check interval: 24h & startup check)...');
  
  // Initial check on server start after 5 seconds
  setTimeout(() => {
    checkUpcomingDebtReminders().catch((err) => console.error('Daily debt reminder check failed on startup:', err));
  }, 5000);

  // Daily interval check (86400000 ms)
  setInterval(() => {
    const now = new Date();
    // Run daily check at 09:00 AM server time
    if (now.getHours() === 9) {
      checkUpcomingDebtReminders().catch((err) => console.error('Daily debt reminder check failed:', err));
    }
  }, 3600000); // Check every hour
}
