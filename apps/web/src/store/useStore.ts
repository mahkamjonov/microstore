import { create } from 'zustand';
import { apiFetch, ApiError, getToken, isRetryableError, setToken, setUnauthorizedHandler } from '../api/client';
import { saveRevenueToApi } from '../services/revenue';
import { enqueueRevenue } from '../services/syncQueue';
import { DailyRevenue, Supplier, Expense, ExpenseCategory } from '../types';
import { toLocalDateString } from '../utils/date';
import { getTelegramInitData } from '../utils/telegram';

export type TabId = 'seller' | 'tushum' | 'debts' | 'expenses' | 'profit';

export interface UserSession {
  id: string;
  name: string;
  phone?: string;
  role?: 'owner' | 'cashier';
  storeId?: string;
  storeName?: string;
  photo?: string;
}

export interface StoreItem {
  id: string;
  name: string;
  createdAt?: string;
  profitMarginPct?: number;
  monthlyExpenseBudget?: number;
}

export interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

export interface RevenueInput {
  entryDate: string;
  cashAmount: number;
  terminalAmount: number;
  xolisAmount: number;
}

export interface ExpenseInput {
  category: ExpenseCategory;
  amount: number;
  paymentType: 'Naqd' | 'Karta';
  note: string;
  date: string;
}

interface AppState {
  selectedDate: string; // YYYY-MM-DD
  activeTab: TabId;
  profitMarginPct: number;
  monthlyExpenseBudget: number;
  revenues: Record<string, DailyRevenue>;
  suppliers: Supplier[];
  expenses: Expense[];
  monthlyPaid: number;
  monthlyPaidCount: number;
  isLoading: boolean;

  stores: StoreItem[];
  activeStoreId: string;
  activeStoreName: string;

  isAuthenticated: boolean;
  user: UserSession | null;
  showAuthModal: boolean;
  pendingAction: (() => void) | null;
  toast: Toast | null;

  setSelectedDate: (date: string) => void;
  setActiveTab: (tab: TabId) => void;
  notify: (type: Toast['type'], message: string) => void;

  setRevenue: (date: string, revenue: DailyRevenue) => void;
  saveRevenue: (input: RevenueInput) => Promise<boolean>;
  setProfitMarginPct: (margin: number) => Promise<boolean>;
  setMonthlyExpenseBudget: (budget: number) => Promise<boolean>;

  refreshSuppliers: () => Promise<void>;
  addSupplier: (input: { name: string; phone: string; amount: number; dueDate: string }) => Promise<string | null>;
  addSupplierDebt: (supplierId: string, amount: number, dueDate: string, description?: string) => Promise<boolean>;
  deleteSupplierDebt: (supplierId: string, debtId: string) => Promise<boolean>;
  paySupplierDebt: (supplierId: string, debtId: string) => Promise<boolean>;
  paySupplierAmount: (supplierId: string, amount: number, paymentType: 'Naqd' | 'Karta') => Promise<number | null>;

  addExpense: (input: ExpenseInput) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<boolean>;

  fetchStores: () => Promise<void>;
  switchActiveStore: (storeId: string, storeName: string) => Promise<void>;
  addNewStore: (name: string) => Promise<boolean>;
  deleteStore: (storeId: string) => Promise<boolean>;
  loadStoreData: () => Promise<void>;

  restoreSession: () => Promise<void>;
  linkTelegram: () => Promise<void>;
  loginUser: (user: UserSession) => Promise<void>;
  updateSessionUser: (user: UserSession) => void;
  logoutUser: () => void;
  setShowAuthModal: (show: boolean) => void;
  setPendingAction: (action: (() => void) | null) => void;
  requireAuth: (action: () => void) => boolean;
  withAuthGuard: (action: () => void) => boolean;
}

const SESSION_KEYS = [
  'microstore_token',
  'microstore_user',
  'microstore_user_session',
  'microstore_auth',
  'activeStoreId',
  'microstore_active_store_id',
  'microstore_active_store_name',
];

// Business data used to be cached in the browser, which hid failed saves; the server is now the only source of truth.
const LEGACY_CACHE_KEYS = [
  'microstore_daily_sales',
  'microstore_revenues',
  'microstore_suppliers',
  'microstore_expenses',
  'microstore_stores',
];

const storage = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  remove: (keys: string[]) => {
    try {
      keys.forEach((key) => localStorage.removeItem(key));
    } catch {}
  },
};

storage.remove(LEGACY_CACHE_KEYS);

