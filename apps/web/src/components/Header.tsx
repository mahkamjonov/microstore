import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { CashierManagementModal } from './CashierManagementModal';

export const Header: React.FC = () => {
  const { activeTab, setActiveTab, isAuthenticated, user, logoutUser, setShowAuthModal } = useStore();
  const { isOnline, pendingCount } = useOfflineSync();

  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [showCashierModal, setShowCashierModal] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isCashier = user?.role === 'cashier';

  const allTabs = [
    { id: 'seller', label: 'Sotuvchi' },
    { id: 'tushum', label: 'Tushum' },
    { id: 'debts', label: 'Qarzlar' },
    { id: 'expenses', label: 'Xarajat' },
    { id: 'profit', label: 'Sof foyda' },
  ] as const;

  const tabs = isCashier
    ? allTabs.filter((t) => t.id === 'seller' || t.id === 'tushum')
    : allTabs;

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeTab));
  const tabWidthPct = 100 / tabs.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsProfileOpen(false);
    logoutUser();
  };

  const handleLoginClick = () => {
    setIsProfileOpen(false);
    setShowAuthModal(true);
  };

  const handleCashierModalClick = () => {
    setIsProfileOpen(false);
    setShowCashierModal(true);
  };

  const getAvatarUrl = (photoUrl?: string, name?: string) => {
    if (photoUrl && photoUrl.trim() !== '') return photoUrl;
    const seed = encodeURIComponent(name || 'User');
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black text-xl border border-emerald-500/20 shadow-xs">
              M
            </div>
            <div>
              <h1 className="font-headline font-black text-lg text-on-surface tracking-tight leading-none">
                MicroStore
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                  {isOnline ? 'Onlayn' : 'Oflayn'}
                </span>
                {pendingCount > 0 && (
                  <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.2 rounded-md font-bold">
                    {pendingCount} kutilmoqda
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-xl mx-2 sm:mx-4 overflow-x-auto no-scrollbar py-1">
            <div className="relative bg-surface-container-high p-1 rounded-2xl border border-outline-variant/40 flex min-w-max md:min-w-0">
              <div
                className="absolute top-1 bottom-1 bg-surface rounded-xl shadow-xs transition-all duration-300 ease-out border border-outline-variant/30"
                style={{
                  width: `calc(${tabWidthPct}% - 4px)`,
                  left: `calc(${activeIndex * tabWidthPct}% + 2px)`,
                }}
              />

              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`relative flex-1 py-1.5 px-3 rounded-xl text-xs font-headline font-bold transition-colors z-10 text-center whitespace-nowrap ${
                      isActive
                        ? 'text-emerald-700 font-extrabold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 p-1.5 rounded-2xl hover:bg-surface-container-high transition-all border border-outline-variant/40"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs overflow-hidden border border-emerald-300">
                {isAuthenticated && user ? (
                  <img
                    src={getAvatarUrl(user.photo, user.name)}
                    alt={user.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="material-symbols-outlined text-base">person</span>
                )}
              </div>
              <span className="text-xs font-bold text-on-surface hidden md:block max-w-[100px] truncate">
                {isAuthenticated && user ? user.name : 'Mehmon'}
              </span>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-surface border border-outline-variant/60 rounded-3xl p-3 shadow-2xl z-50 animate-fade-in">
                {isAuthenticated && user ? (
                  <>
                    <div className="flex items-center gap-3 pb-2.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold text-base flex-shrink-0 overflow-hidden border border-emerald-300">
                        <img
                          src={getAvatarUrl(user.photo, user.name)}
                          alt={user.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-on-surface truncate">
                            {user.name || 'Foydalanuvchi'}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${
                              isCashier
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            {isCashier ? 'Kassir' : 'Egasi'}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-emerald-700 truncate mt-0.5">
                          {user.phone || '+998 90 123 45 67'}
                        </span>
                      </div>
                    </div>

                    <div className="my-1.5 border-t border-outline-variant/40" />

                    {!isCashier && (
                      <button
                        type="button"
                        onClick={handleCashierModalClick}
                        className="w-full text-left text-xs font-bold text-on-surface hover:bg-emerald-50 hover:text-emerald-700 p-2 rounded-xl transition-colors flex items-center gap-2 mb-1"
                      >
                        <span className="material-symbols-outlined text-base text-emerald-600">person_add</span>
                        <span>Sotuvchilar (Kassirlar)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left text-xs font-bold text-red-600 hover:bg-red-50 p-2 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">logout</span>
                      <span>Tizimdan chiqish</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5 pb-2">
                      <div className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center">
                        <span className="material-symbols-outlined text-lg">person_off</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface">Mehmon</span>
                        <span className="text-[10px] text-on-surface-variant">Tizimga kirilmagan</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-on-surface-variant mt-1 leading-normal">
                      Do'kuningiz ma'lumotlarini saqlash uchun kiring yoki ro'yxatdan o'ting.
                    </p>

                    <div className="my-2 border-t border-outline-variant/40" />

                    <button
                      type="button"
                      onClick={handleLoginClick}
                      className="w-full text-left text-xs font-bold text-emerald-600 hover:bg-emerald-50 p-2 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">login</span>
                      <span>Kirish / Ro'yxatdan o'tish</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <CashierManagementModal isOpen={showCashierModal} onClose={() => setShowCashierModal(false)} />
    </>
  );
};
