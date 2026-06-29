import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext({});

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'success', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const success = useCallback((message, duration) => {
    show(message, 'success', duration);
  }, [show]);

  const error = useCallback((message, duration) => {
    show(message, 'error', duration);
  }, [show]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'toast-error' : ''}`}>
            <span style={{ fontSize: '1.1rem' }}>
              {t.type === 'error' ? '⚠️' : '🌿'}
            </span>
            <div style={{ flex: 1 }}>{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
