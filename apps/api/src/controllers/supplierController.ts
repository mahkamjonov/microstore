import { Request, Response } from 'express';
import { prisma, Prisma } from '@microstore/database';
import { allocatePayment } from '../utils/debtAllocation.js';
import { isValidDateString, tashkentMonthStart } from '../utils/dates.js';

type Tx = Prisma.TransactionClient;

const supplierInclude = {
  debts: { orderBy: { createdAt: 'desc' as const } },
  transactions: { orderBy: { createdAt: 'desc' as const }, take: 10 },
};

const round = (n: number) => Math.round(n * 100) / 100;

const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, error: { code, message } });

const serverError = (res: Response, label: string, error: unknown) => {
  console.error(`${label}:`, error);
  return fail(res, 500, 'SERVER_ERROR', "Server xatosi. Keyinroq urinib ko'ring.");
};

const findOwnedSupplier = (storeId: string | undefined, supplierId: string) =>
  prisma.supplier.findFirst({ where: { id: supplierId, storeId, isArchived: false } });

// Suppliers saved before individual debts existed only have a balance: turn it into a first debt.
async function normalizeLegacyDebts(tx: Tx, supplierId: string) {
  const supplier = await tx.supplier.findUniqueOrThrow({ where: { id: supplierId } });
  if (supplier.currentBalance <= 0) return;
  const debtCount = await tx.supplierDebt.count({ where: { supplierId } });
  if (debtCount > 0) return;
  await tx.supplierDebt.create({
    data: {
      supplierId,
      supplierName: supplier.name,
      amount: supplier.currentBalance,
      description: "Boshlang'ich qarz",
      dueDate: supplier.dueDate || '',
      status: 'pending',
    },
  });
}

// The supplier balance and nearest due date are always derived from its pending debts.
async function recalcSupplier(tx: Tx, supplierId: string) {
  const pending = await tx.supplierDebt.findMany({ where: { supplierId, status: 'pending' } });
  const total = round(pending.reduce((sum, d) => sum + d.amount, 0));
  const dueDates = pending.map((d) => d.dueDate).filter((d): d is string => !!d).sort();
  await tx.supplier.update({
    where: { id: supplierId },
    data: { currentBalance: total, dueDate: dueDates[0] ?? '' },
  });
}

const loadSupplier = (tx: Tx, supplierId: string) =>
  tx.supplier.findUniqueOrThrow({ where: { id: supplierId }, include: supplierInclude });

const positiveAmount = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 1e13 ? n : null;
};

export async function getSuppliersHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId!;

    const [suppliers, paid] = await Promise.all([
      prisma.supplier.findMany({
        where: { storeId, isArchived: false },
        orderBy: { createdAt: 'desc' },
        include: supplierInclude,
      }),
      prisma.supplierTransaction.aggregate({
        _sum: { amount: true },
        _count: true,
        where: {
          type: 'DECREASE_DEBT',
          createdAt: { gte: tashkentMonthStart() },
          supplier: { storeId },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: suppliers,
      meta: { monthlyPaid: paid._sum.amount || 0, monthlyPaidCount: paid._count },
    });
  } catch (error) {
    return serverError(res, 'getSuppliers error', error);
  }
}

export async function createSupplierHandler(req: Request, res: Response) {
  try {
    const { name, supplierName, phone, amount, initialBalance, currentBalance, dueDate } = req.body || {};
    const supName = String(name || supplierName || '').trim();
    if (!supName) return fail(res, 400, 'INVALID_INPUT', "Ta'minotchi nomi kiritilishi shart");
    if (supName.length > 100) return fail(res, 400, 'INVALID_INPUT', "Ta'minotchi nomi juda uzun");

    const rawBalance = Number(currentBalance || initialBalance || amount || 0);
    if (!Number.isFinite(rawBalance) || rawBalance < 0 || rawBalance > 1e13) {
      return fail(res, 400, 'INVALID_INPUT', "Qarz summasi noto'g'ri");
    }
    const due = isValidDateString(dueDate) ? dueDate : '';

    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          storeId: req.storeId!,
          name: supName,
          phone: String(phone || '').trim(),
          dueDate: due,
          currentBalance: 0,
        },
      });

      if (rawBalance > 0) {
        await tx.supplierDebt.create({
          data: {
            supplierId: created.id,
            supplierName: created.name,
            amount: rawBalance,
            description: "Boshlang'ich qarz",
            dueDate: due,
            status: 'pending',
          },
        });
      }

      await recalcSupplier(tx, created.id);
      return loadSupplier(tx, created.id);
    });

    return res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    return serverError(res, 'createSupplier error', error);
  }
}

