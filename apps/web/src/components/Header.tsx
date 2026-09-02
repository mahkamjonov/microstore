import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { CashierManagementModal } from './CashierManagementModal';

export const Header: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isAuthenticated,
    user,
    logoutUser,
    setShowAuthModal,
    stores,
    activeStoreId,
    activeStoreName,
    switchActiveStore,
    addNewStore,
    fetchStores,
  } = useStore();

  const { isOnline, pendingCount } = useOfflineSync();

  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState<boolean>(false);
  const [showCashierModal, setShowCashierModal] = useState<boolean>(false);

  // Add Store Modal State
  const [showAddStoreModal, setShowAddStoreModal] = useState<boolean>(false);
  const [newStoreName, setNewStoreName] = useState<string>('');
  const [newStoreLocation, setNewStoreLocation] = useState<string>('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const storeDropdownRef = useRef<HTMLDivElement>(null);

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
    fetchStores();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setIsStoreDropdownOpen(false);
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

  const handleCreateStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;
    await addNewStore(newStoreName, newStoreLocation);
    setNewStoreName('');
    setNewStoreLocation('');
    setShowAddStoreModal(false);
  };

  const getAvatarUrl = (photoUrl?: string, name?: string) => {
    if (photoUrl && photoUrl.trim() !== '') return photoUrl;
    const seed = encodeURIComponent(name || 'User');
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant/60 py-2.5">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between w-full gap-3">
          {/* Left: Clean Brand Section + Dynamic Store Selector Dropdown */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {/* Brand Logo & Static Label */}
            <div className="flex items-center gap-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 font-extrabold text-emerald-700 text-sm shadow-xs">
                M
              </div>
              <span className="font-headline font-black text-slate-900 text-sm tracking-tight">MicroStore</span>
            </div>

            <span className="text-slate-300 select-none">|</span>

            {/* Dynamic Store Selector Dropdown */}
            <div className="relative" ref={storeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsStoreDropdownOpen(!isStoreDropdownOpen)}
                className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors"
                aria-label="Store Switcher"
              >
                <span className="material-symbols-outlined text-sm text-slate-500">store</span>
                <span className="max-w-[120px] sm:max-w-[150px] truncate font-bold text-slate-800">
                  {activeStoreName || "Do'konni tanlang"}
                </span>
                <span className="material-symbols-outlined text-xs text-slate-400">
                  {isStoreDropdownOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {/* Multi-Store Selector Dropdown Menu */}
              {isStoreDropdownOpen && (
                <div className="absolute left-0 top-9 w-64 bg-surface border border-outline-variant/60 rounded-3xl p-3 shadow-2xl z-50 animate-fade-in flex flex-col gap-1">
                  <div className="text-[11px] font-bold text-on-surface-variant px-2 py-1 uppercase tracking-wider">
                    Mening Do'konlarim
                  </div>

                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto no-scrollbar">
                    {stores.map((s) => {
                      const isActive = s.id === activeStoreId;
                      return (
                        <button
                          key={s.id}
                          onClick={async () => {
                            setIsStoreDropdownOpen(false);
                            await switchActiveStore(s.id, s.name);
                          }}
                          className={`flex items-center justify-between p-2 px-3 rounded-xl text-xs font-bold transition-all text-left ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-700 font-extrabold border border-emerald-500/20'
                              : 'text-on-surface hover:bg-surface-container-high'
                          }`}
                        >
                          <span className="truncate">{s.name}</span>
                          {isActive && (
                            <span className="material-symbols-outlined text-base text-emerald-600">check</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="my-1 border-t border-outline-variant/40" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsStoreDropdownOpen(false);
                      setShowAddStoreModal(true);
                    }}
                    className="w-full text-left text-xs font-bold text-emerald-600 hover:bg-emerald-50 p-2 px-3 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">add_business</span>
                    <span>+ Yangi do'kon qo'shish</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Center: Navigation Tabs (Clean Natural Flexbox Layout) */}
          <nav className="flex items-center justify-center flex-1 mx-2 sm:mx-4 overflow-x-auto no-scrollbar py-1">
            <div className="relative flex items-center gap-1 rounded-2xl bg-surface-container-high p-1 border border-outline-variant/40 min-w-max">
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
                    className={`relative py-1.5 px-3.5 rounded-xl text-xs font-headline font-bold transition-colors z-10 text-center whitespace-nowrap ${
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
          </nav>

          {/* Right: Avatar Profile Trigger & Menu */}
          <div className="flex items-center justify-end flex-shrink-0 relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-outline-variant/40 hover:bg-surface-container-high transition-all"
              aria-label="Profile Menu"
            >
              <div className="w-full h-full rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs overflow-hidden border border-emerald-300">
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
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-11 w-64 bg-surface border border-outline-variant/60 rounded-3xl p-3 shadow-2xl z-50 animate-fade-in">
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

      {/* Add Store Modal Popup */}
      {showAddStoreModal && (
        <div className="fixed inset-0 z-[99999] bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-5 sm:p-6 shadow-2xl max-w-md w-full flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2.5 border-b border-outline-variant/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#10B981] text-xl">store</span>
                <h4 className="font-headline font-bold text-base text-on-surface">
                  Yangi do'kon / Filial qo'shish
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStoreModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-variant flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateStoreSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface-variant">
                  Do'kon Nomi *
                </label>
                <input
                  type="text"
                  required
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Masalan: MicroStore 2 - Chilonzor"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface font-bold text-sm focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface-variant">
                  Joylashuv / Manzil (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={newStoreLocation}
                  onChange={(e) => setNewStoreLocation(e.target.value)}
                  placeholder="Masalan: Toshkent sh., Chilonzor 9-mavze"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface font-bold text-sm focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStoreModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant bg-surface-container-high hover:bg-surface-variant transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-[#10B981] hover:bg-emerald-600 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>Qo'shish</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CashierManagementModal isOpen={showCashierModal} onClose={() => setShowCashierModal(false)} />
    </>
  );
};
