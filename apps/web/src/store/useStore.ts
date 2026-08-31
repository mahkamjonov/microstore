import { create } from 'zustand';
import { DailyRevenue, Supplier, Expense } from '../types';

export interface UserSession {
  id: string;
  name: string;
  username: string;
  phone?: string;
  photo?: string;
  role?: 'owner' | 'cashier';
  storeId?: string;
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

const loadSavedRevenues = (): Record<string, DailyRevenue> => {
  try {
    const saved = localStorage.getItem('microstore_daily_sales') || localStorage.getItem('microstore_revenues');
    return saved ? JSON.parse(saved) : {};
  } catch (err) {
    return {};
  }
};

const loadSavedSuppliers = (): Supplier[] => {
  try {
    const saved = localStorage.getItem('microstore_suppliers');
    return saved ? JSON.parse(saved) : [];
  } catch (err) {
    return [];
  }
};

const loadSavedExpenses = (): Expense[] => {
  try {
    const saved = localStorage.getItem('microstore_expenses');
    return saved ? JSON.parse(saved) : [];
  } catch (err) {
    return [];
  }
};

const loadSavedUserSession = (): { isAuthenticated: boolean; user: UserSession | null } => {
  try {
    const savedUser = localStorage.getItem('microstore_user') || localStorage.getItem('microstore_user_session');
    const isAuth = localStorage.getItem('microstore_auth') === 'true';
    if (savedUser && isAuth) {
      return { isAuthenticated: true, user: JSON.parse(savedUser) };
    }
  } catch (err) {}
  return { isAuthenticated: false, user: null };
};

const initialSession = loadSavedUserSession();

export const useStore = create<AppState>((set, get) => ({
  selectedDate: getTodayString(),
  activeTab: initialSession.user?.role === 'cashier' ? 'seller' : 'seller',
  profitMarginPct: 20, // Default 20% profit margin
  monthlyExpenseBudget: 0, // Default 0 (no hardcoded budget)

  // Restore saved state on app initialization from localStorage
  revenues: loadSavedRevenues(),
  suppliers: loadSavedSuppliers(),
  expenses: loadSavedExpenses(),
  isLoading: false,

  // Restored Auth Session from localStorage
  isAuthenticated: initialSession.isAuthenticated,
  user: initialSession.user,
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
        localStorage.setItem('microstore_daily_sales', JSON.stringify(updatedRevenues));
        localStorage.setItem('microstore_revenues', JSON.stringify(updatedRevenues));
      } catch (err) {
        console.error('Failed to save daily sales to localStorage:', err);
      }
      return { revenues: updatedRevenues };
    }),

  setSuppliers: (suppliers) => {
    try {
      localStorage.setItem('microstore_suppliers', JSON.stringify(suppliers));
    } catch (err) {}
    set({ suppliers });
  },

  updateSupplierBalance: (supplierId, delta) =>
    set((state) => {
      const updatedSuppliers = state.suppliers.map((s) =>
        s.id === supplierId ? { ...s, currentBalance: Math.max(0, s.currentBalance + delta) } : s
      );
      try {
        localStorage.setItem('microstore_suppliers', JSON.stringify(updatedSuppliers));
      } catch (err) {}
      return { suppliers: updatedSuppliers };
    }),

  addSupplier: (supplier) =>
    set((state) => {
      const updatedSuppliers = [supplier, ...state.suppliers];
      try {
        localStorage.setItem('microstore_suppliers', JSON.stringify(updatedSuppliers));
      } catch (err) {}
      return { suppliers: updatedSuppliers };
    }),

  addExpense: (expense) =>
    set((state) => {
      const updatedExpenses = [expense, ...state.expenses];
      try {
        localStorage.setItem('microstore_expenses', JSON.stringify(updatedExpenses));
      } catch (err) {}
      return { expenses: updatedExpenses };
    }),

  deleteExpense: (id) =>
    set((state) => {
      const updatedExpenses = state.expenses.filter((e) => e.id !== id);
      try {
        localStorage.setItem('microstore_expenses', JSON.stringify(updatedExpenses));
      } catch (err) {}
      return { expenses: updatedExpenses };
    }),

  // Auth Action Implementations with localStorage Auth Sync
  loginUser: (user) => {
    try {
      localStorage.setItem('microstore_user', JSON.stringify(user));
      localStorage.setItem('microstore_auth', 'true');
      localStorage.setItem('microstore_user_session', JSON.stringify(user));
    } catch (err) {}

    // If user is a cashier, restrict active tab to seller (Sales Entry / POS Screen)
    const isCashier = user?.role === 'cashier';
    set({
      isAuthenticated: true,
      user,
      showAuthModal: false,
      activeTab: isCashier ? 'seller' : get().activeTab,
    });

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
