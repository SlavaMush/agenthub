"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type ToastTone = "ok" | "warn" | "muted";

type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  href?: string;
};

type ToastApi = {
  push: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 5200);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[min(100%-2.5rem,22rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-toast-in rounded-2xl border px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)] ${
              toast.tone === "ok"
                ? "border-mint/30 bg-[#0d1a16]/95 text-mint"
                : toast.tone === "warn"
                  ? "border-amber-500/30 bg-[#1a140c]/95 text-amber-200"
                  : "border-white/10 bg-[#0d1512]/95 text-text"
            }`}
          >
            <p className="text-sm font-medium">{toast.title}</p>
            {toast.href && (
              <a href={toast.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-text-muted hover:text-mint">
                View on explorer →
              </a>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