// Payment against a supplier's debt (oldest due date is paid first) or an increase of the debt.
export async function createTransactionHandler(req: Request, res: Response) {
  try {
    const supplierId = req.params.id;
    const clientTxId = String(req.headers['x-client-tx-id'] || '').trim() || undefined;
    const { type, amount, note, paymentType } = req.body || {};

    if (type !== 'DECREASE_DEBT' && type !== 'INCREASE_DEBT') {
      return fail(res, 400, 'INVALID_INPUT', "Amal turi noto'g'ri");
    }
    const numAmount = positiveAmount(amount);
    if (numAmount === null) return fail(res, 400, 'INVALID_INPUT', "To'lov summasi noto'g'ri");

    const supplier = await findOwnedSupplier(req.storeId, supplierId);
    if (!supplier) return fail(res, 404, 'NOT_FOUND', "Ta'minotchi topilmadi");

    if (clientTxId) {
      const duplicate = await prisma.supplierTransaction.findUnique({ where: { clientTxId } });
      if (duplicate) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          applied: duplicate.amount,
          supplier: await loadSupplier(prisma, supplierId),
        });
      }
    }

    const outcome = await prisma.$transaction(async (tx) => {
      await normalizeLegacyDebts(tx, supplierId);
      let applied = numAmount;

      if (type === 'DECREASE_DEBT') {
        const pending = await tx.supplierDebt.findMany({ where: { supplierId, status: 'pending' } });
        const result = allocatePayment(
          pending.map((d) => ({ id: d.id, amount: d.amount, dueDate: d.dueDate || null, createdAt: d.createdAt })),
          numAmount
        );
        applied = result.applied;

        for (const allocation of result.allocations) {
          await tx.supplierDebt.update({
            where: { id: allocation.id },
            data: allocation.remaining <= 0 ? { status: 'paid' } : { amount: allocation.remaining },
          });
        }
      } else {
        await tx.supplierDebt.create({
          data: {
            supplierId,
            supplierName: supplier.name,
            amount: numAmount,
            description: String(note || '').trim() || '-',
            dueDate: '',
            status: 'pending',
          },
        });
      }

      if (applied > 0) {
        await tx.supplierTransaction.create({
          data: {
            supplierId,
            type,
            amount: applied,
            note: String(note || paymentType || '').trim() || null,
            clientTxId,
          },
        });
      }

      await recalcSupplier(tx, supplierId);
      return { applied, supplier: await loadSupplier(tx, supplierId) };
    });

    if (outcome.applied <= 0) {
      return fail(res, 400, 'NO_DEBT', "Bu ta'minotchida to'lanadigan qarz yo'q.");
    }

    return res.status(200).json({ success: true, ...outcome });
  } catch (error) {
    return serverError(res, 'createTransaction error', error);
  }
}

export async function createSupplierDebtHandler(req: Request, res: Response) {
  try {
    const supplierId = req.params.id;
    const { amount, dueDate, description } = req.body || {};

    const numAmount = positiveAmount(amount);
    if (numAmount === null) return fail(res, 400, 'INVALID_INPUT', 'Qarz summasi kiritilishi shart.');

    const supplier = await findOwnedSupplier(req.storeId, supplierId);
    if (!supplier) return fail(res, 404, 'NOT_FOUND', "Ta'minotchi topilmadi");

    const result = await prisma.$transaction(async (tx) => {
      await normalizeLegacyDebts(tx, supplierId);
      const debt = await tx.supplierDebt.create({
        data: {
          supplierId,
          supplierName: supplier.name,
          amount: numAmount,
          description: String(description || '').trim() || '-',
          dueDate: isValidDateString(dueDate) ? dueDate : '',
          status: 'pending',
        },
      });
      await recalcSupplier(tx, supplierId);
      return { debt, supplier: await loadSupplier(tx, supplierId) };
    });

    return res.status(201).json({ success: true, data: result.debt, supplier: result.supplier });
  } catch (error) {
    return serverError(res, 'createSupplierDebt error', error);
  }
}

export async function deleteSupplierDebtHandler(req: Request, res: Response) {
  try {
    const { supplierId, debtId } = req.params;

    const supplier = await findOwnedSupplier(req.storeId, supplierId);
    if (!supplier) return fail(res, 404, 'NOT_FOUND', "Ta'minotchi topilmadi");

    const updated = await prisma.$transaction(async (tx) => {
      await normalizeLegacyDebts(tx, supplierId);
      await tx.supplierDebt.deleteMany({ where: { id: debtId, supplierId } });
      await recalcSupplier(tx, supplierId);
      return loadSupplier(tx, supplierId);
    });

    return res.status(200).json({ success: true, supplier: updated });
  } catch (error) {
    return serverError(res, 'deleteSupplierDebt error', error);
  }
}

export async function paySupplierDebtHandler(req: Request, res: Response) {
  try {
    const { supplierId, debtId } = req.params;

    const supplier = await findOwnedSupplier(req.storeId, supplierId);
    if (!supplier) return fail(res, 404, 'NOT_FOUND', "Ta'minotchi topilmadi");

    const updated = await prisma.$transaction(async (tx) => {
      await normalizeLegacyDebts(tx, supplierId);
      const debt = await tx.supplierDebt.findFirst({ where: { id: debtId, supplierId } });
      if (debt && debt.status !== 'paid') {
        await tx.supplierDebt.update({ where: { id: debt.id }, data: { status: 'paid' } });
        await tx.supplierTransaction.create({
          data: { supplierId, type: 'DECREASE_DEBT', amount: debt.amount, note: "Transh to'landi" },
        });
      }
      await recalcSupplier(tx, supplierId);
      return loadSupplier(tx, supplierId);
    });

    return res.status(200).json({ success: true, supplier: updated });
  } catch (error) {
    return serverError(res, 'paySupplierDebt error', error);
  }
}
