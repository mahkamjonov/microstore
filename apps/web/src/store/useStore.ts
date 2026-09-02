import { create } from 'zustand';
import { getApiBaseUrl, hasLiveApiBackend } from '../api/config';
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

export interface StoreItem {
  id: string;
  name: string;
  location?: string;
  createdAt?: string;
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

  // Multi-Store Management State
  stores: StoreItem[];
  activeStoreId: string;
  activeStoreName: string;

  // Lazy Authentication State
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

  // Multi-Store Actions
  fetchStores: () => Promise<void>;
  switchActiveStore: (storeId: string, storeName: string) => Promise<void>;
  addNewStore: (name: string, location?: string) => Promise<void>;
  deleteStore: (storeId: string) => Promise<boolean>;

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

const loadSavedActiveStore = () => {
  try {
    const savedId = localStorage.getItem('activeStoreId') || localStorage.getItem('microstore_active_store_id') || '';
    const savedName = localStorage.getItem('microstore_active_store_name') || '';
    const savedStoresList = localStorage.getItem('microstore_stores');
    const stores: StoreItem[] = savedStoresList ? JSON.parse(savedStoresList) : [];
    const matchedStore = stores.find((s) => s.id === savedId) || stores[0] || null;
    const activeId = matchedStore ? matchedStore.id : savedId;
    const activeName = matchedStore ? matchedStore.name : savedName;
    return { activeStoreId: activeId, activeStoreName: activeName, stores };
  } catch (err) {
    return { activeStoreId: '', activeStoreName: '', stores: [] };
  }
};

const initialSession = loadSavedUserSession();
const initialStoreData = loadSavedActiveStore();

export const useStore = create<AppState>((set, get) => ({
  selectedDate: getTodayString(),
  activeTab: initialSession.user?.role === 'cashier' ? 'seller' : 'seller',
  profitMarginPct: 20,
  monthlyExpenseBudget: 0,

  // Restore saved state on app initialization
  revenues: loadSavedRevenues(),
  suppliers: loadSavedSuppliers(),
  expenses: loadSavedExpenses(),
  isLoading: false,

  // Multi-Store initial state
  stores: initialStoreData.stores,
  activeStoreId: initialStoreData.activeStoreId,
  activeStoreName: initialStoreData.activeStoreName,

  // Restored Auth Session
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

  // Multi-Store Implementation
  fetchStores: async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem('microstore_token') || localStorage.getItem('token') || '';
      const response = await fetch(`${baseUrl}/api/v1/stores`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          let cleanStores = result.data;
          if (cleanStores.length > 1) {
            cleanStores = cleanStores.filter((s: any) => s.id !== 'store_main' && s.name !== "Mening Do'konim" && s.name !== "Asosiy Filial");
          }
          localStorage.setItem('microstore_stores', JSON.stringify(cleanStores));

          const savedActiveId = localStorage.getItem('activeStoreId') || localStorage.getItem('microstore_active_store_id');
          const matchedStore = cleanStores.find((s: any) => s.id === savedActiveId) || cleanStores[0];

          if (matchedStore) {
            localStorage.setItem('activeStoreId', matchedStore.id);
            localStorage.setItem('microstore_active_store_id', matchedStore.id);
            localStorage.setItem('microstore_active_store_name', matchedStore.name);

            set({
              stores: cleanStores,
              activeStoreId: matchedStore.id,
              activeStoreName: matchedStore.name,
            });
          } else {
            set({ stores: cleanStores });
          }
        }
      }
    } catch (err) {
      console.warn('fetchStores error:', err);
    }
  },

