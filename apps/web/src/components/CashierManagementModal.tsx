import React, { useState, useEffect } from 'react';
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

import { getApiBaseUrl, hasLiveApiBackend } from '../api/config';

export const CashierManagementModal: React.FC<CashierManagementModalProps> = ({ isOpen, onClose }) => {
  const { user } = useStore();
  const [cashiers, setCashiers] = useState<CashierItem[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCashiers();
    }
  }, [isOpen]);

  const fetchCashiers = async () => {
    if (!hasLiveApiBackend()) return;
    try {
      const token = localStorage.getItem('microstore_token') || '';
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/auth/cashiers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.cashiers)) {
        setCashiers(data.cashiers);
      }
    } catch (err) {
      console.error('Failed to fetch cashiers:', err);
    }
  };

  const handleAddCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim() || !phone.trim() || !password.trim()) {
      setErrorMsg("Barcha maydonlarni (Ism, Telefon va Parol) to'ldiring!");
      return;
    }

    setIsLoading(true);

    if (!hasLiveApiBackend()) {
      const newCashier: CashierItem = { id: `cashier-${Date.now()}`, name, phone, role: 'cashier', storeId: user?.storeId || 'store_main' };
      setCashiers((prev) => [...prev, newCashier]);
      setSuccessMsg("Yangi sotuvchi (kassir) muvaffaqiyatli qo'shildi");
      setName('');
      setPhone('');
      setPassword('');
      setIsLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('microstore_token') || '';
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/auth/cashiers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          phone,
          password,
          storeId: user?.storeId || 'store_main',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error?.message || "Sotuvchi qo'shishda xatolik yuz berdi!");
        setIsLoading(false);
        return;
      }

      setSuccessMsg(`✅ ${name} muvaffaqiyatli sotuvchi (kassir) sifatida qo'shildi!`);
      setName('');
      setPhone('');
      setPassword('');
      setIsLoading(false);
      fetchCashiers();
    } catch (err) {
      console.error('Add cashier error:', err);
      setErrorMsg("Server bilan aloqa o'rnatib bo'lmadi!");
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-lg bg-surface border border-outline-variant/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
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
            <p className="text-xs text-on-surface-variant font-medium">Do'konga yangi sotuvchi biriktiring va hisoblarni boshqaring</p>
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
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Telefon Raqami</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 999 88 77"
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
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md uppercase">
                    Sotuvchi
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
