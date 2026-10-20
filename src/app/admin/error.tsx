"use client";

import { ErrorFallback } from "@/app/_components/error-fallback";

export default function AdminError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorFallback {...props} />;
}