  switchActiveStore: async (storeId, storeName) => {
    try {
      localStorage.setItem('activeStoreId', storeId);
      localStorage.setItem('microstore_active_store_id', storeId);
      localStorage.setItem('microstore_active_store_name', storeName);
    } catch (err) {}

    set({ activeStoreId: storeId, activeStoreName: storeName });

    // Fetch fresh revenues and debts for selected store
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem('microstore_token') || localStorage.getItem('token') || '';
      
      const revRes = await fetch(`${baseUrl}/api/v1/revenues`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Store-Id': storeId,
        },
      });

      if (revRes.ok) {
        const revData = await revRes.json();
        if (revData.success && Array.isArray(revData.data)) {
          const revMap: Record<string, DailyRevenue> = {};
          revData.data.forEach((r: any) => {
            if (r.entryDate) revMap[r.entryDate] = r;
          });
          set({ revenues: revMap });
        }
      }

      const supRes = await fetch(`${baseUrl}/api/v1/suppliers`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Store-Id': storeId,
        },
      });

      if (supRes.ok) {
        const supData = await supRes.json();
        if (supData.success && Array.isArray(supData.data)) {
          set({ suppliers: supData.data });
        }
      }
    } catch (err) {
      console.warn('Switch store fetch error:', err);
    }
  },

  addNewStore: async (name, location) => {
    const storeName = name.trim();
    if (!storeName) return;

    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem('microstore_token') || localStorage.getItem('token') || '';
      
      const res = await fetch(`${baseUrl}/api/v1/stores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: storeName, location }),
      });

      let createdStore: StoreItem = {
        id: `store_${Date.now()}`,
        name: storeName,
        location,
      };

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          createdStore = result.data;
        }
      }

      const currentStores = get().stores;
      const updatedStores = [...currentStores.filter((s) => s.id !== createdStore.id), createdStore];

      try {
        localStorage.setItem('microstore_stores', JSON.stringify(updatedStores));
      } catch (err) {}

      set({ stores: updatedStores });
      await get().switchActiveStore(createdStore.id, createdStore.name);
    } catch (err) {
      console.error('addNewStore error:', err);
    }
  },

  deleteStore: async (storeId) => {
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem('microstore_token') || localStorage.getItem('token') || '';
      
      await fetch(`${baseUrl}/api/v1/stores/${storeId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const currentStores = get().stores.filter((s) => s.id !== storeId);
      try {
        localStorage.setItem('microstore_stores', JSON.stringify(currentStores));
      } catch (err) {}
      
      set({ stores: currentStores });

      if (get().activeStoreId === storeId) {
        if (currentStores.length > 0) {
          await get().switchActiveStore(currentStores[0].id, currentStores[0].name);
        } else {
          set({ activeStoreId: '', activeStoreName: '' });
        }
      }
      return true;
    } catch (err) {
      console.error('deleteStore error:', err);
      return false;
    }
  },

  // Auth Action Implementations with Dynamic Store Data Sync
  loginUser: async (user) => {
    try {
      localStorage.setItem('microstore_user', JSON.stringify(user));
      localStorage.setItem('microstore_auth', 'true');
      localStorage.setItem('microstore_user_session', JSON.stringify(user));
    } catch (err) {}

    const isCashier = user?.role === 'cashier';

    set({
      isAuthenticated: true,
      user,
      showAuthModal: false,
      activeTab: isCashier ? 'seller' : 'seller',
    });

    if (hasLiveApiBackend()) {
      try {
        const token = localStorage.getItem('microstore_token') || '';
        const baseUrl = getApiBaseUrl();
        
        if (token && !token.startsWith('demo_token_')) {
          await get().fetchStores();

          const activeStoreId = get().activeStoreId;
          const revRes = await fetch(`${baseUrl}/api/v1/revenues`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Store-Id': activeStoreId },
          });
          if (revRes.ok) {
            const revData = await revRes.json();
            if (revData.success && Array.isArray(revData.data)) {
              const revMap: Record<string, DailyRevenue> = {};
              revData.data.forEach((r: any) => {
                if (r.entryDate) revMap[r.entryDate] = r;
              });
              set({ revenues: revMap });
            }
          }

          const supRes = await fetch(`${baseUrl}/api/v1/suppliers`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Store-Id': activeStoreId },
          });
          if (supRes.ok) {
            const supData = await supRes.json();
            if (supData.success && Array.isArray(supData.data)) {
              set({ suppliers: supData.data });
            }
          }
        }
      } catch (err) {
        console.warn('Backend store data sync warning:', err);
      }
    }

    const pending = get().pendingAction;
    if (pending) {
      pending();
      set({ pendingAction: null });
    }
  },

  logoutUser: () => {
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
      showAuthModal: true,
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
      showAuthModal: true,
    });
  },

  setShowAuthModal: (show) => set({ showAuthModal: show }),
  setPendingAction: (action) => set({ pendingAction: action }),

  requireAuth: (action) => {
    const { isAuthenticated } = get();
    if (isAuthenticated) {
      action();
      return true;
    } else {
      set({ pendingAction: action, showAuthModal: true });
      return false;
    }
  },

  withAuthGuard: (action) => {
    return get().requireAuth(action);
  },
}));
