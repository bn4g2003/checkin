import React, { useCallback, useMemo, useState } from 'react';
import { ToastCtx } from './toastContext.js';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback(id => setToasts(list => list.filter(t => t.id !== id)), []);
  const addToast = useCallback(toast => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, type: toast.type || 'info', message: toast.message || '' };
    setToasts(list => [t, ...list].slice(0,5));
    setTimeout(() => remove(id), toast.duration || 2500);
    return id;
  }, [remove]);
  const value = useMemo(() => ({ addToast }), [addToast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <style>{`
        @keyframes gp_fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="fixed top-4 right-4 z-[1000] space-y-2">
        {toasts.map(t => {
          const colorClass = t.type === 'success'
            ? 'bg-green-600'
            : t.type === 'error'
              ? 'bg-red-600'
              : 'bg-gray-900';
          return (
            <div
              key={t.id}
              className={`px-4 py-3 rounded shadow text-sm transition-all duration-200 ${colorClass} text-white hover:shadow-lg`}
              style={{ animation: 'gp_fadeIn .18s ease-out' }}
            >
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

// hook moved to useToast.js to satisfy fast-refresh rule
