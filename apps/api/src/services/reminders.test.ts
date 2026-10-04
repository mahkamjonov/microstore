import assert from 'node:assert/strict';
import { buildDebtOverviewText, buildDebtReminderText, buildRevenueReminderText, daysBetween, localParts } from './reminders.js';

// Tashkent is UTC+5: 16:30 UTC is 21:30 the same day, 19:30 UTC is 00:30 the next day
assert.deepEqual(localParts(new Date('2026-10-04T16:30:00Z')), { date: '2026-10-04', hour: 21 });
assert.deepEqual(localParts(new Date('2026-10-04T15:59:00Z')), { date: '2026-10-04', hour: 20 });
assert.deepEqual(localParts(new Date('2026-10-04T19:30:00Z')), { date: '2026-10-05', hour: 0 });

assert.equal(daysBetween('2026-10-04', '2026-10-11'), 7);
assert.equal(daysBetween('2026-10-04', '2026-10-04'), 0);
assert.equal(daysBetween('2026-10-04', '2026-10-01'), -3);
assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);

// single store vs several stores, HTML is escaped
assert.match(buildRevenueReminderText(['A & B']), /«A &amp; B»/);
const multi = buildRevenueReminderText(['Dokon 1', 'Dokon 2']);
assert.match(multi, /• Dokon 1\n• Dokon 2/);

const debtText = buildDebtReminderText(
  [
    { supplierName: 'Oazis', storeName: 'Dokon 1', amount: 1500000, dueDate: '2026-10-06', daysLeft: 2 },
    { supplierName: 'Coca <Cola>', storeName: 'Dokon 1', amount: 700000, dueDate: '2026-10-01', daysLeft: -3 },
    { supplierName: 'Sut', storeName: 'Dokon 2', amount: 250000, dueDate: '2026-10-11', daysLeft: 7 },
  ],
  true
);
assert.ok(debtText.indexOf('Coca') < debtText.indexOf('Oazis') && debtText.indexOf('Oazis') < debtText.indexOf('Sut'), 'sorted by urgency');
assert.match(debtText, /Coca &lt;Cola&gt;/);
assert.match(debtText, /muddati 3 kun oldin o'tgan/);
assert.match(debtText, /2 kun qoldi/);
assert.match(debtText, /\(Dokon 2\)/);
assert.match(debtText, /1 500 000 so'm/);
assert.match(debtText, /Jami:<\/b> 2 450 000 so'm/);
assert.doesNotMatch(buildDebtReminderText([{ supplierName: 'X', storeName: 'S', amount: 1, dueDate: '2026-10-05', daysLeft: 1 }], false), /\(S\)/);

// /qarzlar overview: urgent tranches first, every other supplier summed, nothing hidden
const overview = buildDebtOverviewText(
  [
    { supplierName: 'Urgent Co', storeName: 'S', amount: 500000, dueDate: '2026-10-06', daysLeft: 2 },
    { supplierName: 'Far Co', storeName: 'S', amount: 1000000, dueDate: '2026-11-20', daysLeft: 47 },
    { supplierName: 'Far Co', storeName: 'S', amount: 250000, dueDate: '2026-11-05', daysLeft: 32 },
    { supplierName: 'Undated Co', storeName: 'S', amount: 100000, dueDate: null, daysLeft: null },
  ],
  false
);
assert.match(overview, /Muddati yaqin \(7 kun ichida\)[\s\S]*Urgent Co/);
assert.match(overview, /Boshqa qarzlar[\s\S]*Far Co<\/b> — 1 250 000 so'm\n {4}📅 muddat: 2026-11-05/);
assert.match(overview, /Undated Co<\/b> — 100 000 so'm\n {4}📅 muddati belgilanmagan/);
assert.match(overview, /Jami qarz:<\/b> 1 850 000 so'm/);
assert.ok(overview.indexOf('Urgent Co') < overview.indexOf('Far Co'));
assert.doesNotMatch(buildDebtOverviewText([{ supplierName: 'Far', storeName: 'S', amount: 1, dueDate: '2026-12-01', daysLeft: 60 }], false), /Muddati yaqin/);
assert.match(buildDebtOverviewText([], false), /qarz yo'q/);

console.log('reminders tests passed');
