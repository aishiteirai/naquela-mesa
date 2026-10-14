"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">Algo deu errado.</h1>
        <p>Tente recarregar a página. Se continuar, fale com o suporte.</p>
        <button type="button" onClick={reset} className="w-fit rounded border px-4 py-2">
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
