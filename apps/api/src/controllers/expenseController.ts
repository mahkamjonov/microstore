import { Request, Response } from 'express';
import { prisma } from '@microstore/database';

export async function getExpensesHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing storeId' });
    }

    const expenses = await prisma.expense.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: expenses,
    });
  } catch (error: any) {
    console.error('GET EXPENSES ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch expenses',
      message: error.message,
    });
  }
}

export async function createExpenseHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing storeId' });
    }

    const { category, amount, description, date } = req.body || {};
    const numAmount = Number(amount || 0);

    if (!category || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Kategoriya va summa kiritilishi shart' },
      });
    }

    const expense = await prisma.expense.create({
      data: {
        storeId,
        category,
        amount: numAmount,
        description: description || '',
        date: date || new Date().toISOString().split('T')[0],
      },
    });

    return res.status(201).json({
      success: true,
      data: expense,
    });
  } catch (error: any) {
    console.error('CREATE EXPENSE ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create expense',
      message: error.message,
    });
  }
}

export async function deleteExpenseHandler(req: Request, res: Response) {
  try {
    const storeId = req.storeId;
    const { id } = req.params;

    if (!storeId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: missing storeId' });
    }

    await prisma.expense.deleteMany({
      where: { id, storeId },
    });

    return res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error: any) {
    console.error('DELETE EXPENSE ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete expense',
      message: error.message,
    });
  }
}
