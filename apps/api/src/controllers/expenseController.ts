import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@microstore/database';
import { isValidDateString, tashkentToday } from '../utils/dates.js';

const expenseSchema = z.object({
  category: z.enum(['Arenda', 'Kommunal', 'Ish haqi', 'Transport', 'Boshqa']),
  amount: z.coerce.number().positive().max(1e13),
  paymentType: z.enum(['Naqd', 'Karta']).default('Karta'),
  note: z.string().max(500).optional(),
  description: z.string().max(500).optional(),
  date: z.string().optional(),
});

const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, error: { code, message } });

const expenseView = (e: {
  id: string;
  category: string;
  amount: number;
  paymentType: string;
  description: string | null;
  date: string;
  createdAt: Date;
}) => ({
  id: e.id,
  category: e.category,
  amount: e.amount,
  paymentType: e.paymentType,
  note: e.description || '',
  date: e.date,
  createdAt: e.createdAt.toISOString(),
});

export async function getExpensesHandler(req: Request, res: Response) {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : '';

    const expenses = await prisma.expense.findMany({
      where: { storeId: req.storeId, ...(/^\d{4}(-\d{2})?$/.test(month) ? { date: { startsWith: month } } : {}) },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return res.status(200).json({ success: true, data: expenses.map(expenseView) });
  } catch (error) {
    console.error('GET EXPENSES ERROR:', error);
    return fail(res, 500, 'SERVER_ERROR', 'Xarajatlarni olishda xatolik');
  }
}

export async function createExpenseHandler(req: Request, res: Response) {
  try {
    const parsed = expenseSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(res, 400, 'INVALID_INPUT', "Kategoriya va summa to'g'ri kiritilishi shart");
    }

    const { category, amount, paymentType, note, description, date } = parsed.data;

    const expense = await prisma.expense.create({
      data: {
        storeId: req.storeId!,
        category,
        amount,
        paymentType,
        description: (note ?? description ?? '').trim(),
        date: isValidDateString(date) ? date : tashkentToday(),
      },
    });

    return res.status(201).json({ success: true, data: expenseView(expense) });
  } catch (error) {
    console.error('CREATE EXPENSE ERROR:', error);
    return fail(res, 500, 'SERVER_ERROR', 'Xarajatni saqlashda xatolik');
  }
}

export async function deleteExpenseHandler(req: Request, res: Response) {
  try {
    await prisma.expense.deleteMany({ where: { id: req.params.id, storeId: req.storeId } });
    return res.status(200).json({ success: true, message: "Xarajat o'chirildi" });
  } catch (error) {
    console.error('DELETE EXPENSE ERROR:', error);
    return fail(res, 500, 'SERVER_ERROR', "Xarajatni o'chirishda xatolik");
  }
}
