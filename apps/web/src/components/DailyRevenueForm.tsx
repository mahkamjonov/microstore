import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { DailyRevenue } from '../types';

// Animated Dynamic Total Counter Component with Smooth Interpolation & Scale/Fade Pulse
const AnimatedTotalCounter: React.FC<{ value: number }> = ({ value }) => {
  const [displayVal, setDisplayVal] = useState<number>(value);
  const [isPulsing, setIsPulsing] = useState<boolean>(false);
  const animationRef = useRef<number | null>(null);
  const startValRef = useRef<number>(value);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startValRef.current = displayVal;
    startTimeRef.current = null;
    setIsPulsing(true);
    const pulseTimer = setTimeout(() => setIsPulsing(false), 200);

    const DURATION = 250; // 250ms smooth transition timing

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      // Ease Out Quad interpolation
      const easeProgress = progress * (2 - progress);

      const current = Math.round(
        startValRef.current + (value - startValRef.current) * easeProgress
      );
      setDisplayVal(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      }
    };

    animationRef.current = requestAnimationFrame(step);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      clearTimeout(pulseTimer);
    };
  }, [value]);

  return (
    <p
      className={`font-currency text-2xl sm:text-3xl font-extrabold text-[#047857] transition-all duration-200 ease-out transform ${
        isPulsing ? 'scale-105 opacity-90' : 'scale-100 opacity-100'
      }`}
    >
      {displayVal.toLocaleString('ru-RU')}{' '}
      <span className="text-xs font-bold">UZS</span>
    </p>
  );
};

