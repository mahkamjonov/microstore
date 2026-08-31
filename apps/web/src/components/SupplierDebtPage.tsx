import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { Supplier } from '../types';
import { getApiBaseUrl } from '../api/config';

export const SupplierDebtPage: React.FC = () => {
  const { suppliers, updateSupplierBalance, addSupplier, withAuthGuard } = useStore();
  const { queueItem } = useOfflineSync();

  // Selected supplier for payment form
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'Naqd' | 'Karta'>('Naqd');
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');

  // Dynamic Debt Payments Trackers (Initial state: 0 UZS, 0 transactions)
  const [monthlyPaid, setMonthlyPaid] = useState<number>(0);
  const [paidTxCount, setPaidTxCount] = useState<number>(0);

  // Add New Supplier Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>('');
  const [newSupplierBalance, setNewSupplierBalance] = useState<string>('');
  const [newSupplierDueDate, setNewSupplierDueDate] = useState<string>('');

  const today = new Date();

  // KPI Calculations
  const totalDebt = suppliers.reduce((acc: number, s: any) => acc + (s.currentBalance || 0), 0);

  // Urgent debts (<= 3 days left or overdue)
  const urgentDebt = suppliers.reduce((acc: number, s: any) => {
    if (!s.dueDate) return acc;
    const due = new Date(s.dueDate);
    const diffTime = due.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysLeft <= 3 && (s.currentBalance || 0) > 0) {
      return acc + (s.currentBalance || 0);
    }
    return acc;
  }, 0);

  const formatNumberInput = (val: string) => {
    const clean = val.replace(/\D/g, '');
    return clean ? parseInt(clean, 10).toLocaleString('ru-RU') : '';
  };

  const processPayment = () => {
    const val = parseFloat(paymentAmount.replace(/\s/g, '')) || 0;
    if (val <= 0 || !selectedSupplierId) return;

    const targetSup = suppliers.find((s) => s.id === selectedSupplierId);
    if (!targetSup) return;

    // Reduce debt dynamically
    updateSupplierBalance(selectedSupplierId, -val);
    setMonthlyPaid((prev) => prev + val);
    setPaidTxCount((prev) => prev + 1);

    queueItem('SUPPLIER_TX', {
      supplierId: selectedSupplierId,
      type: 'DECREASE_DEBT',
      amount: val,
      paymentType,
    });

    setToastMsg(`${targetSup.name} uchun ${val.toLocaleString('ru-RU')} so'm to'lov amalga oshirildi!`);
    setShowSuccessToast(true);
    setPaymentAmount('');
    setTimeout(() => setShowSuccessToast(false), 3500);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    withAuthGuard(() => processPayment());
  };

  const processAddSupplier = async () => {
    if (!newSupplierName.trim()) return;

    const initialBal = parseFloat(newSupplierBalance.replace(/\s/g, '')) || 0;
    const dueDateStr = newSupplierDueDate || new Date().toISOString().split('T')[0];

    const newSup: Supplier = {
      id: `sup-${Date.now()}`,
      name: newSupplierName.trim(),
      phone: newSupplierPhone.trim() || '+998 90 000 00 00',
      currentBalance: initialBal,
      dueDate: dueDateStr,
      createdAt: new Date().toISOString(),
    };

    addSupplier(newSup);

    // Sync to backend Express API server dynamically
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem('microstore_token') || '';
      await fetch(`${baseUrl}/api/debts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          supplierName: newSup.name,
          amount: initialBal,
          dueDate: dueDateStr,
          phone: newSup.phone,
        }),
      });
    } catch (err) {
      console.error('Failed to sync supplier debt to API server:', err);
    }

    setSelectedSupplierId(newSup.id);
    setShowAddModal(false);
    setNewSupplierName('');
    setNewSupplierPhone('');
    setNewSupplierBalance('');
  };

  const handleAddSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    withAuthGuard(() => processAddSupplier());
  };

  const getSupplierStatusBadge = (dueDateStr?: string, balance: number = 0) => {
    if (balance === 0) {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full whitespace-nowrap text-[11px] font-semibold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]">
          Qarz yo'q
        </span>
      );
    }

    if (!dueDateStr) {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full whitespace-nowrap text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
          Kutilmoqda
        </span>
      );
    }

    const due = new Date(dueDateStr);
    const diffTime = due.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft <= 3) {
      const daysText = daysLeft <= 0 ? "Muddati o'tdi" : `${daysLeft} kun`;
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full whitespace-nowrap text-[11px] font-semibold bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5] animate-pulse">
          Shoshilinch ({daysText})
        </span>
      );
    }

    return (
      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full whitespace-nowrap text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
        Kutilmoqda
      </span>
    );
  };

  const { user } = useStore();
  const isCashier = user?.role === 'cashier';

  if (isCashier) {
    return (
      <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant shadow-sm text-center flex flex-col items-center justify-center gap-3 my-6 max-w-xl mx-auto">
        <span className="material-symbols-outlined text-amber-600 text-4xl">lock</span>
        <h3 className="font-headline font-bold text-base text-on-surface">Kassir Rejimi: Cheklangan Kirish</h3>
        <p className="text-xs text-on-surface-variant max-w-md">
          Ushbu ta'minotchilar qarzlari bo'limi faqat do'kon egasi (Admin) uchun ochiq. Sotuvchilar faqat kunlik tushumlarni kiritish funksiyasidan foydalanishi mumkin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto py-2 pb-12">
      {/* 1. Top Summary Metric Cards directly at top */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Card 1 (Blue): Jami qarz */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-secondary/30 bg-secondary/5 shadow-sm flex flex-col justify-between gap-1.5">
          <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
            Jami Qarz
          </span>
          <p className="font-currency text-2xl font-black text-secondary">
            {totalDebt.toLocaleString('ru-RU')}{' '}
            <span className="text-xs font-bold">so'm</span>
          </p>
          <p className="text-[11px] text-on-surface-variant font-semibold">
            {suppliers.length > 0 ? `${suppliers.length} ta ta'minotchi bo'yicha` : "Ta'minotchilar yo'q"}
          </p>
        </div>

        {/* Card 2 (Red Alert): Shoshilinch to'lovlar */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-error/30 bg-error-container/20 shadow-sm flex flex-col justify-between gap-1.5">
          <span className="text-[11px] font-bold text-error uppercase tracking-wider">
            Shoshilinch To'lovlar
          </span>
          <p className="font-currency text-2xl font-black text-error">
            {urgentDebt.toLocaleString('ru-RU')}{' '}
            <span className="text-xs font-bold">so'm</span>
          </p>
          <p className="text-[11px] text-error font-bold">
            Muddati 3 kun ichida tugaydigan qarzlar
          </p>
        </div>

        {/* Card 3 (Green): Oylik to'langan */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-emerald-300 bg-emerald-50 shadow-sm flex flex-col justify-between gap-1.5">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
            Oylik To'langan
          </span>
          <p className="font-currency text-2xl font-black text-emerald-800">
            {monthlyPaid.toLocaleString('ru-RU')}{' '}
            <span className="text-xs font-bold">so'm</span>
          </p>
          <p className="text-[11px] text-emerald-700 font-bold">
            {paidTxCount > 0
              ? `${paidTxCount} ta to'lov o'tkazildi`
              : "Ushbu oyda to'lab berilgan jami qarz"}
          </p>
        </div>
      </div>

      {/* 2. Vertical Single-Column Layout */}

      {/* TOP BLOCK (100% Width): "Ta'minotchilar Qarzlari Ro'yxati" Table */}
      <div className="w-full bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-surface-variant pb-3">
          <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">format_list_bulleted</span>
            Ta'minotchilar Qarzlari Ro'yxati
          </h3>

          <button
            onClick={() => withAuthGuard(() => setShowAddModal(true))}
            className="flex items-center gap-1 bg-primary hover:bg-primary-container text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            + Yangi Ta'minotchi
          </button>
        </div>

        {/* 100% Width Table Container without horizontal scrollbars */}
        <div className="w-full overflow-hidden rounded-xl border border-outline-variant">
          <table className="w-full text-left text-xs border-collapse table-auto">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-bold border-b border-outline-variant">
                <th className="py-3 px-3 align-middle w-[30%]">Ta'minotchi Nomi & Tel</th>
                <th className="py-3 px-3 text-right align-middle w-[20%]">Jami Qarz</th>
                <th className="py-3 px-3 align-middle w-[15%]">To'lov Muddati</th>
                <th className="py-3 px-3 align-middle w-[20%]">Holat</th>
                <th className="py-3 px-3 text-right align-middle w-[15%]">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant bg-surface-container-lowest">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-on-surface-variant font-medium">
                    Ta'minotchilar mavjud emas
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="py-3 px-3 align-middle w-[30%]">
                      <span className="font-semibold text-on-surface block text-sm group-hover:text-primary transition-colors">
                        {s.name}
                      </span>
                      {s.phone && (
                        <a
                          href={`tel:${s.phone.replace(/\s/g, '')}`}
                          className="text-[12px] font-medium text-secondary hover:underline flex items-center gap-1 mt-0.5 whitespace-nowrap"
                        >
                          <span className="material-symbols-outlined text-[13px]">call</span>
                          {s.phone}
                        </a>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right align-middle font-currency font-extrabold text-sm text-error whitespace-nowrap w-[20%]">
                      {s.currentBalance.toLocaleString('ru-RU')} so'm
                    </td>

                    <td className="py-3 px-3 align-middle font-semibold text-on-surface-variant whitespace-nowrap w-[15%]">
                      {s.dueDate || 'Belgilanmagan'}
                    </td>

                    <td className="py-3 px-3 align-middle w-[20%]">
                      {getSupplierStatusBadge(s.dueDate, s.currentBalance)}
                    </td>

                    <td className="py-3 px-3 text-right align-middle w-[15%]">
                      <button
                        onClick={() => {
                          setSelectedSupplierId(s.id);
                          const el = document.getElementById('payment-form-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="bg-secondary/10 hover:bg-secondary hover:text-white text-secondary font-bold px-3 py-1.5 rounded-lg border border-secondary/30 text-[11px] transition-all active:scale-95 shadow-xs whitespace-nowrap"
                      >
                        To'lash
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTTOM BLOCK (100% Width Dedicated Section): "Ta'minotchi Qarzini To'lash" Form */}
      <div
        id="payment-form-section"
        className="w-full bg-surface-container-lowest p-4 md:p-6 rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-4"
      >
        <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2 border-b border-surface-variant pb-3">
          <span className="material-symbols-outlined text-secondary">payments</span>
          Ta'minotchi Qarzini To'lash (To'lov Paneli)
        </h3>

        <form onSubmit={handlePaymentSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end w-full">
          <div className="w-full md:col-span-4">
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              1. Ta'minotchi Nomi
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              required
              className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2.5 text-xs font-semibold text-on-surface focus:outline-none focus:border-secondary"
            >
              {suppliers.length === 0 ? (
                <option value="">Ta'minotchilar yo'q</option>
              ) : (
                suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.currentBalance.toLocaleString('ru-RU')} so'm)
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="w-full md:col-span-3">
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              2. Summa (so'm)
            </label>
            <input
              type="text"
              placeholder="0"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(formatNumberInput(e.target.value))}
              required
              className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3.5 py-2 text-base font-bold text-on-surface focus:outline-none focus:border-secondary font-currency"
            />
          </div>

          <div className="w-full md:col-span-3">
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              3. To'lov Turi
            </label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as any)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2.5 text-xs font-semibold text-on-surface focus:outline-none focus:border-secondary"
            >
              <option value="Naqd">Naqd pul</option>
              <option value="Karta">Bank kartasi</option>
            </select>
          </div>

          <div className="w-full md:col-span-2">
            <button
              type="submit"
              className="w-full h-[42px] bg-secondary hover:bg-blue-700 text-white rounded-xl font-headline font-bold text-xs shadow transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              To'lash
            </button>
          </div>
        </form>

        {showSuccessToast && (
          <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold text-center animate-bounce flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{toastMsg}</span>
          </div>
        )}
      </div>

      {/* Add New Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-surface-container-lowest rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-outline-variant flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-surface-variant pb-3">
              <h3 className="font-headline font-bold text-base text-on-surface">
                Yangi Ta'minotchi Qo'shish
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddSupplierSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Ta'minotchi Nomi
                </label>
                <input
                  type="text"
                  placeholder="Masalan: TAAM Sut Mahsulotlari"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  required
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Telefon Raqami
                </label>
                <input
                  type="text"
                  placeholder="+998 90 123 45 67"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Boshlang'ich Qarz Summasi (so'm)
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={newSupplierBalance}
                  onChange={(e) => setNewSupplierBalance(formatNumberInput(e.target.value))}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none focus:border-primary font-currency"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  To'lov Muddati (Due Date)
                </label>
                <input
                  type="date"
                  value={newSupplierDueDate}
                  onChange={(e) => setNewSupplierDueDate(e.target.value)}
                  required
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-semibold text-xs hover:bg-surface-container"
                >
                  Bekor Qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-primary hover:bg-primary-container shadow transition-transform active:scale-95"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
