import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Expense } from '../types';

// Unified Custom Composite SVG Stacked Flat Bar Renderer (Unified Stack Identifier Math)
const CustomStackedBar: React.FC<{
  cash: number;
  terminal: number;
  xolis: number;
  total: number;
  maxVal: number;
  width?: number;
  containerHeight?: number;
}> = ({ cash, terminal, xolis, total, maxVal, width = 16, containerHeight = 140 }) => {
  if (!total || total <= 0 || !maxVal || maxVal <= 0) return null;

  // Direct 1-to-1 Y-axis scale calculation for unified stacked segments (stackId="a" math)
  const cashHeight = (cash / maxVal) * containerHeight;
  const terminalHeight = (terminal / maxVal) * containerHeight;
  const xolisHeight = (xolis / maxVal) * containerHeight;

  let currentY = containerHeight;

  // Unified Stacked Segments (Bottom to Top: Naqd -> Terminal -> Xolis)
  const activeSegments: { type: string; h: number; fill: string }[] = [];
  if (cash > 0 && cashHeight > 0) activeSegments.push({ type: 'Naqd', h: cashHeight, fill: '#10B981' });
  if (terminal > 0 && terminalHeight > 0) activeSegments.push({ type: 'Terminal', h: terminalHeight, fill: '#3B82F6' });
  if (xolis > 0 && xolisHeight > 0) activeSegments.push({ type: 'Xolis', h: xolisHeight, fill: '#64748B' });

  return (
    <svg className="w-full h-full overflow-visible" style={{ height: `${containerHeight}px` }}>
      <g>
        {activeSegments.map((seg) => {
          const segY = currentY - seg.h;
          currentY = segY;
          return (
            <rect
              key={seg.type}
              x={0}
              y={segY}
              width={width}
              height={seg.h}
              fill={seg.fill}
              stroke="none"
            />
          );
        })}
      </g>
    </svg>
  );
};

