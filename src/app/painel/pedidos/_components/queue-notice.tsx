"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const NOTICE_MS = 6_000;
const NoticeContext = createContext<(message: string) => void>(() => {});

export function QueueNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ text: string; at: number } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const show = useCallback((text: string) => setNotice({ text, at: Date.now() }), []);
  return (
    <NoticeContext value={show}>
      {notice && (
        <p role="status" data-testid="queue-notice" className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:bg-amber-900 dark:text-amber-50">
          {notice.text}
        </p>
      )}
      {children}
    </NoticeContext>
  );
}

export function useQueueNotice(): (message: string) => void {
  return useContext(NoticeContext);
}
