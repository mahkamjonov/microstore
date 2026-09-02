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

export async function getSuppliersHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing storeId' });
    }

    await prisma.$connect();
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
  } catch (error: any) {
    console.error('PRISMA GET SUPPLIERS ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch suppliers',
      message: error.message,
      stack: error.stack,
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

    console.log("Attempting to save Supplier to Prisma database...");
    await prisma.$connect();

    const supplier = await prisma.supplier.create({
      data: {
        storeId,
        name: body.name,
        currentBalance: body.initialBalance,
      },
    });

    console.log("SUPPLIER SAVED TO SUPABASE:", supplier);
    return res.status(201).json({
      success: true,
      data: supplier,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', details: error.errors },
      });
    }

    console.error("PRISMA SUPPLIER SAVE ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to save supplier",
      message: error.message,
      stack: error.stack,
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

    const clientTxId = req.headers['x-client-tx-id'] as string;
    const body = transactionSchema.parse(req.body);

    console.log("Attempting to save Supplier Transaction to Prisma database...");
    await prisma.$connect();

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

    console.log("SUPPLIER TRANSACTION SAVED TO SUPABASE:", tx);
    return res.status(200).json({
      success: true,
      message: "Ta'minotchi balansi yangilandi",
      data: {
        supplier: updatedSupplier,
        transaction: tx,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', details: error.errors },
      });
    }

    console.error("PRISMA SUPPLIER TRANSACTION ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to save supplier transaction",
      message: error.message,
      stack: error.stack,
    });
  }
}

export async function createSupplierDebtHandler(req: Request, res: Response) {
  try {
    const { id: supplierId } = req.params;
    const { amount, dueDate } = req.body || {};

    const numAmount = Number(amount || 0);
    if (numAmount <= 0 || !dueDate) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: "Summa va to'lov muddati kiritilishi shart." },
      });
    }

    try {
      await prisma.supplierTransaction.create({
        data: {
          supplierId,
          type: 'INCREASE_DEBT',
          amount: numAmount,
          note: `Yangi qarz qo'shildi (Muddati: ${dueDate})`,
        },
      });

      await prisma.supplier.update({
        where: { id: supplierId },
        data: {
          currentBalance: { increment: numAmount },
        },
      });
    } catch (dbErr) {
      console.warn('Prisma createSupplierDebtHandler fallback:', dbErr);
    }

    return res.status(201).json({
      success: true,
      message: "Yangi qarz transhi muvaffaqiyatli qo'shildi!",
    });
  } catch (error: any) {
    console.error('createSupplierDebtHandler error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'CREATE_DEBT_FAILED', message: error.message },
    });
  }
}
