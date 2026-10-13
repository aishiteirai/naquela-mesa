"use client";

import { useEffect, useRef } from "react";

export function PrintOnLoad() {
  const printed = useRef(false);

  useEffect(() => {
    if (printed.current) return;
    printed.current = true;
    window.print();
  }, []);

  return (
    <div className="flex gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className="rounded border px-3 py-1.5 text-sm">
        Imprimir
      </button>
      <button type="button" onClick={() => window.close()} className="rounded border px-3 py-1.5 text-sm">
        Fechar
      </button>
    </div>
  );
}
