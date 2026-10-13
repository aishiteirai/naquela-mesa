"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const NoticeContext = createContext<(message: string) => void>(() => {});

export function QueueNoticeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <NoticeContext value={setMessage}>
      {message && (
        <p role="status" data-testid="queue-notice" className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:bg-amber-900 dark:text-amber-50">
          {message}
        </p>
      )}
      {children}
    </NoticeContext>
  );
}

export function useQueueNotice(): (message: string) => void {
  return useContext(NoticeContext);
}
