"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Corpo comum dos `error.tsx`: avisa, reporta ao Sentry e deixa tentar de novo sem perder o resto da tela. */
export function ErrorFallback({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
    }
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex w-full max-w-md flex-col items-start gap-3 px-4 py-16">
      <h2 className="text-xl font-semibold">Algo deu errado.</h2>
      <p className="text-muted-foreground">Pode ter sido uma falha de conexão. Tente de novo; se continuar, recarregue a página.</p>
      <Button type="button" onClick={() => retry()}>
        Tentar de novo
      </Button>
    </div>
  );
}