export const DailyRevenueForm: React.FC = () => {
  const {
    selectedDate,
    revenues,
    setRevenue,
    isAuthenticated,
    setShowAuthModal,
    setPendingAction,
  } = useStore();
  const { queueItem } = useOfflineSync();

  const existingData = revenues[selectedDate] || {
    cashAmount: 0,
    terminalAmount: 0,
    xolisAmount: 0,
    totalAmount: 0,
  };

  const [cash, setCash] = useState<string>(
    existingData.cashAmount > 0 ? existingData.cashAmount.toLocaleString('ru-RU') : ''
  );
  const [terminal, setTerminal] = useState<string>(
    existingData.terminalAmount > 0 ? existingData.terminalAmount.toLocaleString('ru-RU') : ''
  );
  const [xolis, setXolis] = useState<string>(
    existingData.xolisAmount > 0 ? existingData.xolisAmount.toLocaleString('ru-RU') : ''
  );

  const [showToast, setShowToast] = useState<boolean>(false);

  // Sync inputs whenever selectedDate changes
  useEffect(() => {
    const data = revenues[selectedDate] || {
      cashAmount: 0,
      terminalAmount: 0,
      xolisAmount: 0,
      totalAmount: 0,
    };
    setCash(data.cashAmount > 0 ? data.cashAmount.toLocaleString('ru-RU') : '');
    setTerminal(data.terminalAmount > 0 ? data.terminalAmount.toLocaleString('ru-RU') : '');
    setXolis(data.xolisAmount > 0 ? data.xolisAmount.toLocaleString('ru-RU') : '');
  }, [selectedDate, revenues]);

  const parseVal = (str: string): number => {
    const clean = str.replace(/\D/g, '');
    return clean ? parseInt(clean, 10) : 0;
  };

  const handleInputChange = (
    val: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      setter('');
      return;
    }
    const num = parseInt(clean, 10);
    setter(num.toLocaleString('ru-RU'));
  };

  const numCash = parseVal(cash);
  const numTerminal = parseVal(terminal);
  const numXolis = parseVal(xolis);
  const autoTotal = numCash + numTerminal + numXolis;

  const isAlreadySaved = existingData.totalAmount > 0;

  const saveRevenueData = () => {
    const newRevenue: DailyRevenue = {
      date: selectedDate,
      cashAmount: numCash,
      terminalAmount: numTerminal,
      xolisAmount: numXolis,
      totalAmount: autoTotal,
      updatedAt: new Date().toISOString(),
    };

    setRevenue(selectedDate, newRevenue);

    queueItem('REVENUE_SAVE', {
      date: selectedDate,
      cashAmount: numCash,
      terminalAmount: numTerminal,
      xolisAmount: numXolis,
      totalAmount: autoTotal,
    });

    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // STRICT AUTH GUARD INTERCEPTION
    if (!isAuthenticated) {
      setPendingAction(() => saveRevenueData());
      setShowAuthModal(true); // Open Auth Modal ONLY
      return;
    }

    saveRevenueData();
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Main Card Container with Compact Padding: 16px 20px */}
        <div className="bg-surface-container-lowest border border-outline-variant p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col gap-3">
          {/* Card Header */}
          <div className="flex justify-between items-center border-b border-surface-variant pb-2.5">
            <h3 className="font-headline font-extrabold text-base text-on-surface">
              Kunlik Tushum ({selectedDate})
            </h3>

            {isAlreadySaved && (
              <span className="text-xs font-bold text-[#047857] bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                ✓ Saqlangan ({existingData.totalAmount.toLocaleString('ru-RU')} UZS)
              </span>
            )}
          </div>

          {/* Input Rows Container with Compact 10px Gap */}
          <div className="flex flex-col gap-2.5">
            {/* Row 1: Horizontal Inline Layout (Naqd | Input UZS X) */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-bold text-on-surface min-w-[70px]">
                Naqd
              </label>
              <div className="relative flex-1 flex items-center max-w-[220px] sm:max-w-[240px]">
                <input
                  type="text"
                  placeholder="0"
                  value={cash}
                  onChange={(e) => handleInputChange(e.target.value, setCash)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-base font-bold text-on-surface focus:outline-none focus:border-primary font-currency pr-14 text-right"
                />
                {cash && (
                  <button
                    type="button"
                    onClick={() => setCash('')}
                    className="absolute right-9 text-outline hover:text-on-surface text-xs font-bold p-1"
                    title="Tozalash"
                  >
                    ✕
                  </button>
                )}
                <span className="absolute right-3 text-xs font-bold text-outline select-none">
                  UZS
                </span>
              </div>
            </div>

            {/* Row 2: Horizontal Inline Layout (Terminal | Input UZS X) */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-bold text-on-surface min-w-[70px]">
                Terminal
              </label>
              <div className="relative flex-1 flex items-center max-w-[220px] sm:max-w-[240px]">
                <input
                  type="text"
                  placeholder="0"
                  value={terminal}
                  onChange={(e) => handleInputChange(e.target.value, setTerminal)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-base font-bold text-on-surface focus:outline-none focus:border-primary font-currency pr-14 text-right"
                />
                {terminal && (
                  <button
                    type="button"
                    onClick={() => setTerminal('')}
                    className="absolute right-9 text-outline hover:text-on-surface text-xs font-bold p-1"
                    title="Tozalash"
                  >
                    ✕
                  </button>
                )}
                <span className="absolute right-3 text-xs font-bold text-outline select-none">
                  UZS
                </span>
              </div>
            </div>

            {/* Row 3: Horizontal Inline Layout (Xolis | Input UZS X) */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-bold text-on-surface min-w-[70px]">
                Xolis
              </label>
              <div className="relative flex-1 flex items-center max-w-[220px] sm:max-w-[240px]">
                <input
                  type="text"
                  placeholder="0"
                  value={xolis}
                  onChange={(e) => handleInputChange(e.target.value, setXolis)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-base font-bold text-on-surface focus:outline-none focus:border-primary font-currency pr-14 text-right"
                />
                {xolis && (
                  <button
                    type="button"
                    onClick={() => setXolis('')}
                    className="absolute right-9 text-outline hover:text-on-surface text-xs font-bold p-1"
                    title="Tozalash"
                  >
                    ✕
                  </button>
                )}
                <span className="absolute right-3 text-xs font-bold text-outline select-none">
                  UZS
                </span>
              </div>
            </div>
          </div>

          {/* Enhanced JAMI TUSHUM Container with Smooth Dynamic Number Counter */}
          <div className="bg-[#ECFDF5] border border-[#A7F3D0] py-3 px-4 rounded-2xl flex justify-between items-center">
            <span className="text-[13px] font-bold tracking-wider text-[#065F46] uppercase">
              JAMI TUSHUM:
            </span>
            <AnimatedTotalCounter value={autoTotal} />
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            className="w-full py-3.5 bg-[#059669] hover:bg-emerald-700 text-white rounded-2xl font-headline font-extrabold text-sm sm:text-base shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">check_circle</span>
            Saqlash va Tasdiqlash
          </button>
        </div>
      </form>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#059669] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce font-headline font-bold text-xs">
          <span className="material-symbols-outlined text-lg">done_all</span>
          {selectedDate} sana uchun tushum muvaffaqiyatli saqlandi!
        </div>
      )}
    </div>
  );
};
