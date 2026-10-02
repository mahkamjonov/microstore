import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@microstore/database';
import { isValidDateString } from '../utils/dates.js';

const amount = z.number().finite().min(0, "Summa 0 dan kichik bo'lmaydi").max(1e13);

const revenueSchema = z.object({
  entryDate: z.string().refine(isValidDateString, "Sana YYYY-MM-DD formatida bo'lishi kerak"),
  cashAmount: amount,
  terminalAmount: amount,
  xolisAmount: amount.default(0),
});

const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, error: { code, message } });

export async function getRevenuesHandler(req: Request, res: Response) {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : '';

    const revenues = await prisma.dailyRevenue.findMany({
      where: {
        storeId: req.storeId,
        isArchived: false,
        ...(/^\d{4}(-\d{2})?$/.test(month) ? { entryDate: { startsWith: month } } : {}),
      },
      orderBy: { entryDate: 'desc' },
    });

    return res.status(200).json({ success: true, data: revenues });
  } catch (error) {
    console.error('PRISMA GET REVENUES ERROR:', error);
    return fail(res, 500, 'SERVER_ERROR', 'Tushumlarni olishda xatolik');
  }
}

export async function upsertRevenueHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId!;
    const clientTxId = String(req.headers['x-client-tx-id'] || '').trim() || undefined;

    const parsed = revenueSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'INVALID_INPUT', parsed.error.issues[0]?.message || "Ma'lumotlar noto'g'ri");
    }
    const body = parsed.data;

    // A retried offline request must not be applied twice or overwrite a newer edit.
    if (clientTxId) {
      const applied = await prisma.dailyRevenue.findUnique({ where: { clientTxId } });
      if (applied && applied.storeId === storeId) {
        return res.status(200).json({ success: true, message: 'Tushum allaqachon saqlangan', data: applied });
      }
    }

    const totalAmount = body.cashAmount + body.terminalAmount + body.xolisAmount;
    const values = {
      cashAmount: body.cashAmount,
      terminalAmount: body.terminalAmount,
      xolisAmount: body.xolisAmount,
      totalAmount,
      isArchived: false,
    };

    const revenue = await prisma.dailyRevenue.upsert({
      where: { storeId_entryDate: { storeId, entryDate: body.entryDate } },
      update: values,
      create: { storeId, entryDate: body.entryDate, ...values, clientTxId },
    });

    return res.status(201).json({ success: true, message: 'Tushum muvaffaqiyatli saqlandi', data: revenue });
  } catch (error) {
    console.error('PRISMA REVENUE SAVE ERROR:', error);
    return fail(res, 500, 'SERVER_ERROR', 'Tushumni saqlashda xatolik');
  }
}