export const AdminDashboard: React.FC = () => {
  const {
    activeTab,
    revenues,
    suppliers,
    expenses,
    addExpense,
    deleteExpense,
    profitMarginPct,
    setProfitMarginPct,
    monthlyExpenseBudget,
    setMonthlyExpenseBudget,
    withAuthGuard,
  } = useStore();

  const getCurrentMonthName = () => {
    const months = [
      'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
      'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
    ];
    return months[new Date().getMonth()];
  };

  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(getCurrentMonthName());
  const [showMarginModal, setShowMarginModal] = useState<boolean>(false);
  const [tempMargin, setTempMargin] = useState<string>(profitMarginPct.toString());
  const [isChartMounted, setIsChartMounted] = useState<boolean>(false);

  // Trigger smooth staggered bar entrance height animation on view or filter change
  React.useEffect(() => {
    setIsChartMounted(false);
    const timer = setTimeout(() => setIsChartMounted(true), 60);
    return () => clearTimeout(timer);
  }, [activeTab, selectedMonthFilter]);

  // Budget Limit Modal State
  const [showBudgetModal, setShowBudgetModal] = useState<boolean>(false);
  const [tempBudget, setTempBudget] = useState<string>(monthlyExpenseBudget > 0 ? monthlyExpenseBudget.toString() : '');

  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Expense Form State
  const [expCategory, setExpCategory] = useState<'Arenda' | 'Kommunal' | 'Ish haqi' | 'Transport' | 'Boshqa'>('Ish haqi');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expPaymentType, setExpPaymentType] = useState<'Naqd' | 'Karta'>('Karta');
  const [expNote, setExpNote] = useState<string>('');
  const [showExpSuccess, setShowExpSuccess] = useState<boolean>(false);

  // Real-Time Date Calculations
  const today = new Date();
  const currentYear = today.getFullYear();
  const todayStr = today.toISOString().split('T')[0];

  const monthsList = [
    'Yillik', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
  ];

  const monthShortNames = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

  const monthIndexMap: Record<string, number> = {
    'Yanvar': 0, 'Fevral': 1, 'Mart': 2, 'Aprel': 3, 'May': 4, 'Iyun': 5,
    'Iyul': 6, 'Avgust': 7, 'Sentabr': 8, 'Oktabr': 9, 'Noyabr': 10, 'Dekabr': 11
  };

  // Dynamic KPI Metric Calculations
  const bugungiTushum = revenues[todayStr]?.totalAmount || 0;

  // Selected Month Revenue calculation
  const targetMonthIdx = monthIndexMap[selectedMonthFilter] ?? today.getMonth();
  const targetMonthDays = new Date(currentYear, targetMonthIdx + 1, 0).getDate();

  let oylikTushum = 0;
  for (let d = 1; d <= targetMonthDays; d++) {
    const ds = `${currentYear}-${String(targetMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (revenues[ds]) {
      oylikTushum += revenues[ds].totalAmount;
    }
  }

  // Yillik Tushum (Sum of all stored dates in current year)
  const yillikTushum = Object.entries(revenues).reduce((acc: number, [dateKey, r]: [string, any]) => {
    if (dateKey.startsWith(`${currentYear}-`)) {
      return acc + (r?.totalAmount || 0);
    }
    return acc;
  }, 0);

  // Chart Dataset Logic
  let chartItems: {
    label: string;
    cash: number;
    terminal: number;
    xolis: number;
    total: number;
  }[] = [];

  if (selectedMonthFilter === 'Yillik') {
    chartItems = monthShortNames.map((mName, mIdx) => {
      let mCash = 0;
      let mTerm = 0;
      let mXolis = 0;

      Object.entries(revenues).forEach(([dateKey, r]) => {
        if (dateKey.startsWith(`${currentYear}-${String(mIdx + 1).padStart(2, '0')}`)) {
          mCash += r.cashAmount;
          mTerm += r.terminalAmount;
          mXolis += r.xolisAmount;
        }
      });

      return {
        label: mName,
        cash: mCash,
        terminal: mTerm,
        xolis: mXolis,
        total: mCash + mTerm + mXolis,
      };
    });
  } else {
    chartItems = Array.from({ length: targetMonthDays }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${currentYear}-${String(targetMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const rev = revenues[dateStr];
      return {
        label: `${dayNum}`,
        cash: rev ? rev.cashAmount : 0,
        terminal: rev ? rev.terminalAmount : 0,
        xolis: rev ? rev.xolisAmount : 0,
        total: rev ? rev.totalAmount : 0,
      };
    });
  }

  // Dynamic Y-Axis Max Scale matched to real data max + 8% headroom padding (bars fill ~85-90% height)
  const maxVal = Math.max(...chartItems.map((item) => item.total), 100000);
  const domainMax = Math.ceil(maxVal * 1.08);

  // Net Profit Calculations
  const activePeriodRevenue = selectedMonthFilter === 'Yillik' ? yillikTushum : oylikTushum;
  const grossProfit = Math.round(activePeriodRevenue * (profitMarginPct / 100));
  const totalExpenses = expenses.reduce((acc: number, e: any) => acc + (e.amount || 0), 0);
  const netProfit = grossProfit - totalExpenses;
  const productCost = activePeriodRevenue - grossProfit;

  // Breakdown percentages bounded strictly to 100%
  const tannarxPct = 100 - profitMarginPct;
  const xarajatPctOfRev = activePeriodRevenue > 0 ? Math.min(profitMarginPct, Math.round((totalExpenses / activePeriodRevenue) * 100)) : 0;
  const sofFoydaPctOfRev = Math.max(0, profitMarginPct - xarajatPctOfRev);

  // Dynamic Budget Limit Calculation & Color Status Logic
  const hasBudgetLimit = monthlyExpenseBudget > 0;
  const remainingBudget = hasBudgetLimit ? monthlyExpenseBudget - totalExpenses : -totalExpenses;
  const budgetUsedPct = hasBudgetLimit ? Math.min(100, Math.round((totalExpenses / monthlyExpenseBudget) * 100)) : 0;

  let budgetStatusText = "Limit belgilanmagan";
  let budgetColorClass = "bg-gray-400";
  let budgetBadgeTextClass = "text-on-surface-variant";

  if (hasBudgetLimit) {
    if (budgetUsedPct < 75) {
      budgetStatusText = "Status: Yaxshi";
      budgetColorClass = "bg-[#059669]";
      budgetBadgeTextClass = "text-[#059669]";
    } else if (budgetUsedPct < 100) {
      budgetStatusText = "Status: Ogohlantirish";
      budgetColorClass = "bg-[#D97706]";
      budgetBadgeTextClass = "text-[#D97706]";
    } else {
      budgetStatusText = "Status: Limitdan oshdi";
      budgetColorClass = "bg-[#DC2626]";
      budgetBadgeTextClass = "text-[#DC2626]";
    }
  }

  // 12-Month Net Profit Data for Sof Foyda view
  const monthlyProfitItems = monthShortNames.map((mName, mIdx) => {
    let mRev = 0;
    Object.entries(revenues).forEach(([dateKey, r]: [string, any]) => {
      if (dateKey.startsWith(`${currentYear}-${String(mIdx + 1).padStart(2, '0')}`)) {
        mRev += (r?.totalAmount || 0);
      }
    });

    const mGross = Math.round(mRev * (profitMarginPct / 100));
    const mExp = expenses.reduce((acc: number, e: any) => {
      if (e.date.startsWith(`${currentYear}-${String(mIdx + 1).padStart(2, '0')}`)) {
        return acc + (e.amount || 0);
      }
      return acc;
    }, 0);

    const mNet = mGross - mExp;
    return { label: mName, rev: mRev, gross: mGross, exp: mExp, net: mNet };
  });

  const maxProfitVal = Math.max(...monthlyProfitItems.map((m) => Math.abs(m.net)), 1000000);

  // Debt Calculations
  const totalSupplierDebt = suppliers.reduce((acc: number, s: any) => acc + (s.currentBalance || 0), 0);

  // Expense Category breakdown
  const categoryTotals = expenses.reduce((acc: Record<string, number>, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  let topCategoryName = 'Ish haqi';
  let topCategoryAmount = 0;
  Object.entries(categoryTotals).forEach(([cat, amt]) => {
    if (amt > topCategoryAmount) {
      topCategoryAmount = amt;
      topCategoryName = cat;
    }
  });

  // Action Submissions Intercepted with Global Auth Guard
  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    withAuthGuard(() => {
      const val = parseFloat(expAmount.replace(/\s/g, '')) || 0;
      if (val <= 0) return;

      const newExp: Expense = {
        id: `exp-${Date.now()}`,
        category: expCategory,
        amount: val,
        paymentType: expPaymentType,
        note: expNote.trim(),
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };

      addExpense(newExp);
      setExpAmount('');
      setExpNote('');
      setShowExpSuccess(true);
      setTimeout(() => setShowExpSuccess(false), 3000);
    });
  };

  const handleMarginSave = (e: React.FormEvent) => {
    e.preventDefault();
    withAuthGuard(() => {
      const val = parseFloat(tempMargin) || 20;
      setProfitMarginPct(val);
      setShowMarginModal(false);
    });
  };

  const handleBudgetSave = (e: React.FormEvent) => {
    e.preventDefault();
    withAuthGuard(() => {
      const val = parseFloat(tempBudget.replace(/\s/g, '')) || 0;
      setMonthlyExpenseBudget(val);
      setShowBudgetModal(false);
    });
  };

  const handleDeleteExpense = (id: string) => {
    withAuthGuard(() => {
      deleteExpense(id);
    });
  };

  const formatInput = (val: string) => {
    const clean = val.replace(/\D/g, '');
    return clean ? parseInt(clean, 10).toLocaleString('ru-RU') : '';
  };

  const formatCompact = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${Math.round(val / 1000)}k`;
    return `${val}`;
  };

  const categoryColors: Record<string, string> = {
    'Ish haqi': '#0058be',
    'Arenda': '#006948',
    'Kommunal': '#ba1a1a',
    'Transport': '#d97706',
    'Boshqa': '#6b7280',
  };

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto py-2 pb-12">
      {/* ==================== VIEW 1: TUSHUM (Revenue Analytics) ==================== */}
      {activeTab === 'tushum' && (
        <div className="flex flex-col gap-5">
          {/* Top KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant shadow-sm flex flex-col justify-between gap-1.5">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Bugungi Tushum
              </span>
              <p className="font-currency text-xl font-black text-[#10B981]">
                {bugungiTushum.toLocaleString('ru-RU')}{' '}
                <span className="text-xs font-semibold">UZS</span>
              </p>
              <p className="text-[11px] text-[#10B981] font-bold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                {bugungiTushum > 0 ? '✓ Tushum kiritilgan' : 'Hali kiritilmadi'}
              </p>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant shadow-sm flex flex-col justify-between gap-1.5">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Oylik Tushum ({selectedMonthFilter})
              </span>
              <p className="font-currency text-xl font-black text-[#3B82F6]">
                {oylikTushum.toLocaleString('ru-RU')}{' '}
                <span className="text-xs font-semibold">UZS</span>
              </p>
              <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                Dinamik oylik jamlama
              </p>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant shadow-sm flex flex-col justify-between gap-1.5">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Yillik Tushum ({currentYear})
              </span>
              <p className="font-currency text-xl font-black text-on-surface">
                {yillikTushum.toLocaleString('ru-RU')}{' '}
                <span className="text-xs font-semibold">UZS</span>
              </p>
              <p className="text-[11px] text-on-surface-variant font-medium">
                Barcha oylar jamlamasi
              </p>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-[#10B981]/30 bg-[#10B981]/5 shadow-sm flex flex-col justify-between gap-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-[#10B981] uppercase tracking-wider">
                  MARJA %
                </span>
                <button
                  onClick={() => setShowMarginModal(true)}
                  className="text-xs font-bold text-[#10B981] underline hover:text-emerald-700"
                >
                  O'zgartirish
                </button>
              </div>
              <p className="font-currency text-2xl font-black text-[#10B981]">
                {profitMarginPct}%
              </p>
              <p className="text-[11px] text-on-surface-variant font-medium">
                Yalpi daromad marjasi
              </p>
            </div>
          </div>

          {/* Main Revenue Bar Chart Section */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[#10B981]">bar_chart</span>
                {selectedMonthFilter === 'Yillik'
                  ? `Yillik Tushum Dinamikasi (${currentYear})`
                  : `Kunlar Bo'yicha Tushum Dinamikasi (${selectedMonthFilter} ${currentYear})`}
              </h3>

              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1 text-[#10B981]">
                  <span className="w-3 h-3 rounded-xs bg-[#10B981]"></span> Naqd
                </span>
                <span className="flex items-center gap-1 text-[#3B82F6]">
                  <span className="w-3 h-3 rounded-xs bg-[#3B82F6]"></span> Terminal
                </span>
                <span className="flex items-center gap-1 text-[#64748B]">
                  <span className="w-3 h-3 rounded-xs bg-[#64748B]"></span> Xolis
                </span>
              </div>
            </div>

            <div key={`${selectedMonthFilter}-${activeTab}`} className="flex gap-2 items-stretch h-64 pt-8 pb-2 px-1 bg-surface-container-low rounded-xl border border-surface-variant relative overflow-visible">
              {/* Dynamic Y-Axis Scale Ticks (0 to domainMax = maxVal * 1.15) */}
              <div className="flex flex-col justify-between py-2 text-[10px] font-bold text-outline text-right w-12 border-r border-outline-variant/40 pr-2 flex-shrink-0 select-none">
                <span>{formatCompact(domainMax)}</span>
                <span>{formatCompact(Math.round(domainMax * 0.66))}</span>
                <span>{formatCompact(Math.round(domainMax * 0.33))}</span>
                <span>0</span>
              </div>

              <div className="flex-1 flex items-end gap-1 sm:gap-1.5 justify-around relative pl-1 pr-1 overflow-visible">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-2 border-l border-outline-variant/30">
                  <div className="w-full border-b border-dashed border-outline-variant/30"></div>
                  <div className="w-full border-b border-dashed border-outline-variant/30"></div>
                  <div className="w-full border-b border-dashed border-outline-variant/30"></div>
                  <div className="w-full border-b border-outline-variant/40"></div>
                </div>
                {chartItems.map((item, idx) => {
                  const targetCashPct = domainMax > 0 ? (item.cash / domainMax) * 100 : 0;
                  const targetTermPct = domainMax > 0 ? (item.terminal / domainMax) * 100 : 0;
                  const targetXolisPct = domainMax > 0 ? (item.xolis / domainMax) * 100 : 0;

                  const cashPct = isChartMounted ? targetCashPct : 0;
                  const termPct = isChartMounted ? targetTermPct : 0;
                  const xolisPct = isChartMounted ? targetXolisPct : 0;

                  const isHovered = hoveredBarIndex === idx;

                  // Calculate actual dynamic bar height in px to align tooltip height directly to bar top
                  const colBarHeight = domainMax > 0 ? Math.min(Math.round((item.total / domainMax) * 140), 140) : 0;

                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredBarIndex(idx)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                      className="flex flex-col items-center gap-1 flex-1 min-w-[16px] sm:min-w-[20px] relative cursor-pointer h-full justify-end"
                    >
                      {/* Ultra-Compact Tooltip Floating ~35-40px Above Hovered Bar Top (Suppressed on 0 UZS Sales) */}
                      {isHovered && item.total > 0 && (
                        <div
                          style={{
                            bottom: `${Math.max(colBarHeight + 36, 65)}px`,
                            height: 'auto',
                            minHeight: 'unset',
                          }}
                          className="absolute left-1/2 -translate-x-1/2 z-[99999] bg-[#1E222D] text-white p-1.5 px-2 rounded-lg shadow-xl w-36 max-w-[150px] text-[10px] leading-tight font-medium border border-gray-700/50 whitespace-nowrap pointer-events-none animate-fadeIn flex flex-col gap-1 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[#1E222D]"
                        >
                          <div className="text-[11px] font-bold text-slate-300 border-b border-gray-700/60 pb-0.5 mb-0.5 flex justify-between items-center">
                            <span>{selectedMonthFilter === 'Yillik' ? `${item.label} oy` : `${item.label}-${selectedMonthFilter}`}</span>
                          </div>
                          {item.cash > 0 && (
                            <div className="flex justify-between items-center text-[#10B981] font-semibold text-[10px] gap-2">
                              <span>Naqd:</span>
                              <span className="font-currency font-semibold text-[10px]">{item.cash.toLocaleString('ru-RU')} UZS</span>
                            </div>
                          )}
                          {item.terminal > 0 && (
                            <div className="flex justify-between items-center text-[#3B82F6] font-semibold text-[10px] gap-2">
                              <span>Terminal:</span>
                              <span className="font-currency font-semibold text-[10px]">{item.terminal.toLocaleString('ru-RU')} UZS</span>
                            </div>
                          )}
                          {item.xolis > 0 && (
                            <div className="flex justify-between items-center text-[#94A3B8] font-semibold text-[10px] gap-2">
                              <span>Xolis:</span>
                              <span className="font-currency font-semibold text-[10px]">{item.xolis.toLocaleString('ru-RU')} UZS</span>
                            </div>
                          )}
                          <div className="border-t border-gray-700/60 my-0.5"></div>
                          <div className="flex justify-between items-center text-[#10B981] font-bold text-[10px] gap-2">
                            <span>Jami:</span>
                            <span className="font-currency font-bold text-[10px]">{item.total.toLocaleString('ru-RU')} UZS</span>
                          </div>
                        </div>
                      )}

                      {/* Single Unified Standard Flat Composite SVG Stacked Bar */}
                      <div
                        className="w-full max-w-[16px] sm:max-w-[20px] flex flex-col justify-end chart-bar-animate border-none outline-none"
                        style={{
                          height: '140px',
                        }}
                      >
                        <CustomStackedBar
                          cash={isChartMounted ? item.cash : 0}
                          terminal={isChartMounted ? item.terminal : 0}
                          xolis={isChartMounted ? item.xolis : 0}
                          total={isChartMounted ? item.total : 0}
                          maxVal={domainMax}
                          width={16}
                          containerHeight={140}
                        />
                      </div>

                      <span className="text-[10px] font-bold text-on-surface-variant">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-surface-container-lowest p-2 rounded-2xl border border-outline-variant">
            {monthsList.map((month) => (
              <button
                key={month}
                onClick={() => setSelectedMonthFilter(month)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedMonthFilter === month
                    ? 'bg-[#10B981] text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ==================== VIEW 2: XARAJAT (Expenses View) ==================== */}
      {activeTab === 'expenses' && (
        <div className="flex flex-col gap-5">
          {/* Top KPI Cards (3 Cards Grid) with Dynamic Budget Logic */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Card 1: Jami Oylik Xarajatlar */}
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant shadow-sm flex flex-col justify-between gap-1.5">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Jami Oylik Xarajatlar
              </span>
              <p className="font-currency text-xl font-extrabold text-amber-900">
                {totalExpenses.toLocaleString('ru-RU')}{' '}
                <span className="text-xs font-semibold">UZS</span>
              </p>
              <p className="text-[11px] text-emerald-600 font-bold">
                Dynamic xarajatlar yig'indisi
              </p>
            </div>

            {/* Card 2: Eng yuqori xarajat kategoriyasi */}
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant shadow-sm flex flex-col justify-between gap-1.5">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Eng Yuqori Kategoriya
              </span>
              <p className="font-headline text-lg font-extrabold text-on-surface">
                {topCategoryName}
              </p>
              <p className="text-[11px] text-secondary font-bold">
                {topCategoryAmount.toLocaleString('ru-RU')} UZS (
                {totalExpenses > 0
                  ? Math.round((topCategoryAmount / totalExpenses) * 100)
                  : 0}
                %)
              </p>
            </div>

            {/* Card 3: QOLGAN BUDJET (Dynamic Budget Limit Card with Edit Option) */}
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant shadow-sm flex flex-col justify-between gap-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                  Qolgan Budjet
                </span>
                <button
                  onClick={() => setShowBudgetModal(true)}
                  className="text-[11px] font-bold text-primary underline hover:text-primary-container"
                  title="Oylik Xarajat Limitini Sozlash"
                >
                  O'zgartirish
                </button>
              </div>

              {hasBudgetLimit ? (
                <p className={`font-currency text-xl font-extrabold ${remainingBudget >= 0 ? 'text-primary' : 'text-error'}`}>
                  {remainingBudget.toLocaleString('ru-RU')}{' '}
                  <span className="text-xs font-semibold">UZS</span>
                </p>
              ) : (
                <p className="font-currency text-base font-bold text-on-surface-variant">
                  Limit belgilanmagan
                </p>
              )}

              {/* Progress Bar under Qolgan Budjet */}
              <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${budgetColorClass}`}
                  style={{ width: hasBudgetLimit ? `${budgetUsedPct}%` : '0%' }}
                ></div>
              </div>

              <p className={`text-[11px] font-bold ${budgetBadgeTextClass}`}>
                {hasBudgetLimit
                  ? `Ishlatilishi: ${budgetUsedPct}% | ${budgetStatusText}`
                  : `Jami ishlatilgan: ${totalExpenses.toLocaleString('ru-RU')} UZS`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
            <div className="lg:col-span-8 flex flex-col gap-5 w-full">
              <div className="bg-surface-container-lowest p-4 md:p-6 rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-3 w-full">
                <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2 border-b border-surface-variant pb-3">
                  <span className="material-symbols-outlined text-primary">format_list_bulleted</span>
                  Xarajatlar Jadvali
                </h3>

                <div className="w-full overflow-hidden rounded-xl border border-outline-variant">
                  <table className="w-full text-left text-xs border-collapse table-auto">
                    <thead>
                      <tr className="bg-surface-container-low text-on-surface-variant font-bold border-b border-outline-variant">
                        <th className="py-2.5 px-3 w-[12%]">Sana</th>
                        <th className="py-2.5 px-3 w-[18%] font-bold">Kategoriya</th>
                        <th className="py-2.5 px-3 w-[45%] font-bold">Izoh</th>
                        <th className="py-2.5 px-3 text-right w-[25%] font-bold">Summa (UZS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-variant bg-surface-container-lowest">
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-6 text-on-surface-variant font-medium">
                            Xarajatlar yo'q
                          </td>
                        </tr>
                      ) : (
                        expenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-primary/5 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-on-surface whitespace-nowrap w-[12%]">{exp.date.slice(5)}</td>
                            <td className="py-2.5 px-3 w-[18%]">
                              <span
                                className="px-2 py-0.5 rounded-full font-bold text-[10px] text-white whitespace-nowrap inline-block"
                                style={{ backgroundColor: categoryColors[exp.category] || '#006948' }}
                              >
                                {exp.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-on-surface text-xs leading-normal w-[45%]">
                              {exp.note || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-currency font-extrabold text-amber-900 text-xs sm:text-sm whitespace-nowrap w-[25%] flex items-center justify-end gap-1.5">
                              <span>-{exp.amount.toLocaleString('ru-RU')} UZS</span>
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="text-outline hover:text-error transition-colors p-0.5"
                                title="Xarajatni o'chirish"
                              >
                                <span className="material-symbols-outlined text-[15px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-4">
                <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2 border-b border-surface-variant pb-3">
                  <span className="material-symbols-outlined text-primary">pie_chart</span>
                  Kategoriyalar bo'yicha Taqsimot (Analitika)
                </h3>

                <div className="w-full h-3.5 bg-surface-container-high rounded-full overflow-hidden flex">
                  {Object.entries(categoryTotals).map(([cat, amt]) => {
                    const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
                    return (
                      <div
                        key={cat}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: categoryColors[cat] || '#006948',
                        }}
                        className="h-full border-r border-surface-container-lowest transition-all"
                        title={`${cat}: ${pct}%`}
                      ></div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  {Object.entries(categoryTotals).map(([cat, amt]) => {
                    const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
                    return (
                      <div
                        key={cat}
                        className="flex items-center gap-2 px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant text-xs font-semibold shadow-xs"
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: categoryColors[cat] || '#006948' }}
                        ></span>
                        <span className="font-bold text-on-surface">{cat}:</span>
                        <span className="font-currency font-extrabold text-on-surface-variant">
                          {amt.toLocaleString('ru-RU')} UZS ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 bg-surface-container-lowest p-4 md:p-6 rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-4 sticky top-20 w-full">
              <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2 border-b border-surface-variant pb-3">
                <span className="material-symbols-outlined text-primary">add_card</span>
                Yangi Xarajat Qo'shish
              </h3>

              <form onSubmit={handleExpenseSubmit} className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                    1. Kategoriya Tanlang
                  </label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as any)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2.5 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="Ish haqi">Ish haqi</option>
                    <option value="Kommunal">Kommunal</option>
                    <option value="Arenda">Ijara</option>
                    <option value="Transport">Transport</option>
                    <option value="Boshqa">Boshqa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                    2. Summa (UZS)
                  </label>
                  <input
                    type="text"
                    placeholder="0"
                    value={expAmount}
                    onChange={(e) => setExpAmount(formatInput(e.target.value))}
                    required
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3.5 py-2.5 text-base font-bold text-on-surface focus:outline-none focus:border-primary font-currency"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                    3. Izoh (Tavsif)
                  </label>
                  <input
                    type="text"
                    placeholder="Masalan: Elektr uchun oylik to'lov"
                    value={expNote}
                    onChange={(e) => setExpNote(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                    4. To'lov Turi
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExpPaymentType('Naqd')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
                        expPaymentType === 'Naqd'
                          ? 'bg-[#10B981] text-white border-[#10B981] shadow-xs'
                          : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
                      }`}
                    >
                      Naqd
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpPaymentType('Karta')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
                        expPaymentType === 'Karta'
                          ? 'bg-secondary text-white border-secondary shadow-xs'
                          : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
                      }`}
                    >
                      Karta
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#10B981] hover:bg-emerald-700 text-white rounded-xl font-headline font-bold text-xs shadow transition-all active:scale-[0.98] mt-1 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Xarajat Qo'shish
                </button>
              </form>

              {showExpSuccess && (
                <p className="text-xs font-bold text-emerald-600 text-center animate-bounce pt-1">
                  Xarajat muvaffaqiyatli saqlandi!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== VIEW 3: SOF FOYDA (Net Profit Page) ==================== */}
      {activeTab === 'profit' && (
        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-outline-variant shadow-sm flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="font-headline font-extrabold text-xl text-on-surface flex items-center gap-2">
                Sof Foyda Hisob-Kitobi va Moliyaviy Analitika
              </h2>
              <p className="text-xs text-on-surface-variant font-semibold mt-0.5">
                Formula: Sof Foyda = (Jami Tushum × Marja %) - Jami Xarajatlar
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                Savdo Marjasi: {profitMarginPct}%
              </span>
              <button
                onClick={() => setShowMarginModal(true)}
                className="text-xs font-bold text-primary underline hover:text-primary-container"
              >
                O'zgartirish
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant shadow-sm flex flex-col justify-between gap-1.5">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                1. Jami Tushum ({selectedMonthFilter})
              </span>
              <p className="font-currency text-xl font-black text-on-surface">
                {activePeriodRevenue.toLocaleString('ru-RU')}{' '}
                <span className="text-xs font-semibold">UZS</span>
              </p>
              <p className="text-[11px] text-on-surface-variant font-medium">
                Umumiy savdo hajmi
              </p>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-primary/30 bg-primary/5 shadow-sm flex flex-col justify-between gap-1.5">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                2. Yalpi Daromad ({profitMarginPct}%)
              </span>
              <p className="font-currency text-xl font-black text-primary">
                {grossProfit.toLocaleString('ru-RU')}{' '}
                <span className="text-xs font-semibold">UZS</span>
              </p>
              <p className="text-[11px] text-primary font-bold">
                Tushum × {profitMarginPct}% Marja
              </p>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-amber-300 bg-amber-50 shadow-sm flex flex-col justify-between gap-1.5">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                3. Jami Xarajatlar
              </span>
              <p className="font-currency text-xl font-black text-amber-900">
                -{totalExpenses.toLocaleString('ru-RU')}{' '}
                <span className="text-xs font-semibold">UZS</span>
              </p>
              <p className="text-[11px] text-amber-800 font-bold">
                Operatsion xarajatlar
              </p>
            </div>

            <div
              className={`p-4 rounded-2xl border-2 shadow-md flex flex-col justify-between gap-1.5 ${
                netProfit >= 0
                  ? 'border-emerald-600 bg-emerald-500/10 text-emerald-900'
                  : 'border-red-500 bg-red-50 text-red-900'
              }`}
            >
              <span className="text-[11px] font-black uppercase tracking-wider">
                4. SOF FOYDA
              </span>
              <p className="font-currency text-2xl font-black">
                {netProfit.toLocaleString('ru-RU')}{' '}
                <span className="text-xs font-bold">UZS</span>
              </p>
              <p className="text-[11px] font-bold flex items-center gap-1">
                {netProfit >= 0 ? (
                  <>
                    <span className="material-symbols-outlined text-sm text-emerald-700">trending_up</span>
                    <span className="text-emerald-800">✓ Foyda ko'rilmoqda</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm text-red-600">warning</span>
                    <span className="text-red-700">⚠️ Zarar ko'rilmoqda</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-4">
            <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700">pie_chart</span>
              Moliyaviy Taqsimot va Rentabellik (100% Jamlama)
            </h3>

            <div className="w-full bg-surface-container-high h-4 rounded-full overflow-hidden flex">
              <div
                className="bg-gray-400 h-full transition-all"
                style={{ width: `${tannarxPct}%` }}
                title={`Mahsulot Tannarxi: ${tannarxPct}%`}
              ></div>

              <div
                className="bg-amber-600 h-full transition-all"
                style={{ width: `${xarajatPctOfRev}%` }}
                title={`Xarajatlar: ${xarajatPctOfRev}%`}
              ></div>

              {sofFoydaPctOfRev > 0 && (
                <div
                  className="bg-emerald-600 h-full transition-all"
                  style={{ width: `${sofFoydaPctOfRev}%` }}
                  title={`Sof Foyda: ${sofFoydaPctOfRev}%`}
                ></div>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-xs font-bold pt-1">
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                Mahsulot Tannarxi: {tannarxPct}% ({productCost.toLocaleString('ru-RU')} UZS)
              </span>

              <span className="flex items-center gap-1.5 text-amber-900">
                <span className="w-3 h-3 rounded-full bg-amber-600"></span>
                Xarajatlar: {xarajatPctOfRev}% ({totalExpenses.toLocaleString('ru-RU')} UZS)
              </span>

              <span className="flex items-center gap-1.5 text-emerald-800">
                <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                Sof Foyda: {sofFoydaPctOfRev}% ({Math.max(0, netProfit).toLocaleString('ru-RU')} UZS)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-4">
              <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2 border-b border-surface-variant pb-3">
                <span className="material-symbols-outlined text-primary">bar_chart</span>
                Oylar Bo'yicha Sof Foyda Dinamikasi (2026)
              </h3>

              <div className="flex gap-2 items-stretch h-56 pt-6 pb-2 px-1 bg-surface-container-low rounded-xl border border-surface-variant relative overflow-hidden">
                <div className="flex flex-col justify-between py-2 text-[10px] font-bold text-outline text-right w-12 border-r border-outline-variant/40 pr-2 flex-shrink-0 select-none">
                  <span>{formatCompact(maxProfitVal)}</span>
                  <span>{formatCompact(Math.round(maxProfitVal * 0.5))}</span>
                  <span>0</span>
                </div>

                <div className="flex-1 flex items-end gap-1 sm:gap-2 justify-around relative pl-1 pr-1">
                  {monthlyProfitItems.map((mItem, mIdx) => {
                    const isProfit = mItem.net >= 0;
                    const barPct = Math.min(100, Math.round((Math.abs(mItem.net) / maxProfitVal) * 100));

                    return (
                      <div
                        key={mIdx}
                        className="flex flex-col items-center gap-1 flex-1 min-w-[16px] relative group cursor-pointer"
                        title={`${mItem.label}: Sof Foyda ${mItem.net.toLocaleString('ru-RU')} UZS (Tushum: ${mItem.rev.toLocaleString('ru-RU')})`}
                      >
                        <div
                          className="w-full max-w-[20px] rounded-t-sm transition-all flex flex-col justify-end"
                          style={{ height: '130px' }}
                        >
                          <div
                            className={`w-full rounded-t-sm transition-all ${
                              isProfit ? 'bg-[#10B981] hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
                            }`}
                            style={{ height: `${barPct}%` }}
                          ></div>
                        </div>

                        <span className="text-[10px] font-bold text-on-surface-variant">
                          {mItem.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-4">
              <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2 border-b border-surface-variant pb-3">
                <span className="material-symbols-outlined text-secondary">table_chart</span>
                Moliyaviy Hisobot Jamlamasi
              </h3>

              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between items-center p-3 bg-surface-container-low rounded-xl border border-outline-variant">
                  <span className="font-semibold text-on-surface">1. Jami Tushum (Savdo)</span>
                  <span className="font-currency font-extrabold text-on-surface text-sm">
                    {activePeriodRevenue.toLocaleString('ru-RU')} UZS
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-surface-container-low rounded-xl border border-outline-variant">
                  <span className="font-semibold text-on-surface-variant">2. Mahsulot Tannarxi (Tushum - Yalpi)</span>
                  <span className="font-currency font-extrabold text-gray-700 text-sm">
                    -{productCost.toLocaleString('ru-RU')} UZS
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-surface-container-low rounded-xl border border-outline-variant">
                  <span className="font-semibold text-amber-900">3. Operatsion Xarajatlar</span>
                  <span className="font-currency font-extrabold text-amber-900 text-sm">
                    -{totalExpenses.toLocaleString('ru-RU')} UZS
                  </span>
                </div>

                <div className="border-t border-outline-variant my-1"></div>

                <div
                  className={`flex flex-nowrap justify-between items-center p-3.5 rounded-xl border-2 shadow-xs gap-2 ${
                    netProfit >= 0
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                      : 'bg-red-50 border-red-500 text-red-900'
                  }`}
                >
                  <span className="font-extrabold text-xs sm:text-sm whitespace-nowrap">Yakuniy Sof Foyda:</span>
                  <span className="font-currency font-black text-xs sm:text-sm whitespace-nowrap">
                    {netProfit.toLocaleString('ru-RU')} UZS
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Margin Modal */}
      {showMarginModal && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-surface-container-lowest rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-outline-variant flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-surface-variant pb-3">
              <h3 className="font-headline font-bold text-base text-on-surface">
                Marja Foizini O'zgartirish
              </h3>
              <button
                onClick={() => setShowMarginModal(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleMarginSave} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Savdo Marjasi (%)
                </label>
                <input
                  type="number"
                  placeholder="20"
                  value={tempMargin}
                  onChange={(e) => setTempMargin(e.target.value)}
                  required
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-lg font-bold text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMarginModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-semibold text-xs"
                >
                  Bekor Qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-primary shadow"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Budget Limit Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-surface-container-lowest rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-outline-variant flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-surface-variant pb-3">
              <h3 className="font-headline font-bold text-base text-on-surface">
                Oylik Xarajat Limitini Sozlash
              </h3>
              <button
                onClick={() => setShowBudgetModal(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleBudgetSave} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Oylik Xarajat Limiti (UZS)
                </label>
                <input
                  type="text"
                  placeholder="Masalan: 15 000 000"
                  value={tempBudget}
                  onChange={(e) => setTempBudget(formatInput(e.target.value))}
                  required
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-lg font-bold text-on-surface focus:outline-none focus:border-primary font-currency"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-semibold text-xs"
                >
                  Bekor Qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-primary shadow"
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
