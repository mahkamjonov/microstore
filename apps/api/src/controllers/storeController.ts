import { Request, Response } from 'express';
import { prisma } from '@microstore/database';

const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, error: { code, message } });

const storeView = (s: {
  id: string;
  name: string;
  createdAt: Date;
  profitMarginPct: number;
  monthlyExpenseBudget: number;
}) => ({
  id: s.id,
  name: s.name,
  createdAt: s.createdAt.toISOString(),
  profitMarginPct: s.profitMarginPct,
  monthlyExpenseBudget: s.monthlyExpenseBudget,
});

export async function getStoresHandler(req: Request, res: Response) {
  try {
    const stores =
      req.role === 'cashier'
        ? await prisma.store.findMany({ where: { id: req.storeId } })
        : await prisma.store.findMany({
            where: { OR: [{ ownerId: req.userId }, { users: { some: { id: req.userId } } }] },
            orderBy: { createdAt: 'asc' },
          });

    return res.status(200).json({ success: true, data: stores.map(storeView) });
  } catch (error: any) {
    console.error('getStoresHandler error:', error);
    return fail(res, 500, 'SERVER_ERROR', "Do'konlarni olishda xatolik");
  }
}

export async function createStoreHandler(req: Request, res: Response) {
  try {
    const storeName = String((req.body || {}).name || '').trim();

    if (!storeName) return fail(res, 400, 'MISSING_NAME', "Do'kon nomi kiritilishi shart.");
    if (storeName.length > 80) return fail(res, 400, 'NAME_TOO_LONG', "Do'kon nomi 80 belgidan oshmasligi kerak.");

    const store = await prisma.store.create({ data: { name: storeName, ownerId: req.userId } });

    return res.status(201).json({
      success: true,
      data: storeView(store),
      message: "Yangi do'kon muvaffaqiyatli yaratildi!",
    });
  } catch (error: any) {
    console.error('createStoreHandler error:', error);
    return fail(res, 500, 'CREATE_STORE_FAILED', "Do'kon yaratishda xatolik");
  }
}

export async function deleteStoreHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const ownerId = req.userId!;

    const owned = await prisma.store.findMany({
      where: { ownerId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!owned.some((s) => s.id === id)) {
      return fail(res, 404, 'NOT_FOUND', "Do'kon topilmadi.");
    }
    if (owned.length < 2) {
      return fail(res, 400, 'LAST_STORE', "Oxirgi do'konni o'chirib bo'lmaydi.");
    }

    const fallbackStoreId = owned.find((s) => s.id !== id)!.id;
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { storeId: true } });

    // Deleting a store cascades to its users, so move the owner out of it first.
    await prisma.$transaction(async (tx) => {
      if (owner?.storeId === id) {
        await tx.user.update({ where: { id: ownerId }, data: { storeId: fallbackStoreId } });
      }
      await tx.store.delete({ where: { id } });
    });

    return res.status(200).json({ success: true, message: "Do'kon muvaffaqiyatli o'chirildi" });
  } catch (error: any) {
    console.error('deleteStoreHandler error:', error);
    return fail(res, 500, 'DELETE_STORE_FAILED', "Do'konni o'chirishda xatolik");
  }
}

export async function getSettingsHandler(req: Request, res: Response) {
  try {
    const store = await prisma.store.findUnique({ where: { id: req.storeId } });
    if (!store) return fail(res, 404, 'NOT_FOUND', "Do'kon topilmadi.");
    return res.status(200).json({
      success: true,
      data: { profitMarginPct: store.profitMarginPct, monthlyExpenseBudget: store.monthlyExpenseBudget },
    });
  } catch (error) {
    console.error('getSettingsHandler error:', error);
    return fail(res, 500, 'SERVER_ERROR', 'Sozlamalarni olishda xatolik');
  }
}

export async function updateSettingsHandler(req: Request, res: Response) {
  try {
    const { profitMarginPct, monthlyExpenseBudget } = req.body || {};
    const data: { profitMarginPct?: number; monthlyExpenseBudget?: number } = {};

    if (profitMarginPct !== undefined) {
      const margin = Number(profitMarginPct);
      if (!Number.isFinite(margin) || margin < 0 || margin > 100) {
        return fail(res, 400, 'INVALID_INPUT', "Marja 0 dan 100 gacha bo'lishi kerak.");
      }
      data.profitMarginPct = margin;
    }

    if (monthlyExpenseBudget !== undefined) {
      const budget = Number(monthlyExpenseBudget);
      if (!Number.isFinite(budget) || budget < 0) {
        return fail(res, 400, 'INVALID_INPUT', "Xarajat limiti manfiy bo'lmasligi kerak.");
      }
      data.monthlyExpenseBudget = budget;
    }

    if (Object.keys(data).length === 0) {
      return fail(res, 400, 'INVALID_INPUT', "O'zgartirish uchun qiymat kiritilmadi.");
    }

    const store = await prisma.store.update({ where: { id: req.storeId }, data });
    return res.status(200).json({
      success: true,
      data: { profitMarginPct: store.profitMarginPct, monthlyExpenseBudget: store.monthlyExpenseBudget },
    });
  } catch (error) {
    console.error('updateSettingsHandler error:', error);
    return fail(res, 500, 'SERVER_ERROR', 'Sozlamalarni saqlashda xatolik');
  }
}

// Stores created before ownership tracking existed belong to the first user registered in them.
export async function backfillStoreOwners() {
  const orphans = await prisma.store.findMany({
    where: { ownerId: null },
    include: { users: { where: { role: 'owner' }, orderBy: { createdAt: 'asc' }, take: 1 } },
  });

  let assigned = 0;
  for (const store of orphans) {
    const owner = store.users[0];
    if (!owner) continue;
    await prisma.store.update({ where: { id: store.id }, data: { ownerId: owner.id } });
    assigned++;
  }

  console.log(`🏪 Store ownership backfill: ${assigned} assigned, ${orphans.length - assigned} without an owner`);
}
