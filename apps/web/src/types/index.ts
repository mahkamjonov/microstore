export interface DailyRevenue {
  id?: string;
  entryDate: string;
  date?: string;
  cashAmount: number;
  terminalAmount: number;
  xolisAmount: number;
  totalAmount: number;
  updatedAt?: string;
}

export interface DebtTranche {
  id: string;
  supplierId: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'paid';
  description?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  currentBalance: number;
  dueDate?: string; // YYYY-MM-DD
  debts?: DebtTranche[];
  createdAt: string;
}

export type ExpenseCategory = 'Arenda' | 'Kommunal' | 'Ish haqi' | 'Transport' | 'Boshqa';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  paymentType: 'Naqd' | 'Karta';
  note?: string;
  date: string;
  createdAt: string;
}

export interface PendingSyncItem {
  id: string;
  type: 'REVENUE';
  storeId: string;
  payload: any;
  timestamp: number;
}
