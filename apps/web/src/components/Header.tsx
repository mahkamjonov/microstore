import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useOfflineSync } from '../hooks/useOfflineSync';

export const Header: React.FC = () => {
  const { activeTab, setActiveTab, isAuthenticated, user, logoutUser, setShowAuthModal } = useStore();
  const { isOnline, pendingCount } = useOfflineSync();

  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const storeId = user?.id || 'microstore_store_1';
  const botInviteLink = `https://t.me/microstore21_bot?start=invite_store_${storeId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(botInviteLink)}`;

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(botInviteLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

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

  const handleInviteCashierClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProfileOpen(false);
    if (!isAuthenticated) {
      setShowAuthModal(true);
    } else {
      setShowInviteModal(true);
    }
  };

  const getAvatarUrl = (photo?: string, name?: string) => {
    if (photo && !photo.includes('bottts')) {
      return photo;
    }
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'User')}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
  };

  return (
    <>
      <header className="w-full sticky top-0 z-50 bg-surface/95 backdrop-blur-md border-b border-outline-variant px-4 py-3 max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-3 shadow-xs">
        {/* MicroStore Logo & Title */}
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">
            storefront
          </span>
          <h1 className="font-headline text-lg sm:text-xl text-primary font-extrabold tracking-tight">
            MicroStore
          </h1>
          {isCashier && (
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
              Kassir Rejimi
            </span>
          )}
        </div>

        {/* Core Main Navigation Menu Bar with Smooth Sliding Pill Animation */}
        <div className="overflow-x-auto no-scrollbar py-0.5">
          <div className={`relative flex bg-surface-container-high p-1 rounded-xl border border-outline-variant ${isCashier ? 'w-[200px] sm:w-[240px]' : 'w-[380px] sm:w-[420px]'}`}>
            {/* Absolute Active Sliding Pill Indicator */}
            <div
              className="absolute top-1 bottom-1 bg-[#059669] rounded-lg shadow-xs transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none"
              style={{
                left: `calc(${activeIndex * tabWidthPct}% + 4px)`,
                width: `calc(${tabWidthPct}% - 8px)`,
              }}
            />

            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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
                <img
                  src={getAvatarUrl(user.photo, user.name)}
                  alt={user.name}
                  className="w-full h-full object-cover bg-emerald-50"
                />
              ) : (
                <span className="material-symbols-outlined text-xl">person</span>
              )}
            </button>

            {/* Floating Popover Dropdown Menu */}
            {isProfileOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3.5 z-[999999] flex flex-col text-left pointer-events-auto animate-fadeIn"
              >
                {isAuthenticated && user ? (
                  <>
                    <div className="flex items-center gap-3 pb-2.5">
                      <div className="w-10 h-10 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center font-extrabold text-base flex-shrink-0 overflow-hidden border border-emerald-300">
                        <img
                          src={getAvatarUrl(user.photo, user.name)}
                          alt={user.name}
                          className="w-full h-full object-cover rounded-full bg-emerald-50"
                        />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900 truncate">
                            {user.name || 'Foydalanuvchi'}
                          </span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${
                            isCashier ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}>
                            {isCashier ? 'Kassir' : 'Egasi'}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-emerald-700 truncate mt-0.5">
                          {user.phone || '+998 90 123 45 67'}
                        </span>
                      </div>
                    </div>

                    <div className="my-1.5 border-t border-gray-100" />

                    {/* Sotuvchi taklif qilish button (Only for store owners) */}
                    {!isCashier && (
                      <button
                        type="button"
                        onClick={handleInviteCashierClick}
                        className="w-full text-left text-xs font-bold text-gray-800 hover:bg-emerald-50 hover:text-emerald-700 p-2 rounded-xl transition-colors flex items-center gap-2 mb-1"
                      >
                        <span className="material-symbols-outlined text-base text-emerald-600">person_add</span>
                        <span>Sotuvchi taklif qilish</span>
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

      {/* Sotuvchini Do'konga Taklif Qilish Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4 z-[999999] animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 flex flex-col gap-4 text-center relative">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors p-1"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <div className="flex flex-col items-center gap-1 mt-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                <span className="material-symbols-outlined text-2xl">person_add</span>
              </div>
              <h3 className="font-headline font-extrabold text-base text-gray-900">
                Sotuvchini Do'konga Taklif Qilish
              </h3>
              <p className="text-xs text-gray-500 font-medium px-2">
                Sotuvchi Telegram bot havolasi yoki QR-kod orqali do'konga biriktiriladi
              </p>
            </div>

            {/* Dynamic QR Code */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 flex flex-col items-center justify-center gap-2">
              <img
                src={qrCodeUrl}
                alt="Telegram Bot Invite QR Code"
                className="w-44 h-44 rounded-xl border border-gray-300 shadow-xs bg-white p-1"
              />
              <span className="text-[11px] font-bold text-gray-600">
                Sotuvchi uchun QR-Kod
              </span>
            </div>

            {/* Telegram Link with Copy Button */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-gray-500 text-left">
                Telegram Bot Taklif Havolasi:
              </label>
              <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-xl border border-gray-200">
                <input
                  type="text"
                  readOnly
                  value={botInviteLink}
                  className="bg-transparent text-xs font-semibold text-gray-700 w-full focus:outline-none truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isCopied ? 'check' : 'content_copy'}
                  </span>
                  <span>{isCopied ? 'Nusxalandi' : 'Nusxalash'}</span>
                </button>
              </div>
            </div>

            {/* Workflow Steps Guide */}
            <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200/60 text-left text-xs space-y-1.5 text-emerald-900 font-medium">
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-700">1.</span>
                <span>Sotuvchi QR-kodni skanerlaydi yoki havolani bosadi.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-700">2.</span>
                <span>Telegram botga kirib <b>"📱 Telefon raqamni yuborish"</b> tugmasini bosadi.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-700">3.</span>
                <span>Backend bu sotuvchini avtomatik <b>role: "cashier"</b> qilib biriktiradi.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
