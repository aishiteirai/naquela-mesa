"use client";

import { usePathname } from "next/navigation";
import { pageTrail } from "@/app/painel/_lib/nav";

/** Trilha da seção atual no topo do conteúdo (o título da página continua no <h1> de cada tela). */
export function PageTitle() {
  const trail = pageTrail(usePathname());
  if (trail.length === 0) return null;

  return (
    <p className="truncate text-sm text-muted-foreground">
      {trail.map((part, index) => (
        <span key={part}>
          {index > 0 && <span aria-hidden="true"> / </span>}
          <span className={index === trail.length - 1 ? "font-medium text-foreground" : undefined}>{part}</span>
        </span>
      ))}
    </p>
  );
}
