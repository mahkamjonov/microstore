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

export async function getRevenuesHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing storeId' });
    }

    const month = req.query.month as string;

    await prisma.$connect();
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
  } catch (error: any) {
    console.error('PRISMA GET REVENUES ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch revenues',
      message: error.message,
      stack: error.stack,
    });
  }
}

export async function upsertRevenueHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing storeId' });
    }

    const clientTxId = req.headers['x-client-tx-id'] as string;
    const body = revenueSchema.parse(req.body);
    const totalAmount = body.cashAmount + body.terminalAmount + body.xolisAmount;

    console.log("Attempting to save Revenue to Prisma database...");
    await prisma.$connect();

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

    console.log("REVENUE SAVED TO SUPABASE:", revenue);
    return res.status(201).json({
      success: true,
      message: 'Tushum muvaffaqiyatli saqlandi',
      data: revenue,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', details: error.errors },
      });
    }

    console.error("PRISMA REVENUE SAVE ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to save revenue",
      message: error.message,
      stack: error.stack,
    });
  }
}
