"use client";

import { useState } from "react";
import { inputClass, secondaryButtonClass } from "@/app/_components/styles";

export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex flex-col gap-1">
        Link de acesso
        <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} className={inputClass} />
      </label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={copy} className={secondaryButtonClass}>
          {copied ? "Copiado!" : "Copiar link"}
        </button>
        <span className="text-neutral-700 dark:text-neutral-300">Vale por 7 dias e uma vez só. Envie ao dono pelo WhatsApp.</span>
      </div>
    </div>
  );
}
