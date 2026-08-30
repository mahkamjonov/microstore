import React, { useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';

export const DateSelector: React.FC = () => {
  const { selectedDate, setSelectedDate } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLButtonElement | HTMLDivElement | null>(null);

  const today = new Date();

  // Uzbek short day names
  const uzbekDays = ['YAK', 'DUSH', 'SESH', 'CHOR', 'PAY', 'JUM', 'SHAN'];
  const uzbekMonths = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
  ];

  const currentMonthName = uzbekMonths[today.getMonth()];
  const currentYear = today.getFullYear();

  // Date Range: Last 5 days + Today + Tomorrow (7 cards total)
  const dateItems = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (5 - i));

    const yearMonthDay = d.toISOString().split('T')[0];
    const dayName = uzbekDays[d.getDay()];
    const dayNum = d.getDate();

    const diffDays = i - 5; // -5..-2 is past, -1 is Kecha, 0 is Bugun, 1 is Ertaga

    let label = dayName;
    if (diffDays === 0) label = 'BUGUN';
    else if (diffDays === -1) label = 'KECHA';
    else if (diffDays === 1) label = 'ERTAGA';

    const isFuture = diffDays > 0;

    return {
      yearMonthDay,
      label,
      dayNum,
      isFuture,
      isToday: diffDays === 0,
      isYesterday: diffDays === -1,
    };
  });

  // Smooth auto-scroll selected active date card to center whenever selectedDate changes or on load
  useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedDate]);

  return (
    <section className="w-full max-w-full flex flex-col gap-2">
      {/* Month Name & Selected Date Banner */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-xl">
            calendar_month
          </span>
          <h2 className="font-headline font-bold text-sm sm:text-base text-on-surface">
            {currentMonthName} {currentYear}
          </h2>
        </div>

        <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
          Tanlangan: {selectedDate}
        </span>
      </div>

      {/* 
        Container Alignment:
        - display: flex
        - gap: 10px
        - overflow-x: auto (no-scrollbar)
        - flex-wrap: nowrap
      */}
      <div
        ref={containerRef}
        className="w-full max-w-full flex overflow-x-auto flex-nowrap gap-[10px] py-1.5 px-0.5 no-scrollbar scroll-smooth"
      >
        {dateItems.map(({ yearMonthDay, label, dayNum, isFuture, isToday, isYesterday }) => {
          const isSelected = selectedDate === yearMonthDay;

          if (isFuture) {
            // Tomorrow (Disabled preview card: width 110px, height 75px, flex-shrink: 0)
            return (
              <div
                key={yearMonthDay}
                ref={isSelected ? (el) => (activeCardRef.current = el) : null}
                title="Ertangi kunga tushum kiritish mumkin emas"
                className="flex-shrink-0 w-[110px] min-w-[110px] h-[75px] rounded-xl border border-outline-variant bg-surface-container-low flex flex-col items-center justify-center text-on-surface-variant opacity-40 cursor-not-allowed select-none shadow-xs"
              >
                <span className="text-[11px] uppercase font-bold text-error/80 tracking-wider">
                  {label}
                </span>
                <span className="text-[18px] font-bold mt-0.5">{dayNum}</span>
              </div>
            );
          }

          return (
            <button
              key={yearMonthDay}
              ref={isSelected ? (el) => (activeCardRef.current = el) : null}
              type="button"
              onClick={() => setSelectedDate(yearMonthDay)}
              className={`flex-shrink-0 w-[110px] min-w-[110px] h-[75px] rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95 shadow-xs ${
                isSelected
                  ? 'border-2 border-primary bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary/20 scale-[1.02]'
                  : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary/50'
              }`}
            >
              <span
                className={`text-[11px] uppercase font-bold tracking-wider ${
                  isToday
                    ? 'text-primary font-extrabold'
                    : isYesterday
                    ? 'text-secondary font-bold'
                    : 'text-on-surface-variant'
                }`}
              >
                {label}
              </span>
              <span className="text-[18px] font-bold mt-0.5">{dayNum}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
