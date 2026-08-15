"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ConfirmOptions = { title: string; description?: string; danger?: boolean };
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setPending(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-900 p-5">
            <h2 className="text-base font-semibold">{pending.title}</h2>
            {pending.description && <p className="mt-2 text-sm text-white/60">{pending.description}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => settle(false)}
                className="rounded-full border border-white/20 px-4 py-2 text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={() => settle(true)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  pending.danger ? "bg-red-500 text-white" : "bg-white text-black"
                }`}
              >
                実行
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
