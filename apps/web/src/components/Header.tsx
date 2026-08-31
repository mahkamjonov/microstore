import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useOfflineSync } from '../hooks/useOfflineSync';

export const Header: React.FC = () => {
  const { activeTab, setActiveTab, isAuthenticated, user, logoutUser, setShowAuthModal } = useStore();
  const { isOnline, pendingCount } = useOfflineSync();

  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { id: 'seller', label: 'Sotuvchi' },
    { id: 'tushum', label: 'Tushum' },
    { id: 'debts', label: 'Qarzlar' },
    { id: 'expenses', label: 'Xarajat' },
    { id: 'profit', label: 'Sof foyda' },
  ] as const;

  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProfileOpen((prev) => !prev);
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.stopPropagation();
    logoutUser();
    setIsProfileOpen(false);
  };

  const handleLoginClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProfileOpen(false);
    setShowAuthModal(true);
  };

  return (
    <header className="w-full sticky top-0 z-50 bg-surface/95 backdrop-blur-md border-b border-outline-variant px-4 py-3 max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-3 shadow-xs">
      {/* MicroStore Logo & Title */}
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-2xl">
          storefront
        </span>
        <h1 className="font-headline text-lg sm:text-xl text-primary font-extrabold tracking-tight">
          MicroStore
        </h1>
      </div>

      {/* 5 Core Main Navigation Menu Bar with Smooth Sliding Pill Animation */}
      <div className="overflow-x-auto no-scrollbar py-0.5">
        <div className="relative flex bg-surface-container-high p-1 rounded-xl border border-outline-variant w-[380px] sm:w-[420px]">
          {/* Absolute Active Sliding Pill Indicator */}
          <div
            className="absolute top-1 bottom-1 bg-[#059669] rounded-lg shadow-xs transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none"
            style={{
              left: `calc(${activeIndex * 20}% + 4px)`,
              width: `calc(20% - 8px)`,
            }}
          />

          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative z-10 flex-1 py-2 text-xs sm:text-sm font-semibold transition-colors duration-200 text-center whitespace-nowrap select-none ${
                activeTab === tab.id
                  ? 'text-white font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right Area: Sync Status Badge & ALWAYS VISIBLE Interactive Circular Profile Avatar */}
      <div className="flex items-center gap-2 relative z-50">
        {/* Sync Status Badge */}
        <div className="flex items-center gap-1.5 bg-[#DBEAFE] px-2.5 py-1.5 rounded-full text-xs font-semibold text-[#1E3A8A] whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse"></span>
          <span className="hidden sm:inline">
            {isOnline
              ? pendingCount > 0
                ? `${pendingCount} sync`
                : 'Sinxronlandi'
              : 'Offline'}
          </span>
          <span className="material-symbols-outlined text-[16px]">
            sync
          </span>
        </div>

        {/* Interactive Profile Avatar Button & Popover Dropdown */}
        <div className="relative z-50" ref={dropdownRef}>
            <button
              type="button"
              onClick={handleToggleMenu}
              className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-extrabold text-sm shadow-xs transition-all active:scale-95 hover:scale-105 overflow-hidden cursor-pointer ${
                isAuthenticated
                  ? 'bg-[#DCFCE7] border-[#059669] text-[#15803D]'
                  : 'bg-surface-container-high border-outline-variant text-on-surface-variant hover:border-primary'
              }`}
              title="Profil menyusi"
            >
              {isAuthenticated && user ? (
                user.photo ? (
                  <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{user.name ? user.name.charAt(0).toUpperCase() : 'F'}</span>
                )
              ) : (
                <span className="material-symbols-outlined text-xl">person</span>
              )}
            </button>

            {/* Floating Popover Dropdown Menu */}
            {isProfileOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3.5 z-[999999] flex flex-col text-left pointer-events-auto animate-fadeIn"
              >
                {isAuthenticated && user ? (
                  <>
                    <div className="flex items-center gap-3 pb-2.5">
                      <div className="w-10 h-10 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center font-extrabold text-base flex-shrink-0">
                        {user.photo ? (
                          <img src={user.photo} alt={user.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          user.name ? user.name.charAt(0).toUpperCase() : 'F'
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {user.name || 'Foydalanuvchi'}
                        </span>
                        <span className="text-[11px] font-medium text-emerald-700 truncate mt-0.5">
                          {user.phone || '+998 90 123 45 67'}
                        </span>
                      </div>
                    </div>

                    <div className="my-1.5 border-t border-gray-100" />

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
                        <span className="text-xs font-bold text-gray-900">
                          Mehmon (Kirmagan)
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Tizimga kirilmagan
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-[11px] text-gray-500 mt-1 leading-normal">
                      Barcha moliyaviy ma'lumotlarni saqlash va sinxronlash uchun kiring.
                    </p>

                    <div className="my-2 border-t border-gray-100" />

                    <button
                      type="button"
                      onClick={handleLoginClick}
                      className="w-full text-left text-xs font-bold text-[#059669] hover:bg-emerald-50 p-2 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">login</span>
                      <span>Telegram orqali kirish</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
    </header>
  );
};
