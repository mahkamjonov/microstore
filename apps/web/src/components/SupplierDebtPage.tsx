import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { Supplier } from '../types';
import { getApiBaseUrl } from '../api/config';

export const SupplierDebtPage: React.FC = () => {
  const {
    suppliers,
    updateSupplierBalance,
    addSupplier,
    addSupplierDebt,
    deleteSupplierDebt,
    paySupplierDebt,
    withAuthGuard,
  } = useStore();
  const { queueItem } = useOfflineSync();

  // Accordion Expand State for Sub-Debts Table
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Record<string, boolean>>({});

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

  // Add Additional Debt Tranche Modal State
  const [showAddDebtModal, setShowAddDebtModal] = useState<boolean>(false);
  const [debtSupplier, setDebtSupplier] = useState<Supplier | null>(null);
  const [additionalDebtAmount, setAdditionalDebtAmount] = useState<string>('');
  const [additionalDebtDescription, setAdditionalDebtDescription] = useState<string>('');
  const [additionalDebtDueDate, setAdditionalDebtDueDate] = useState<string>('');
  const [isSubmittingDebt, setIsSubmittingDebt] = useState<boolean>(false);

  const today = new Date();

  const toggleExpandSupplier = (id: string) => {
    setExpandedSupplierIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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

  const handleOpenAddDebtModal = (supplier: Supplier) => {
    setDebtSupplier(supplier);
    setAdditionalDebtAmount('');
    setAdditionalDebtDescription('');
    const defaultDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    setAdditionalDebtDueDate(defaultDate);
    setShowAddDebtModal(true);
  };

  const processAddDebt = async () => {
    if (!debtSupplier || !additionalDebtAmount || isSubmittingDebt) return;
    const val = parseFloat(additionalDebtAmount.replace(/\s/g, '')) || 0;
    if (val <= 0) return;

    setIsSubmittingDebt(true);
    const dueDateStr = additionalDebtDueDate || new Date().toISOString().split('T')[0];
    const descStr = additionalDebtDescription.trim() || "Sut va oziq-ovqat mahsuloti";

    try {
      addSupplierDebt(debtSupplier.id, val, dueDateStr, descStr);

      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem('microstore_token') || '';
      await fetch(`${baseUrl}/api/v1/suppliers/${debtSupplier.id}/debts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ amount: val, dueDate: dueDateStr, description: descStr }),
      });

      setToastMsg(`${debtSupplier.name} uchun ${val.toLocaleString('ru-RU')} so'm yangi qarz qo'shildi!`);
      setShowSuccessToast(true);
      setShowAddDebtModal(false);
      setDebtSupplier(null);
      setAdditionalDebtAmount('');
      setAdditionalDebtDescription('');
      setTimeout(() => setShowSuccessToast(false), 3500);
    } catch (err) {
      console.error('Failed to add supplier debt tranche:', err);
    } finally {
      setIsSubmittingDebt(false);
    }
  };

  const handleAddDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    withAuthGuard(() => processAddDebt());
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
          Ushbu ta'minotchilar qarzlari bo'limi faqat do'kon egasi (Admin) uchun ochoq. Sotuvchilar faqat kunlik tushumlarni kiritish funksiyasidan foydalanishi mumkin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto py-2 pb-12">
      {/* 1. Top Summary Metric Cards */}
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

        {/* Table Container */}
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
                suppliers.map((s) => {
                  const isExpanded = !!expandedSupplierIds[s.id];
                  const debtsList = s.debts || [];
                  return (
                    <React.Fragment key={s.id}>
                      <tr className="hover:bg-primary/5 transition-colors group">
                        <td className="py-3 px-3 align-middle w-[30%]">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExpandSupplier(s.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors flex-shrink-0"
                              title="Qarzlar tafsilotini ko'rish"
                            >
                              <span className="material-symbols-outlined text-lg transition-transform duration-200">
                                {isExpanded ? 'expand_less' : 'expand_more'}
                              </span>
                            </button>
                            <div className="min-w-0">
                              <span className="font-bold text-on-surface block text-sm group-hover:text-primary transition-colors truncate">
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
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right align-middle font-currency font-extrabold text-sm text-error whitespace-nowrap w-[20%]">
                          {s.currentBalance.toLocaleString('ru-RU')} so'm
                        </td>

                        <td className="py-3 px-3 align-middle font-semibold text-on-surface-variant whitespace-nowrap w-[15%]">
                          {s.dueDate ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[11px] font-extrabold px-2 py-0.5 rounded-md border border-amber-200">
                              Eng yaqin: {s.dueDate}
                            </span>
                          ) : (
                            'Belgilanmagan'
                          )}
                        </td>

                        <td className="py-3 px-3 align-middle w-[20%]">
                          {getSupplierStatusBadge(s.dueDate, s.currentBalance)}
                        </td>

                        <td className="py-3 px-3 text-right align-middle w-[15%]">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => withAuthGuard(() => handleOpenAddDebtModal(s))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm border border-emerald-200 transition-colors shadow-2xs"
                              title="Yangi qarz qo'shish"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSupplierId(s.id);
                                const el = document.getElementById('payment-form-section');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="rounded-lg bg-sky-50 hover:bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 border border-sky-200 transition-colors shadow-2xs whitespace-nowrap"
                            >
                              To'lash
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Accordion Sub-Row: Detailed Debt Breakdown Table */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-outline-variant/60">
                          <td colSpan={5} className="p-3 sm:p-4">
                            <div className="bg-surface rounded-2xl p-4 border border-outline-variant/60 shadow-sm flex flex-col gap-3">
                              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-base text-emerald-600">receipt_long</span>
                                  <span className="text-xs font-extrabold text-slate-800">
                                    {s.name} — Barcha Qarz Transhlari Tafsiloti ({debtsList.length} ta)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => withAuthGuard(() => handleOpenAddDebtModal(s))}
                                  className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-xl transition-colors flex items-center gap-1 shadow-2xs"
                                >
                                  <span className="material-symbols-outlined text-sm">add</span>
                                  <span>Qarz qo'shish</span>
                                </button>
                              </div>

                              {debtsList.length === 0 ? (
                                <div className="text-center py-4 text-xs font-semibold text-slate-500 bg-slate-50 rounded-xl">
                                  Alohida tranzaksiyalar qayd etilmagan. Umumiy balans: {s.currentBalance.toLocaleString('ru-RU')} so'm
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="text-slate-600 font-bold border-b border-slate-200 bg-slate-100">
                                        <th className="py-2.5 px-3">Olingan sana</th>
                                        <th className="py-2.5 px-3">Izoh / Tovar</th>
                                        <th className="py-2.5 px-3 text-right">Summa</th>
                                        <th className="py-2.5 px-3">To'lov muddati</th>
                                        <th className="py-2.5 px-3">Holat</th>
                                        <th className="py-2.5 px-3 text-right">Amal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {debtsList.map((d) => {
                                        const isPaid = d.status === 'paid';
                                        return (
                                          <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-2.5 px-3 font-semibold text-slate-500">
                                              {d.createdAt ? new Date(d.createdAt).toISOString().split('T')[0] : '—'}
                                            </td>
                                            <td className="py-2.5 px-3 font-bold text-slate-800">
                                              {d.description || "Sut va oziq-ovqat mahsuloti"}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-currency font-extrabold text-error whitespace-nowrap">
                                              {d.amount.toLocaleString('ru-RU')} so'm
                                            </td>
                                            <td className="py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">
                                              {d.dueDate || 'Belgilanmagan'}
                                            </td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                              {isPaid ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                  To'langan
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                                  Kutilmoqda
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                              <div className="flex items-center justify-end gap-1.5">
                                                {!isPaid && (
                                                  <button
                                                    type="button"
                                                    onClick={() => paySupplierDebt(s.id, d.id)}
                                                    className="px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold text-xs border border-sky-300 transition-colors"
                                                  >
                                                    To'lash
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={() => deleteSupplierDebt(s.id, d.id)}
                                                  className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                  title="Transhni o'chirish"
                                                >
                                                  <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTTOM BLOCK: "Ta'minotchi Qarzini To'lash" Form */}
      <div
        id="payment-form-section"
        className="w-full bg-surface-container-lowest p-4 md:p-6 rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-4"
      >
        <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2 border-b border-surface-variant pb-3">
          <span className="material-symbols-outlined text-secondary">payments</span>
          Ta'minotchi Qarzini To'lash (To'lov Paneli)
        </h3>

        <form onSubmit={handlePaymentSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end w-full">
          <div className="md:col-span-4 flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface-variant">Ta'minotchi</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface font-bold text-xs focus:border-secondary outline-none"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.currentBalance.toLocaleString('ru-RU')} so'm)
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface-variant">To'lov Summasi (so'm)</label>
            <input
              type="text"
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(formatNumberInput(e.target.value))}
              placeholder="Masalan: 500,000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface font-extrabold text-xs focus:border-secondary outline-none"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-on-surface-variant">To'lov Turi</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface font-bold text-xs focus:border-secondary outline-none"
            >
              <option value="Naqd">Naqd</option>
              <option value="Karta">Karta</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-secondary hover:bg-secondary/90 text-white font-extrabold text-xs transition-transform active:scale-95 shadow-sm"
            >
              To'lovni Tasdiqlash
            </button>
          </div>
        </form>
      </div>

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp">
          <span className="material-symbols-outlined text-xl">check_circle</span>
          <span className="text-xs font-bold">{toastMsg}</span>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[99999] bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-5 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-surface-variant pb-2.5">
              <h4 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person_add</span>
                Yangi Ta'minotchi Qo'shish
              </h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-variant flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleAddSupplierSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Ta'minotchi Nomi *
                </label>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Masalan: Oazis Distribyutori"
                  required
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Telefon Raqami (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Boshlang'ich Qarz Summasi (so'm)
                </label>
                <input
                  type="text"
                  value={newSupplierBalance}
                  onChange={(e) => setNewSupplierBalance(formatNumberInput(e.target.value))}
                  placeholder="0"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary font-currency"
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

      {/* Add Debt Tranche Modal Popup */}
      {showAddDebtModal && debtSupplier && (
        <div className="fixed inset-0 z-[99999] bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-5 sm:p-6 shadow-2xl max-w-md w-full flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2.5 border-b border-outline-variant/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-xl">add_circle</span>
                <h4 className="font-headline font-bold text-base text-on-surface">
                  Yangi Qarz Qo'shish — {debtSupplier.name}
                </h4>
              </div>
              <button
                type="button"
                disabled={isSubmittingDebt}
                onClick={() => setShowAddDebtModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-variant flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleAddDebtSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface-variant">
                  Qarz Summasi (so'm) *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmittingDebt}
                  value={additionalDebtAmount}
                  onChange={(e) => setAdditionalDebtAmount(formatNumberInput(e.target.value))}
                  placeholder="Masalan: 1,500,000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface font-extrabold text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface-variant">
                  Izoh / Tovar Nomi (ixtiyoriy)
                </label>
                <input
                  type="text"
                  disabled={isSubmittingDebt}
                  value={additionalDebtDescription}
                  onChange={(e) => setAdditionalDebtDescription(e.target.value)}
                  placeholder="Masalan: Sut va qatiq 1-partiya"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface font-bold text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface-variant">
                  To'lov Muddati (sana) *
                </label>
                <input
                  type="date"
                  required
                  disabled={isSubmittingDebt}
                  value={additionalDebtDueDate}
                  onChange={(e) => setAdditionalDebtDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface font-bold text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingDebt}
                  onClick={() => setShowAddDebtModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant bg-surface-container-high hover:bg-surface-variant transition-colors disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDebt}
                  className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingDebt ? (
                    <>
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                      <span>Saqlanmoqda...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">check</span>
                      <span>Saqlash</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
