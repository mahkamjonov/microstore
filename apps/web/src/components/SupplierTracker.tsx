import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { Supplier } from '../types';

export const SupplierTracker: React.FC = () => {
  const { suppliers, updateSupplierBalance, addSupplier } = useStore();
  const { queueItem } = useOfflineSync();

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [modalType, setModalType] = useState<'INCREASE' | 'DECREASE' | 'ADD_NEW' | null>(null);
  const [amountInput, setAmountInput] = useState<string>('');
  const [newSupplierName, setNewSupplierName] = useState<string>('');

  const openModal = (supplier: Supplier | null, type: 'INCREASE' | 'DECREASE' | 'ADD_NEW') => {
    setSelectedSupplier(supplier);
    setModalType(type);
    setAmountInput('');
    setNewSupplierName('');
  };

  const closeModal = () => {
    setSelectedSupplier(null);
    setModalType(null);
  };

  const handleTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (modalType === 'ADD_NEW') {
      if (!newSupplierName.trim()) return;
      const initialBal = parseFloat(amountInput.replace(/\s/g, '')) || 0;
      const newSup: Supplier = {
        id: `sup-${Date.now()}`,
        name: newSupplierName.trim(),
        currentBalance: initialBal,
        createdAt: new Date().toISOString(),
      };
      addSupplier(newSup);
      closeModal();
      return;
    }

    if (!selectedSupplier) return;

    const val = parseFloat(amountInput.replace(/\s/g, '')) || 0;
    if (val <= 0) return;

    const delta = modalType === 'INCREASE' ? val : -val;

    updateSupplierBalance(selectedSupplier.id, delta);

    queueItem('SUPPLIER_TX', {
      supplierId: selectedSupplier.id,
      type: modalType === 'INCREASE' ? 'INCREASE_DEBT' : 'DECREASE_DEBT',
      amount: val,
    });

    closeModal();
  };

  const formatInput = (val: string) => {
    const clean = val.replace(/\D/g, '');
    return clean ? parseInt(clean, 10).toLocaleString('ru-RU') : '';
  };

  const totalDebt = suppliers.reduce((acc, s) => acc + s.currentBalance, 0);

  return (
    <section className="flex flex-col gap-4 pt-2 border-t border-outline-variant/60">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-headline text-xl font-bold text-on-background">
            Ta'minotchilar va Qarzlar
          </h2>
          <p className="text-xs text-on-surface-variant font-medium">
            Jami qarz: <strong className="text-error font-currency font-bold">{totalDebt.toLocaleString('ru-RU')} UZS</strong>
          </p>
        </div>

        <button
          onClick={() => openModal(null, 'ADD_NEW')}
          className="flex items-center gap-1 text-primary hover:text-primary-container font-body text-sm font-semibold px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Yangi Ta'minotchi
        </button>
      </div>

      {/* Supplier List */}
      <div className="flex flex-col gap-3">
        {suppliers.map((supplier) => (
          <div
            key={supplier.id}
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex justify-between items-center shadow-sm hover:shadow transition-shadow"
          >
            <div>
              <h3 className="font-headline font-bold text-base text-on-surface">
                {supplier.name}
              </h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                Qarzdorlik balansi:{' '}
                <span
                  className={`font-currency font-bold ${
                    supplier.currentBalance > 0 ? 'text-error' : 'text-primary'
                  }`}
                >
                  {supplier.currentBalance.toLocaleString('ru-RU')} UZS
                </span>
              </p>
            </div>

            {/* Action Buttons (+ / -) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => openModal(supplier, 'INCREASE')}
                className="w-10 h-10 rounded-lg bg-error-container/60 hover:bg-error-container text-error flex items-center justify-center font-bold text-xl border border-error/30 transition-transform active:scale-95 shadow-sm"
                title="Tovar olindi (Qarz oshirish)"
              >
                +
              </button>
              <button
                onClick={() => openModal(supplier, 'DECREASE')}
                className="w-10 h-10 rounded-lg bg-primary-container/20 hover:bg-primary-container/40 text-primary flex items-center justify-center font-bold text-xl border border-primary/30 transition-transform active:scale-95 shadow-sm"
                title="Pul berildi (Qarz uzish)"
              >
                -
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Dialog */}
      {modalType && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-surface-container-lowest rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-outline-variant flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-surface-variant pb-3">
              <h3 className="font-headline font-bold text-lg text-on-surface">
                {modalType === 'ADD_NEW'
                  ? "Yangi Ta'minotchi Qo'shish"
                  : modalType === 'INCREASE'
                  ? `(+) Qarz Oshirish — ${selectedSupplier?.name}`
                  : `(-) Qarz Uzish — ${selectedSupplier?.name}`}
              </h3>
              <button
                onClick={closeModal}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleTransactionSubmit} className="flex flex-col gap-4">
              {modalType === 'ADD_NEW' && (
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                    Ta'minotchi Nomi
                  </label>
                  <input
                    type="text"
                    placeholder="Masalan: TAAM, ZIYNA..."
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    required
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-sm font-semibold text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  {modalType === 'ADD_NEW'
                    ? 'Boshlang\'ich Qarz Summasi (UZS)'
                    : modalType === 'INCREASE'
                    ? 'Yangi Tovar Summasi (Qarz oshadi)'
                    : 'Berilgan Pul Summasi (Qarz kamayadi)'}
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={amountInput}
                  onChange={(e) => setAmountInput(formatInput(e.target.value))}
                  required={modalType !== 'ADD_NEW'}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-lg font-bold text-on-surface focus:outline-none focus:border-primary font-currency"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-semibold text-sm hover:bg-surface-container"
                >
                  Bekor Qilish
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm text-white shadow transition-transform active:scale-95 ${
                    modalType === 'INCREASE'
                      ? 'bg-error hover:bg-red-700'
                      : 'bg-primary hover:bg-primary-container'
                  }`}
                >
                  Tasdiqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
