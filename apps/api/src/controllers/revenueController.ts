import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@microstore/database';

const revenueSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD formatida bo'lishi kerak"),
  cashAmount: z.number().min(0, "Naqd pul 0 dan kichik bo'lmaydi"),
  terminalAmount: z.number().min(0, "Terminal summasi 0 dan kichik bo'lmaydi"),
  xolisAmount: z.number().default(0),
});

export interface DailyRevenueRecord {
  id: string;
  storeId: string;
  entryDate: string;
  cashAmount: number;
  terminalAmount: number;
  xolisAmount: number;
  totalAmount: number;
  clientTxId?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// In-Memory Multi-Tenant Store (storeId -> DailyRevenueRecord[])
export const revenuesMap = new Map<string, DailyRevenueRecord[]>();

export async function getRevenuesHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing storeId' });
    }

    const month = req.query.month as string;

    try {
      const revenues = await prisma.dailyRevenue.findMany({
        where: {
          storeId,
          isArchived: false,
          ...(month ? { entryDate: { startsWith: month } } : {}),
        },
        orderBy: { entryDate: 'desc' },
      });

      return res.status(200).json({
        success: true,
        data: revenues,
      });
    } catch (dbErr) {
      // In-Memory Fallback
      let list = revenuesMap.get(storeId) || [];
      if (month) {
        list = list.filter((r) => r.entryDate.startsWith(month));
      }
      return res.status(200).json({
        success: true,
        data: list,
      });
    }
  } catch (error) {
    console.error('Get revenues error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Tushumlarni olishda xatolik' },
    });
  }
}

export async function upsertRevenueHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing storeId' });
    }

    const userId = req.userId;
    const clientTxId = req.headers['x-client-tx-id'] as string;

    const body = revenueSchema.parse(req.body);
    const totalAmount = body.cashAmount + body.terminalAmount + body.xolisAmount;

    try {
      // Try Prisma Database
      const existing = await prisma.dailyRevenue.findFirst({
        where: { storeId, entryDate: body.entryDate, isArchived: false },
      });

      let revenue;
      if (existing) {
        revenue = await prisma.dailyRevenue.update({
          where: { id: existing.id },
          data: {
            cashAmount: body.cashAmount,
            terminalAmount: body.terminalAmount,
            xolisAmount: body.xolisAmount,
            totalAmount,
            clientTxId: clientTxId || existing.clientTxId,
          },
        });
      } else {
        revenue = await prisma.dailyRevenue.create({
          data: {
            storeId,
            entryDate: body.entryDate,
            cashAmount: body.cashAmount,
            terminalAmount: body.terminalAmount,
            xolisAmount: body.xolisAmount,
            totalAmount,
            clientTxId,
          },
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Tushum muvaffaqiyatli saqlandi',
        data: revenue,
      });
    } catch (dbErr) {
      // In-Memory Multi-Tenant Store Update
      let list = revenuesMap.get(storeId) || [];
      const existingIndex = list.findIndex((r) => r.entryDate === body.entryDate && !r.isArchived);

      let record: DailyRevenueRecord;
      if (existingIndex >= 0) {
        record = {
          ...list[existingIndex],
          cashAmount: body.cashAmount,
          terminalAmount: body.terminalAmount,
          xolisAmount: body.xolisAmount,
          totalAmount,
          clientTxId: clientTxId || list[existingIndex].clientTxId,
          updatedAt: new Date().toISOString(),
        };
        list[existingIndex] = record;
      } else {
        record = {
          id: `rev-${Date.now()}`,
          storeId,
          entryDate: body.entryDate,
          cashAmount: body.cashAmount,
          terminalAmount: body.terminalAmount,
          xolisAmount: body.xolisAmount,
          totalAmount,
          clientTxId,
          isArchived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        list.unshift(record);
      }

      revenuesMap.set(storeId, list);

      return res.status(201).json({
        success: true,
        message: 'Tushum muvaffaqiyatli saqlandi',
        data: record,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', details: error.errors },
      });
    }

    console.error('Upsert revenue error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Tushumni saqlashda xatolik' },
    });
  }
}
