import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@microstore/database';

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
          take: 10,
        },
        debts: {
          orderBy: { createdAt: 'desc' },
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

    const { name, supplierName, phone, amount, initialBalance, currentBalance, dueDate } = req.body || {};
    const supName = (name || supplierName || '').trim();
    if (!supName) {
      return res.status(400).json({ success: false, error: "Ta'minotchi nomi kiritilishi shart" });
    }

    const bal = Number(currentBalance || initialBalance || amount || 0);

    const supplier = await prisma.supplier.create({
      data: {
        storeId,
        name: supName,
        phone: phone || '',
        dueDate: dueDate || '',
        currentBalance: bal,
      },
    });

    if (bal > 0) {
      await prisma.supplierDebt.create({
        data: {
          supplierId: supplier.id,
          supplierName: supplier.name,
          amount: bal,
          description: "Boshlang'ich qarz",
          dueDate: dueDate || '',
          status: 'pending',
        },
      });
    }

    const resultSupplier = await prisma.supplier.findUnique({
      where: { id: supplier.id },
      include: { debts: true, transactions: true },
    });

    return res.status(201).json({
      success: true,
      data: resultSupplier || supplier,
    });
  } catch (error: any) {
    console.error("PRISMA SUPPLIER SAVE ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to save supplier",
      message: error.message,
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
    const { type, amount, note } = req.body || {};
    const numAmount = Number(amount || 0);

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

    const balanceChange = type === 'INCREASE_DEBT' ? numAmount : -numAmount;
    const newBalance = Math.max(0, supplier.currentBalance + balanceChange);

    const [updatedSupplier, tx] = await prisma.$transaction([
      prisma.supplier.update({
        where: { id: supplierId },
        data: { currentBalance: newBalance },
      }),
      prisma.supplierTransaction.create({
        data: {
          supplierId,
          type,
          amount: numAmount,
          note,
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
  } catch (error: any) {
    console.error("PRISMA SUPPLIER TRANSACTION ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to save supplier transaction",
      message: error.message,
    });
  }
}

export async function createSupplierDebtHandler(req: Request, res: Response) {
  try {
    const { id: supplierId } = req.params;
    const { amount, dueDate, description } = req.body || {};

    const numAmount = Number(amount || 0);
    if (numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: "Qarz summasi kiritilishi shart." },
      });
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({ success: false, error: "Ta'minotchi topilmadi" });
    }

    const debt = await prisma.supplierDebt.create({
      data: {
        supplierId,
        supplierName: supplier.name,
        amount: numAmount,
        description: description || '-',
        dueDate: dueDate || '',
        status: 'pending',
      },
    });

    const newBal = supplier.currentBalance + numAmount;
    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        currentBalance: newBal,
        dueDate: dueDate || supplier.dueDate,
      },
    });

    return res.status(201).json({
      success: true,
      data: debt,
    });
  } catch (error: any) {
    console.error('createSupplierDebtHandler error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'CREATE_DEBT_FAILED', message: error.message },
    });
  }
}

export async function deleteSupplierDebtHandler(req: Request, res: Response) {
  try {
    const { supplierId, debtId } = req.params;
    const debt = await prisma.supplierDebt.findUnique({ where: { id: debtId } });
    if (debt) {
      await prisma.supplierDebt.delete({ where: { id: debtId } });
      if (debt.status === 'pending') {
        const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
        if (supplier) {
          const newBal = Math.max(0, supplier.currentBalance - debt.amount);
          await prisma.supplier.update({
            where: { id: supplierId },
            data: { currentBalance: newBal },
          });
        }
      }
    }
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('deleteSupplierDebtHandler error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function paySupplierDebtHandler(req: Request, res: Response) {
  try {
    const { supplierId, debtId } = req.params;
    const debt = await prisma.supplierDebt.findUnique({ where: { id: debtId } });
    if (debt && debt.status !== 'paid') {
      await prisma.supplierDebt.update({
        where: { id: debtId },
        data: { status: 'paid' },
      });
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (supplier) {
        const newBal = Math.max(0, supplier.currentBalance - debt.amount);
        await prisma.supplier.update({
          where: { id: supplierId },
          data: { currentBalance: newBal },
        });
      }
    }
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('paySupplierDebtHandler error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
