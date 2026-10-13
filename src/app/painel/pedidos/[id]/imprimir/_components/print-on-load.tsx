"use client";

import { useEffect } from "react";

export function PrintOnLoad() {
  useEffect(() => {
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
