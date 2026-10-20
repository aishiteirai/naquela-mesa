"use client";

import { ErrorFallback } from "@/app/_components/error-fallback";

export default function StoreError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorFallback {...props} />;
}
