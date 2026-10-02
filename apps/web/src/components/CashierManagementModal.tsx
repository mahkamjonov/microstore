import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import { useStore } from '../store/useStore';

interface CashierItem {
  id: string;
  name: string;
  phone: string;
  role: string;
  storeId: string;
}

interface CashierManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashierManagementModal: React.FC<CashierManagementModalProps> = ({ isOpen, onClose }) => {
  const { activeStoreId, activeStoreName, notify } = useStore();
  const [cashiers, setCashiers] = useState<CashierItem[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      fetchCashiers();
    }
  }, [isOpen, activeStoreId]);

  const fetchCashiers = async () => {
    try {
      const data = await apiFetch('/api/v1/auth/cashiers');
      setCashiers(Array.isArray(data.cashiers) ? data.cashiers : []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Sotuvchilar ro'yxatini olib bo'lmadi");
    }
  };

  const handleAddCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim() || !phone.trim() || !password.trim()) {
      setErrorMsg("Barcha maydonlarni (Ism, Telefon yoki Login va Parol) to'ldiring!");
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch('/api/v1/auth/cashiers', {
        method: 'POST',
        body: { name, login: phone, password },
      });
      setSuccessMsg(`✅ ${name} muvaffaqiyatli sotuvchi (kassir) sifatida qo'shildi!`);
      setName('');
      setPhone('');
      setPassword('');
      fetchCashiers();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Sotuvchi qo'shishda xatolik yuz berdi!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCashier = async (cashier: CashierItem) => {
    if (!window.confirm(`${cashier.name} sotuvchisini o'chirmoqchimisiz? U tizimga kira olmaydi.`)) return;
    try {
      await apiFetch(`/api/v1/auth/cashiers/${cashier.id}`, { method: 'DELETE' });
      setCashiers((prev) => prev.filter((c) => c.id !== cashier.id));
      notify('success', `${cashier.name} o'chirildi.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Sotuvchini o'chirib bo'lmadi");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-lg bg-surface border border-outline-variant/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-headline font-black text-on-surface">Sotuvchilar (Kassirlar)</h3>
            <p className="text-xs text-on-surface-variant font-medium">
              "{activeStoreName}" do'koniga yangi sotuvchi biriktiring va hisoblarni boshqaring
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 text-xs font-medium text-center">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-700 text-xs font-medium text-center">
            {successMsg}
          </div>
        )}

        {/* Form to Add Cashier */}
        <form onSubmit={handleAddCashier} className="space-y-3 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/40 mb-6">
          <h4 className="text-xs font-headline font-bold text-on-surface uppercase tracking-wider mb-2">
            + Yangi Sotuvchi Qo'shish
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Sotuvchi Ismi</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: Jasur"
                className="w-full px-3 py-2 bg-surface border border-outline-variant/60 rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Telefon yoki Login</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 999 88 77 yoki login"
                className="w-full px-3 py-2 bg-surface border border-outline-variant/60 rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Sotuvchi Paroli</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sotuvchining kirish paroli"
              className="w-full px-3 py-2 bg-surface border border-outline-variant/60 rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-headline font-bold text-xs shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 mt-1"
          >
            {isLoading ? 'Saqlanmoqda...' : "Sotuvchini Biriktirish"}
          </button>
        </form>

        {/* Existing Cashiers List */}
        <div>
          <h4 className="text-xs font-headline font-bold text-on-surface uppercase tracking-wider mb-2">
            Mavjud Sotuvchilar ({cashiers.length})
          </h4>
          {cashiers.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-4 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant">
              Hali birorta ham sotuvchi qo'shilmagan
            </p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {cashiers.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-700 font-bold text-xs flex items-center justify-center">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-on-surface">{c.name}</p>
                      <p className="text-[10px] text-on-surface-variant font-mono">{c.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md uppercase">
                      Sotuvchi
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCashier(c)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Sotuvchini o'chirish"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
