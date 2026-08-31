import React, { useEffect } from 'react';
import { Header } from './components/Header';
import { DateSelector } from './components/DateSelector';
import { DailyRevenueForm } from './components/DailyRevenueForm';
import { SupplierDebtPage } from './components/SupplierDebtPage';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { useStore } from './store/useStore';

export const App: React.FC = () => {
  const { activeTab, loginUser, logoutUser } = useStore();

  // Restore Auth State on App Initial Load (localStorage Auth Sync)
  useEffect(() => {
    try {
      const savedUserStr = localStorage.getItem('microstore_user') || localStorage.getItem('microstore_user_session');
      const isAuthSaved = localStorage.getItem('microstore_auth') === 'true' || !!savedUserStr;

      if (savedUserStr && isAuthSaved) {
        const userData = JSON.parse(savedUserStr);
        loginUser(userData);
      }
    } catch (err) {
      console.error('Failed to restore auth session from localStorage:', err);
    }

    // Developer test helper: window.resetAuth()
    (window as any).resetAuth = () => {
      logoutUser();
      console.log('⚡ Auth session successfully reset! User logged out.');
    };
  }, [loginUser, logoutUser]);

  return (
    <div className="min-h-screen bg-background text-on-background pb-12 antialiased selection:bg-primary/20">
      {/* Top Bar Main Navigation Header */}
      <Header />

      {/* Global Direct Form-based Authentication Modal */}
      <AuthModal />

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
