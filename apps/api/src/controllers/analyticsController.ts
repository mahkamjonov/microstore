import { Request, Response } from 'express';
import { prisma } from '@microstore/database';
import { tashkentToday } from '../utils/dates.js';

export async function getAnalyticsHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId;
    const todayStr = tashkentToday();

    const todayRevenue = await prisma.dailyRevenue.findFirst({
      where: { storeId, entryDate: todayStr, isArchived: false },
    });

    const suppliers = await prisma.supplier.findMany({
      where: { storeId, isArchived: false },
    });
    const totalSupplierDebt = suppliers.reduce((acc, s) => acc + (s.currentBalance || 0), 0);

    const last7Days = await prisma.dailyRevenue.findMany({
      where: { storeId, isArchived: false },
      orderBy: { entryDate: 'desc' },
      take: 7,
    });

    const totalCashWeek = last7Days.reduce((acc, r) => acc + (r.cashAmount || 0), 0);
    const totalTerminalWeek = last7Days.reduce((acc, r) => acc + (r.terminalAmount || 0), 0);
    const totalXolisWeek = last7Days.reduce((acc, r) => acc + (r.xolisAmount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        today: {
          cash: todayRevenue?.cashAmount || 0,
          terminal: todayRevenue?.terminalAmount || 0,
          xolis: todayRevenue?.xolisAmount || 0,
          total: todayRevenue?.totalAmount || 0,
        },
        weekly: {
          totalCash: totalCashWeek,
          totalTerminal: totalTerminalWeek,
          totalRevenue: totalCashWeek + totalTerminalWeek + totalXolisWeek,
        },
        totalSupplierDebt,
        recentRevenues: last7Days.reverse(),
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Analitika olishda xatolik' },
    });
  }
}
