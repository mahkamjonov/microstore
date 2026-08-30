import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@microstore/database';

const revenueSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD formatida bo'lishi kerak"),
  cashAmount: z.number().min(0, "Naqd pul 0 dan kichik bo'lmaydi"),
  terminalAmount: z.number().min(0, "Terminal summasi 0 dan kichik bo'lmaydi"),
  xolisAmount: z.number().default(0),
});

export async function getRevenuesHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId || 'demo-store-id';
    const month = req.query.month as string;

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
    const storeId = req.storeId || 'demo-store-id';
    const userId = req.userId;
    const clientTxId = req.headers['x-client-tx-id'] as string;

    const body = revenueSchema.parse(req.body);
    const totalAmount = body.cashAmount + body.terminalAmount + body.xolisAmount;

    // Check idempotency if clientTxId present
    if (clientTxId) {
      const existingTx = await prisma.dailyRevenue.findFirst({
        where: { clientTxId },
      });
      if (existingTx) {
        return res.status(200).json({
          success: true,
          message: 'Tushum allaqachon saqlangan (Idempotent response)',
          data: existingTx,
        });
      }
    }

    // Ensure store exists for demo
    await prisma.store.upsert({
      where: { id: storeId },
      create: { id: storeId, name: "Demo Do'koni" },
      update: {},
    });

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

    // Write Audit Log
    await prisma.auditLog.create({
      data: {
        storeId,
        userId,
        entityName: 'DAILY_REVENUE',
        entityId: revenue.id,
        action: existing ? 'UPDATE' : 'CREATE',
        oldValues: existing ? JSON.stringify(existing) : null,
        newValues: JSON.stringify(revenue),
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Tushum muvaffaqiyatli saqlandi',
      data: revenue,
    });
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