const loadSavedSession = (): { isAuthenticated: boolean; user: UserSession | null } => {
  try {
    const savedUser = storage.get('microstore_user');
    if (savedUser && getToken()) {
      return { isAuthenticated: true, user: JSON.parse(savedUser) };
    }
  } catch {}
  return { isAuthenticated: false, user: null };
};

const initialSession = loadSavedSession();

const persistActiveStore = (id: string, name: string) => {
  storage.set('activeStoreId', id);
  storage.set('microstore_active_store_id', id);
  storage.set('microstore_active_store_name', name);
};

const sortExpenses = (list: Expense[]) =>
  [...list].sort((a, b) =>
    a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1
  );

const errorText = (error: unknown) => (error instanceof Error ? error.message : "Xatolik yuz berdi");

export const useStore = create<AppState>((set, get) => {
  const applySupplier = (supplier: Supplier) =>
    set((state) => ({ suppliers: state.suppliers.map((s) => (s.id === supplier.id ? supplier : s)) }));

  // Runs a server write; reports failures to the user instead of silently keeping unsaved local state.
  const run = async <T>(action: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await action();
    } catch (error) {
      get().notify('error', errorText(error));
      return fallback;
    }
  };

  const applyStoreSettings = (store: StoreItem | null | undefined) => ({
    profitMarginPct: store?.profitMarginPct ?? 20,
    monthlyExpenseBudget: store?.monthlyExpenseBudget ?? 0,
  });

  return {
    selectedDate: toLocalDateString(),
    activeTab: 'seller',
    profitMarginPct: 20,
    monthlyExpenseBudget: 0,
    revenues: {},
    suppliers: [],
    expenses: [],
    monthlyPaid: 0,
    monthlyPaidCount: 0,
    isLoading: false,

    stores: [],
    activeStoreId: storage.get('activeStoreId') || '',
    activeStoreName: storage.get('microstore_active_store_name') || '',

    isAuthenticated: initialSession.isAuthenticated,
    user: initialSession.user,
    showAuthModal: false,
    pendingAction: null,
    toast: null,

    setSelectedDate: (date) => set({ selectedDate: date }),
    setActiveTab: (tab) => set({ activeTab: tab }),

    notify: (type, message) => {
      const id = Date.now();
      set({ toast: { id, type, message } });
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, 5000);
    },

    setRevenue: (date, revenue) => set((state) => ({ revenues: { ...state.revenues, [date]: revenue } })),

    saveRevenue: async (input) => {
      const storeId = get().activeStoreId;
      const total = input.cashAmount + input.terminalAmount + input.xolisAmount;

      get().setRevenue(input.entryDate, {
        entryDate: input.entryDate,
        date: input.entryDate,
        cashAmount: input.cashAmount,
        terminalAmount: input.terminalAmount,
        xolisAmount: input.xolisAmount,
        totalAmount: total,
        updatedAt: new Date().toISOString(),
      });

      try {
        const result = await saveRevenueToApi(input, { storeId });
        if (get().activeStoreId === storeId && result?.data) {
          get().setRevenue(input.entryDate, result.data);
        }
        return true;
      } catch (error) {
        if (isRetryableError(error)) {
          enqueueRevenue(storeId, input);
          get().notify('error', "Internet yo'q: tushum qurilmada saqlandi va aloqa tiklanganda avtomatik yuboriladi.");
          return true;
        }
        get().notify('error', errorText(error));
        await get().loadStoreData();
        return false;
      }
    },

    setProfitMarginPct: (margin) =>
      run(async () => {
        const res = await apiFetch('/api/v1/settings', { method: 'PUT', body: { profitMarginPct: margin } });
        set((state) => ({
          profitMarginPct: res.data.profitMarginPct,
          stores: state.stores.map((s) =>
            s.id === state.activeStoreId ? { ...s, profitMarginPct: res.data.profitMarginPct } : s
          ),
        }));
        return true;
      }, false),

    setMonthlyExpenseBudget: (budget) =>
      run(async () => {
        const res = await apiFetch('/api/v1/settings', { method: 'PUT', body: { monthlyExpenseBudget: budget } });
        set((state) => ({
          monthlyExpenseBudget: res.data.monthlyExpenseBudget,
          stores: state.stores.map((s) =>
            s.id === state.activeStoreId ? { ...s, monthlyExpenseBudget: res.data.monthlyExpenseBudget } : s
          ),
        }));
        return true;
      }, false),

    refreshSuppliers: async () => {
      const storeId = get().activeStoreId;
      try {
        const res = await apiFetch('/api/v1/suppliers');
        if (get().activeStoreId !== storeId) return;
        set({
          suppliers: res.data || [],
          monthlyPaid: res.meta?.monthlyPaid || 0,
          monthlyPaidCount: res.meta?.monthlyPaidCount || 0,
        });
      } catch (error) {
        console.warn('refreshSuppliers error:', error);
      }
    },

    addSupplier: (input) =>
      run(async () => {
        const res = await apiFetch('/api/v1/suppliers', { method: 'POST', body: input });
        set((state) => ({ suppliers: [res.data, ...state.suppliers] }));
        return res.data.id as string | null;
      }, null),

    addSupplierDebt: (supplierId, amount, dueDate, description) =>
      run(async () => {
        const res = await apiFetch(`/api/v1/suppliers/${supplierId}/debts`, {
          method: 'POST',
          body: { amount, dueDate, description },
        });
        applySupplier(res.supplier);
        return true;
      }, false),

    deleteSupplierDebt: (supplierId, debtId) =>
      run(async () => {
        const res = await apiFetch(`/api/v1/suppliers/${supplierId}/debts/${debtId}`, { method: 'DELETE' });
        applySupplier(res.supplier);
        return true;
      }, false),

    paySupplierDebt: (supplierId, debtId) =>
      run(async () => {
        const res = await apiFetch(`/api/v1/suppliers/${supplierId}/debts/${debtId}/pay`, { method: 'PATCH' });
        applySupplier(res.supplier);
        void get().refreshSuppliers();
        return true;
      }, false),

    paySupplierAmount: (supplierId, amount, paymentType) =>
      run(async () => {
        const res = await apiFetch(`/api/v1/suppliers/${supplierId}/transaction`, {
          method: 'POST',
          headers: { 'X-Client-Tx-Id': crypto.randomUUID() },
          body: { type: 'DECREASE_DEBT', amount, paymentType },
        });
        applySupplier(res.supplier);
        void get().refreshSuppliers();
        return (res.applied as number) ?? amount;
      }, null as number | null),

    addExpense: (input) =>
      run(async () => {
        const res = await apiFetch('/api/v1/expenses', { method: 'POST', body: input });
        set((state) => ({ expenses: sortExpenses([res.data, ...state.expenses]) }));
        return true;
      }, false),

    deleteExpense: (id) =>
      run(async () => {
        await apiFetch(`/api/v1/expenses/${id}`, { method: 'DELETE' });
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
        return true;
      }, false),

    fetchStores: async () => {
      try {
        const res = await apiFetch('/api/v1/stores');
        const list: StoreItem[] = res.data || [];
        const savedId = storage.get('activeStoreId');
        const current =
          list.find((s) => s.id === savedId) || list.find((s) => s.id === get().user?.storeId) || list[0] || null;

        if (current) persistActiveStore(current.id, current.name);
        set({
          stores: list,
          activeStoreId: current?.id || '',
          activeStoreName: current?.name || '',
          ...applyStoreSettings(current),
        });
      } catch (error) {
        console.warn('fetchStores error:', error);
        get().notify('error', errorText(error));
      }
    },

    loadStoreData: async () => {
      const storeId = get().activeStoreId;
      const isCashier = get().user?.role === 'cashier';
      set({ isLoading: true });

      const [revenues, suppliers, expenses] = await Promise.allSettled([
        apiFetch('/api/v1/revenues'),
        isCashier ? Promise.resolve(null) : apiFetch('/api/v1/suppliers'),
        isCashier ? Promise.resolve(null) : apiFetch('/api/v1/expenses'),
      ]);

      if (get().activeStoreId !== storeId) return;

      const patch: Partial<AppState> = { isLoading: false };

      if (revenues.status === 'fulfilled') {
        const map: Record<string, DailyRevenue> = {};
        (revenues.value.data || []).forEach((r: DailyRevenue) => {
          if (r.entryDate) map[r.entryDate] = r;
        });
        patch.revenues = map;
      }
      if (suppliers.status === 'fulfilled' && suppliers.value) {
        patch.suppliers = suppliers.value.data || [];
        patch.monthlyPaid = suppliers.value.meta?.monthlyPaid || 0;
        patch.monthlyPaidCount = suppliers.value.meta?.monthlyPaidCount || 0;
      }
      if (expenses.status === 'fulfilled' && expenses.value) {
        patch.expenses = sortExpenses(expenses.value.data || []);
      }

      set(patch);

      const failed = [revenues, suppliers, expenses].find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      if (failed && !(failed.reason instanceof ApiError && failed.reason.status === 401)) {
        get().notify('error', `Ma'lumotlarni yuklab bo'lmadi: ${errorText(failed.reason)}`);
      }
    },

    switchActiveStore: async (storeId, storeName) => {
      persistActiveStore(storeId, storeName);
      const store = get().stores.find((s) => s.id === storeId);

      set({
        activeStoreId: storeId,
        activeStoreName: storeName,
        revenues: {},
        suppliers: [],
        expenses: [],
        monthlyPaid: 0,
        monthlyPaidCount: 0,
        ...applyStoreSettings(store),
      });

      await get().loadStoreData();
    },

    addNewStore: (name) =>
      run(async () => {
        const res = await apiFetch('/api/v1/stores', { method: 'POST', body: { name: name.trim() } });
        const created: StoreItem = res.data;
        set((state) => ({ stores: [...state.stores.filter((s) => s.id !== created.id), created] }));
        await get().switchActiveStore(created.id, created.name);
        return true;
      }, false),

    deleteStore: (storeId) =>
      run(async () => {
        await apiFetch(`/api/v1/stores/${storeId}`, { method: 'DELETE', storeId: get().activeStoreId });
        const remaining = get().stores.filter((s) => s.id !== storeId);
        set({ stores: remaining });

        if (get().activeStoreId === storeId && remaining.length > 0) {
          await get().switchActiveStore(remaining[0].id, remaining[0].name);
        }
        return true;
      }, false),

    restoreSession: async () => {
      // Opened as a Telegram Mini App: an account that was linked before signs in without a password.
      const telegramLogin = async (): Promise<boolean> => {
        const initData = getTelegramInitData();
        if (!initData) return false;
        try {
          const data = await apiFetch('/api/v1/auth/telegram', { method: 'POST', auth: false, body: { initData } });
          setToken(data.token);
          await get().loginUser(data.user);
          return true;
        } catch {
          return false;
        }
      };

      if (!getToken()) {
        if (await telegramLogin()) return;
        set({ isAuthenticated: false, user: null, showAuthModal: true });
        return;
      }

      try {
        const res = await apiFetch('/api/v1/auth/me');
        await get().loginUser(res.user);
        if (getTelegramInitData()) void get().linkTelegram();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          // The saved session expired (the 401 already logged the user out): try Telegram before asking for a password.
          await telegramLogin();
        } else if (get().isAuthenticated) {
          // Network problem: keep the cached session and retry loading the data.
          get().notify('error', errorText(error));
          await get().fetchStores();
          await get().loadStoreData();
        }
      }
    },

    // Links the signed-in account to the Telegram user who opened the Mini App (enables passwordless sign-in and reminders).
    linkTelegram: async () => {
      const initData = getTelegramInitData();
      if (!initData || !getToken()) return;
      try {
        const res = await apiFetch('/api/v1/auth/telegram/link', { method: 'POST', body: { initData } });
        if (res.botStarted === false) {
          get().notify('error', "Eslatmalar olish uchun bot chatiga qaytib, START tugmasini bosing.");
        }
      } catch (error) {
        console.warn('linkTelegram error:', error);
      }
    },

    loginUser: async (user) => {
      storage.set('microstore_user', JSON.stringify(user));
      set({
        isAuthenticated: true,
        user,
        showAuthModal: false,
        activeTab: 'seller',
        revenues: {},
        suppliers: [],
        expenses: [],
      });

      await get().fetchStores();
      await get().loadStoreData();

      const pending = get().pendingAction;
      if (pending) {
        set({ pendingAction: null });
        pending();
      }
    },

    updateSessionUser: (user) => {
      storage.set('microstore_user', JSON.stringify(user));
      set({ user });
    },

    logoutUser: () => {
      // Signing out inside Telegram also unlinks it; otherwise the Mini App would sign straight back in.
      if (getTelegramInitData() && getToken()) {
        apiFetch('/api/v1/auth/telegram/link', { method: 'DELETE' }).catch(() => {});
      }
      storage.remove(SESSION_KEYS);
      set({
        isAuthenticated: false,
        user: null,
        stores: [],
        activeStoreId: '',
        activeStoreName: '',
        revenues: {},
        expenses: [],
        suppliers: [],
        monthlyPaid: 0,
        monthlyPaidCount: 0,
        profitMarginPct: 20,
        monthlyExpenseBudget: 0,
        pendingAction: null,
        showAuthModal: true,
      });
    },

    setShowAuthModal: (show) => set({ showAuthModal: show }),
    setPendingAction: (action) => set({ pendingAction: action }),

    requireAuth: (action) => {
      if (get().isAuthenticated) {
        action();
        return true;
      }
      set({ pendingAction: action, showAuthModal: true });
      return false;
    },

    withAuthGuard: (action) => get().requireAuth(action),
  };
});

setUnauthorizedHandler(() => {
  if (useStore.getState().isAuthenticated) useStore.getState().logoutUser();
});
