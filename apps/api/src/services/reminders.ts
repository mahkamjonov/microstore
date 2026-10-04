import { prisma, Prisma } from '@microstore/database';
import { escapeHtml, isBotEnabled, sendMessage, TelegramError, webAppKeyboard } from './telegram.js';

// Reminders go out once a day, after this local (Tashkent, UTC+5) hour.
export const REMINDER_HOUR = 21;
// Debts are reminded about from this many days before their due date.
export const DEBT_REMINDER_DAYS = 7;

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const MAX_LIST_ITEMS = 25;
const LOG_RETENTION_DAYS = 45;

export function localParts(now: Date) {
  const local = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  return { date: local.toISOString().slice(0, 10), hour: local.getUTCHours() };
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

const money = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');

export interface DebtReminderItem {
  supplierName: string;
  storeName: string;
  amount: number;
  dueDate: string;
  daysLeft: number;
}

export function buildRevenueReminderText(storeNames: string[]): string {
  if (storeNames.length === 1) {
    return `📊 <b>Bugungi tushum kiritilmadi</b>\n\n«${escapeHtml(storeNames[0])}» do'konining bugungi tushumi hali ilovada kiritilmagan. Iltimos, kiritib qo'ying.`;
  }

  const shown = storeNames.slice(0, MAX_LIST_ITEMS).map((name) => `• ${escapeHtml(name)}`);
  const more = storeNames.length > MAX_LIST_ITEMS ? `\n… va yana ${storeNames.length - MAX_LIST_ITEMS} ta` : '';
  return `📊 <b>Bugungi tushum kiritilmadi</b>\n\nQuyidagi do'konlarda bugungi tushum hali kiritilmagan:\n${shown.join('\n')}${more}\n\nIltimos, ilovada kiritib qo'ying.`;
}

function debtStatus(daysLeft: number) {
  if (daysLeft < 0) return { icon: '🔴', label: `muddati ${-daysLeft} kun oldin o'tgan` };
  if (daysLeft === 0) return { icon: '🔴', label: "bugun to'lash kerak" };
  if (daysLeft === 1) return { icon: '🟠', label: "ertaga to'lash kerak" };
  if (daysLeft <= 3) return { icon: '🟠', label: `${daysLeft} kun qoldi` };
  return { icon: '🟡', label: `${daysLeft} kun qoldi` };
}

export function buildDebtReminderText(items: DebtReminderItem[], showStore: boolean): string {
  const sorted = [...items].sort((a, b) => a.daysLeft - b.daysLeft || a.supplierName.localeCompare(b.supplierName));
  const lines = sorted.slice(0, MAX_LIST_ITEMS).map((item) => {
    const { icon, label } = debtStatus(item.daysLeft);
    const store = showStore ? ` (${escapeHtml(item.storeName)})` : '';
    return `${icon} <b>${escapeHtml(item.supplierName)}</b>${store} — ${money(item.amount)} so'm\n    📅 ${item.dueDate} · ${label}`;
  });
  const more = sorted.length > MAX_LIST_ITEMS ? `\n… va yana ${sorted.length - MAX_LIST_ITEMS} ta` : '';
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return `💳 <b>Ta'minotchi qarzlari muddati yaqin</b>\n\n${lines.join('\n\n')}${more}\n\n<b>Jami:</b> ${money(total)} so'm`;
}

type RecipientUser = { id: string; storeId: string; role: string; firstName: string; telegramChatId: string | null };
type StoreRef = { id: string; name: string };

export function getUserStores(user: { id: string; storeId: string; role: string }): Promise<StoreRef[]> {
  if (user.role === 'cashier') {
    return prisma.store.findMany({ where: { id: user.storeId }, select: { id: true, name: true } });
  }
  return prisma.store.findMany({
    where: { OR: [{ ownerId: user.id }, { users: { some: { id: user.id } } }] },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function findStoresMissingRevenue(stores: StoreRef[], date: string): Promise<StoreRef[]> {
  if (stores.length === 0) return [];
  const entered = await prisma.dailyRevenue.findMany({
    where: { storeId: { in: stores.map((s) => s.id) }, entryDate: date, isArchived: false },
    select: { storeId: true },
  });
  const enteredIds = new Set(entered.map((r) => r.storeId));
  return stores.filter((s) => !enteredIds.has(s.id));
}

export async function findUrgentDebts(stores: StoreRef[], today: string): Promise<DebtReminderItem[]> {
  if (stores.length === 0) return [];
  const storeNames = new Map(stores.map((s) => [s.id, s.name]));

  const debts = await prisma.supplierDebt.findMany({
    where: {
      status: 'pending',
      dueDate: { not: '' },
      supplier: { storeId: { in: stores.map((s) => s.id) }, isArchived: false },
    },
    include: { supplier: { select: { name: true, storeId: true } } },
  });

  const items: DebtReminderItem[] = [];
  for (const debt of debts) {
    if (!debt.dueDate || !debt.supplier || !/^\d{4}-\d{2}-\d{2}$/.test(debt.dueDate)) continue;
    const daysLeft = daysBetween(today, debt.dueDate);
    if (daysLeft > DEBT_REMINDER_DAYS) continue;
    items.push({
      supplierName: debt.supplier.name,
      storeName: storeNames.get(debt.supplier.storeId) || '',
      amount: debt.amount,
      dueDate: debt.dueDate,
      daysLeft,
    });
  }
  return items;
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

// Marks "kind was sent to user today" before sending, so concurrent or repeated runs never double-send.
async function claim(kind: string, userId: string, localDate: string): Promise<boolean> {
  try {
    await prisma.reminderLog.create({ data: { kind, userId, localDate } });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

async function deliver(user: RecipientUser, kind: string, localDate: string, text: string): Promise<boolean> {
  if (!(await claim(kind, user.id, localDate))) return false;

  try {
    await sendMessage(user.telegramChatId!, text, { reply_markup: webAppKeyboard() });
    return true;
  } catch (error) {
    const unreachable =
      error instanceof TelegramError && (error.status === 403 || (error.status === 400 && /chat not found/i.test(error.message)));

    if (unreachable) {
      // Blocked the bot or never started it: stop trying until they press /start again.
      await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: null } });
    } else {
      // Temporary failure (network / Telegram outage): free the claim so the next run retries.
      await prisma.reminderLog.deleteMany({ where: { kind, userId: user.id, localDate } });
    }
    console.warn(`Telegram reminder "${kind}" to user ${user.id} failed:`, error instanceof Error ? error.message : error);
    return false;
  }
}

export async function runDailyReminders(now: Date = new Date()) {
  const result = { revenue: 0, debt: 0 };
  if (!isBotEnabled()) return result;

  const { date, hour } = localParts(now);
  if (hour < REMINDER_HOUR) return result;

  const users = await prisma.user.findMany({ where: { telegramChatId: { not: null } } });

  for (const user of users) {
    try {
      const stores = await getUserStores(user);

      const missing = await findStoresMissingRevenue(stores, date);
      if (missing.length > 0 && (await deliver(user, 'revenue', date, buildRevenueReminderText(missing.map((s) => s.name))))) {
        result.revenue++;
      }

      // Debts are owner-only data, so cashiers only receive the revenue reminder.
      if (user.role !== 'cashier') {
        const urgent = await findUrgentDebts(stores, date);
        if (urgent.length > 0 && (await deliver(user, 'debt', date, buildDebtReminderText(urgent, stores.length > 1)))) {
          result.debt++;
        }
      }
    } catch (error) {
      console.error(`Reminder run failed for user ${user.id}:`, error);
    }
  }

  await prisma.reminderLog.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - LOG_RETENTION_DAYS * 86400000) } },
  });

  if (result.revenue + result.debt > 0) {
    console.log(`🔔 Reminders sent: ${result.revenue} revenue, ${result.debt} debt`);
  }
  return result;
}

export function startReminderScheduler() {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runDailyReminders();
    } catch (error) {
      console.error('Reminder scheduler error:', error);
    } finally {
      running = false;
    }
  };

  console.log(`⏰ Reminder scheduler active (daily after ${REMINDER_HOUR}:00 Tashkent time)`);
  setTimeout(tick, 15000);
  setInterval(tick, 5 * 60 * 1000);
}
