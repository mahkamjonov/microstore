import { create } from 'zustand';
import { DailyRevenue, Supplier, Expense } from '../types';

export interface UserSession {
  id: string;
  name: string;
  username: string;
  phone?: string;
  photo?: string;
}

interface AppState {
  selectedDate: string; // YYYY-MM-DD
  activeTab: 'seller' | 'tushum' | 'debts' | 'expenses' | 'profit';
  profitMarginPct: number; // e.g. 20%
  monthlyExpenseBudget: number; // Configurable monthly expense budget (default 0)
  revenues: Record<string, DailyRevenue>; // date string -> DailyRevenue
  suppliers: Supplier[];
  expenses: Expense[];
  isLoading: boolean;

  // Lazy Authentication State (HARDCODED FALSE ON LOAD)
  isAuthenticated: boolean;
  user: UserSession | null;
  showAuthModal: boolean;
  pendingAction: (() => void) | null;
  
  setSelectedDate: (date: string) => void;
  setActiveTab: (tab: 'seller' | 'tushum' | 'debts' | 'expenses' | 'profit') => void;
  setProfitMarginPct: (margin: number) => void;
  setMonthlyExpenseBudget: (budget: number) => void;
  setRevenue: (date: string, revenue: DailyRevenue) => void;
  setSuppliers: (suppliers: Supplier[]) => void;
  updateSupplierBalance: (supplierId: string, delta: number) => void;
  addSupplier: (supplier: Supplier) => void;
  addExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;

  // Auth Actions & Global Auth Guard Interceptor
  loginUser: (user: UserSession) => void;
  logoutUser: () => void;
  setShowAuthModal: (show: boolean) => void;
  setPendingAction: (action: (() => void) | null) => void;
  requireAuth: (action: () => void) => boolean;
  withAuthGuard: (action: () => void) => boolean;
  wipeAllData: () => void;
}

const getTodayString = () => new Date().toISOString().split('T')[0];

export const useStore = create<AppState>((set, get) => ({
  selectedDate: getTodayString(),
  activeTab: 'seller',
  profitMarginPct: 20, // Default 20% profit margin
  monthlyExpenseBudget: 0, // Default 0 (no hardcoded budget)

  // Clean empty guest initial state
  revenues: {},
  suppliers: [],
  expenses: [],
  isLoading: false,

  // HARDCODED INITIAL STATE TO FALSE
  isAuthenticated: false,
  user: null,
  showAuthModal: false,
  pendingAction: null,

  setSelectedDate: (date) => set({ selectedDate: date }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setProfitMarginPct: (margin) => set({ profitMarginPct: margin }),
  setMonthlyExpenseBudget: (budget) => set({ monthlyExpenseBudget: budget }),
  
  setRevenue: (date, revenue) =>
    set((state) => {
      const updatedRevenues = { ...state.revenues, [date]: revenue };
      try {
        localStorage.setItem('microstore_revenues', JSON.stringify(updatedRevenues));
      } catch (err) {
        console.error('Failed to save revenues to localStorage:', err);
      }
      return { revenues: updatedRevenues };
    }),

  setSuppliers: (suppliers) => set({ suppliers }),
  updateSupplierBalance: (supplierId, delta) =>
    set((state) => ({
      suppliers: state.suppliers.map((s) =>
        s.id === supplierId ? { ...s, currentBalance: Math.max(0, s.currentBalance + delta) } : s
      ),
    })),
  addSupplier: (supplier) =>
    set((state) => ({
      suppliers: [supplier, ...state.suppliers],
    })),
  addExpense: (expense) =>
    set((state) => ({
      expenses: [expense, ...state.expenses],
    })),
  deleteExpense: (id) =>
    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id),
    })),

  // Auth Action Implementations with localStorage Auth Sync
  loginUser: (user) => {
    try {
      localStorage.setItem('microstore_user', JSON.stringify(user));
      localStorage.setItem('microstore_auth', 'true');
      localStorage.setItem('microstore_user_session', JSON.stringify(user));
    } catch (err) {}
    set({ isAuthenticated: true, user, showAuthModal: false });

    // Execute pending intercepted action immediately post-login
    const pending = get().pendingAction;
    if (pending) {
      pending();
      set({ pendingAction: null });
    }
  },

  logoutUser: () => {
    try {
      localStorage.removeItem('microstore_user');
      localStorage.removeItem('microstore_auth');
      localStorage.removeItem('microstore_user_session');
    } catch (err) {}
    set({
      isAuthenticated: false,
      user: null,
      pendingAction: null,
      showAuthModal: false,
    });
  },

  wipeAllData: () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (err) {}
    set({
      isAuthenticated: false,
      user: null,
      revenues: {},
      expenses: [],
      suppliers: [],
      pendingAction: null,
      showAuthModal: false,
    });
  },

  setShowAuthModal: (show) => set({ showAuthModal: show }),
  setPendingAction: (action) => set({ pendingAction: action }),

  // Global Auth Interceptor / Guard Function
  requireAuth: (action) => {
    const { isAuthenticated } = get();
    if (isAuthenticated) {
      action();
      return true;
    } else {
      set({ pendingAction: action, showAuthModal: true });
      return false; // STOP EXECUTION
    }
  },

  withAuthGuard: (action) => {
    return get().requireAuth(action);
  },
}));
