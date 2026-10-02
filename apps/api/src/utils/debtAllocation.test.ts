import assert from 'node:assert/strict';
import { allocatePayment } from './debtAllocation.js';

const d = (id: string, amount: number, dueDate: string | null, day: number) => ({
  id,
  amount,
  dueDate,
  createdAt: new Date(2026, 0, day),
});

// pays earliest-due debt first and fully closes it
{
  const { allocations, applied } = allocatePayment(
    [d('late', 500, '2026-12-01', 1), d('soon', 300, '2026-10-01', 2)],
    300
  );
  assert.deepEqual(allocations, [{ id: 'soon', paid: 300, remaining: 0 }]);
  assert.equal(applied, 300);
}

// spills over into the next debt and leaves a partial remainder
{
  const { allocations, applied } = allocatePayment(
    [d('a', 300, '2026-10-01', 1), d('b', 500, '2026-11-01', 2)],
    450
  );
  assert.deepEqual(allocations, [
    { id: 'a', paid: 300, remaining: 0 },
    { id: 'b', paid: 150, remaining: 350 },
  ]);
  assert.equal(applied, 450);
}

// caps at the total outstanding amount
{
  const { allocations, applied } = allocatePayment([d('a', 100, null, 1)], 999);
  assert.deepEqual(allocations, [{ id: 'a', paid: 100, remaining: 0 }]);
  assert.equal(applied, 100);
}

// undated debts are paid after dated ones; ties broken by creation order
{
  const { allocations } = allocatePayment(
    [d('undated', 50, null, 1), d('dated', 50, '2026-10-01', 5), d('older', 50, '2026-10-01', 2)],
    120
  );
  assert.deepEqual(
    allocations.map((a) => a.id),
    ['older', 'dated', 'undated']
  );
}

console.log('debtAllocation tests passed');
