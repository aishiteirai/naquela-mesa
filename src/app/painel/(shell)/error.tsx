// fica dentro do shell: a barra lateral continua na tela.
"use client";

import { ErrorFallback } from "@/app/_components/error-fallback";

export default function PainelError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorFallback {...props} />;
}
