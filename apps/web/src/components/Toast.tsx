import React from 'react';
import { useStore } from '../store/useStore';

export const Toast: React.FC = () => {
  const { toast } = useStore();

  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div
      role="alert"
      onClick={() => useStore.setState({ toast: null })}
      className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[100000] max-w-[92vw] sm:max-w-md px-4 py-3 rounded-2xl shadow-2xl flex items-start gap-2.5 text-white text-xs font-semibold cursor-pointer animate-fadeIn ${
        isError ? 'bg-red-600' : 'bg-emerald-700'
      }`}
    >
      <span className="material-symbols-outlined text-lg flex-shrink-0">
        {isError ? 'error' : 'check_circle'}
      </span>
      <span className="leading-snug">{toast.message}</span>
    </div>
  );
};
