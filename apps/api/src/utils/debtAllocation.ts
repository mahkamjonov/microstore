export interface PendingDebt {
  id: string;
  amount: number;
  dueDate: string | null;
  createdAt: Date;
}

export interface DebtAllocation {
  id: string;
  paid: number;
  remaining: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

// Applies a payment to pending debts: earliest due date first, undated debts last, then oldest first.
export function allocatePayment(debts: PendingDebt[], payment: number) {
  const ordered = [...debts].sort((a, b) => {
    const aDue = a.dueDate || '';
    const bDue = b.dueDate || '';
    if (aDue !== bDue) {
      if (!aDue) return 1;
      if (!bDue) return -1;
      return aDue < bDue ? -1 : 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let left = round(payment);
  const allocations: DebtAllocation[] = [];

  for (const debt of ordered) {
    if (left <= 0) break;
    const paid = round(Math.min(left, debt.amount));
    allocations.push({ id: debt.id, paid, remaining: round(debt.amount - paid) });
    left = round(left - paid);
  }

  return { allocations, applied: round(payment - left) };
}
