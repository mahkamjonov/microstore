import React, { useEffect } from 'react';
import { Header } from './components/Header';
import { DateSelector } from './components/DateSelector';
import { DailyRevenueForm } from './components/DailyRevenueForm';
import { SupplierDebtPage } from './components/SupplierDebtPage';
import { AdminDashboard } from './components/AdminDashboard';
import { TelegramAuthModal } from './components/TelegramAuthModal';
import { useStore } from './store/useStore';

export const App: React.FC = () => {
  const { activeTab, logoutUser } = useStore();

  // Purge all storage on mount for fresh unauthenticated testing
  useEffect(() => {
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('microstore_user_session');
      localStorage.clear();
      sessionStorage.clear();
    } catch (err) {}

    logoutUser();

    // Developer test mode helper: window.resetAuth()
    (window as any).resetAuth = () => {
      logoutUser();
      console.log('⚡ Auth session successfully reset! User logged out.');
    };
  }, [logoutUser]);

  return (
    <div className="min-h-screen bg-background text-on-background pb-12 antialiased selection:bg-primary/20">
      {/* Top Bar Main Navigation Header */}
      <Header />

      {/* Global Lazy Telegram Authentication Modal */}
      <TelegramAuthModal />

      {/* Main Responsive Container */}
      <main className="w-full max-w-5xl mx-auto px-3 sm:px-4 pt-3 sm:pt-5">
        {activeTab === 'seller' && (
          /* Page 1: Sotuvchi (POS Entry Page ONLY) */
          <div className="max-w-xl mx-auto flex flex-col gap-4 sm:gap-6">
            <DateSelector />
            <DailyRevenueForm />
          </div>
        )}

        {activeTab === 'debts' && (
          /* Page 3: Qarzlar (Supplier Debt Management) */
          <SupplierDebtPage />
        )}

        {(activeTab === 'tushum' || activeTab === 'expenses' || activeTab === 'profit') && (
          /* Pages 2, 4, 5: Direct Views (Tushum, Xarajat, Sof foyda) without nested sub-tab headers */
          <AdminDashboard />
        )}
      </main>
    </div>
  );
};

export default App;
