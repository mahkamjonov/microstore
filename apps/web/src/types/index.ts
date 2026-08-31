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

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  currentBalance: number;
  dueDate?: string; // YYYY-MM-DD
  createdAt: string;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  type: 'INCREASE_DEBT' | 'DECREASE_DEBT';
  amount: number;
  note?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: 'Arenda' | 'Kommunal' | 'Ish haqi' | 'Transport' | 'Boshqa';
  amount: number;
  paymentType: 'Naqd' | 'Karta';
  note?: string;
  date: string;
  createdAt: string;
}

export interface PendingSyncItem {
  id: string;
  type: 'REVENUE' | 'SUPPLIER_TX' | 'EXPENSE';
  payload: any;
  timestamp: number;
}
