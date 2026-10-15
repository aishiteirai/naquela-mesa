"use client";

import { InfoIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";

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
        <Alert role="status" data-testid="queue-notice">
          <InfoIcon />
          <AlertTitle>{notice.text}</AlertTitle>
        </Alert>
      )}
      {children}
    </NoticeContext>
  );
}

export function useQueueNotice(): (message: string) => void {
  return useContext(NoticeContext);
}
