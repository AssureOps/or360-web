import React, { createContext, useContext, useState, useCallback } from "react";

type Toast = { id: string; message: string; kind?: "success" | "error" | "info"; ttl?: number };

const ToastCtx = createContext<{ show: (message: string, kind?: Toast["kind"], ttl?: number) => void }>({
  show: () => {}
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: Toast["kind"] = "info", ttl = 3500) => {
    const t: Toast = { id: Math.random().toString(36).slice(2), message, kind, ttl };
    setToasts(prev => [...prev, t]);
    window.setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), ttl);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-2 z-[1000] mx-auto flex w-full max-w-lg flex-col gap-2 px-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md border px-3 py-2 text-sm shadow ${
              t.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
              t.kind === "error"   ? "border-rose-200 bg-rose-50 text-rose-800" :
                                     "border-slate-200 bg-white text-slate-800"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
