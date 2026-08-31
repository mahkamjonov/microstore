import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@microstore/database';

const createSupplierSchema = z.object({
  name: z.string().min(2, "Ta'minotchi nomi kamida 2 ta belgi bo'lishi kerak"),
  initialBalance: z.number().default(0),
});

const transactionSchema = z.object({
  type: z.enum(['INCREASE_DEBT', 'DECREASE_DEBT']),
  amount: z.number().positive("Summa 0 dan katta bo'lishi kerak"),
  note: z.string().optional(),
});

export interface SupplierRecord {
  id: string;
  storeId: string;
  name: string;
  currentBalance: number;
  isArchived: boolean;
  createdAt: string;
}

// In-Memory Multi-Tenant Store (storeId -> SupplierRecord[])
export const suppliersMap = new Map<string, SupplierRecord[]>();

export async function getSuppliersHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing storeId' });
    }

    try {
      const suppliers = await prisma.supplier.findMany({
        where: { storeId, isArchived: false },
        orderBy: { createdAt: 'desc' },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      return res.status(200).json({
        success: true,
        data: suppliers,
      });
    } catch (dbErr) {
      const list = suppliersMap.get(storeId) || [];
      return res.status(200).json({
        success: true,
        data: list,
      });
    }
  } catch (error) {
    console.error('Get suppliers error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: "Ta'minotchilarni olishda xatolik" },
    });
  }
}

export async function createSupplierHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing storeId' });
    }

    const body = createSupplierSchema.parse(req.body);

    try {
      const supplier = await prisma.supplier.create({
        data: {
          storeId,
          name: body.name,
          currentBalance: body.initialBalance,
        },
      });

      return res.status(201).json({
        success: true,
        data: supplier,
      });
    } catch (dbErr) {
      const list = suppliersMap.get(storeId) || [];
      const supplier: SupplierRecord = {
        id: `sup-${Date.now()}`,
        storeId,
        name: body.name,
        currentBalance: body.initialBalance,
        isArchived: false,
        createdAt: new Date().toISOString(),
      };
      list.unshift(supplier);
      suppliersMap.set(storeId, list);

      return res.status(201).json({
        success: true,
        data: supplier,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', details: error.errors },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: "Ta'minotchi yaratishda xatolik" },
    });
  }
}

export async function createTransactionHandler(req: Request, res: Response) {
  try {
    const { id: supplierId } = req.params;
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing storeId' });
    }

    const userId = req.userId;
    const clientTxId = req.headers['x-client-tx-id'] as string;
    const body = transactionSchema.parse(req.body);

    try {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, storeId, isArchived: false },
      });

      if (!supplier) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: "Ta'minotchi topilmadi" },
        });
      }

      const balanceChange = body.type === 'INCREASE_DEBT' ? body.amount : -body.amount;
      const newBalance = Math.max(0, supplier.currentBalance + balanceChange);

      const [updatedSupplier, tx] = await prisma.$transaction([
        prisma.supplier.update({
          where: { id: supplierId },
          data: { currentBalance: newBalance },
        }),
        prisma.supplierTransaction.create({
          data: {
            supplierId,
            type: body.type,
            amount: body.amount,
            note: body.note,
            clientTxId,
          },
        }),
      ]);

      return res.status(200).json({
        success: true,
        message: "Ta'minotchi balansi yangilandi",
        data: {
          supplier: updatedSupplier,
          transaction: tx,
        },
      });
    } catch (dbErr) {
      const list = suppliersMap.get(storeId) || [];
      const supIndex = list.findIndex((s) => s.id === supplierId);
      if (supIndex < 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: "Ta'minotchi topilmadi" },
        });
      }

      const balanceChange = body.type === 'INCREASE_DEBT' ? body.amount : -body.amount;
      const newBalance = Math.max(0, list[supIndex].currentBalance + balanceChange);
      list[supIndex] = { ...list[supIndex], currentBalance: newBalance };
      suppliersMap.set(storeId, list);

      return res.status(200).json({
        success: true,
        message: "Ta'minotchi balansi yangilandi",
        data: {
          supplier: list[supIndex],
          transaction: {
            id: `tx-${Date.now()}`,
            supplierId,
            type: body.type,
            amount: body.amount,
            note: body.note,
            createdAt: new Date().toISOString(),
          },
        },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', details: error.errors },
      });
    }
    console.error('Supplier transaction error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Tranzaksiyada xatolik' },
    });
  }
}
