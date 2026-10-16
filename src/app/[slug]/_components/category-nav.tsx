"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { categoryAnchor } from "@/app/[slug]/_lib/anchors";

type NavCategory = { id: string; name: string };

export function CategoryNav({ categories }: { categories: NavCategory[] }) {
  const [active, setActive] = useState(categories[0]?.id ?? null);
  const suspended = useRef(false);

  const navRef = useRef<HTMLElement>(null);

  // Aba ativa calculada só pela posição de scroll: fim da página => última;
  // senão a última seção cujo topo já passou da barra de abas; senão a primeira.
  const computeActive = useCallback(() => {
    const first = categories[0];
    const last = categories[categories.length - 1];
    if (suspended.current || !first || !last) return;
    const { scrollHeight } = document.documentElement;
    // Só vale se a página rola de fato (sem scroll, "estar no fim" é trivial).
    if (scrollHeight > window.innerHeight + 2 && window.innerHeight + window.scrollY >= scrollHeight - 2) {
      setActive(last.id);
      return;
    }
    const navBottom = navRef.current?.getBoundingClientRect().bottom ?? 0;
    let current = first.id;
    for (const category of categories) {
      const section = document.getElementById(categoryAnchor(category.id));
      if (section && section.getBoundingClientRect().top <= navBottom + 16) current = category.id;
    }
    setActive(current);
  }, [categories]);

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          computeActive();
        });
      }
    };
    // Entrada do usuário (roda, toque, teclado, arrastar a barra) encerra a "fixação" da aba clicada.
    const release = () => {
      suspended.current = false;
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) window.addEventListener(type, release, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) window.removeEventListener(type, release);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [computeActive]);

  // A aba clicada fica fixa até o usuário mexer no scroll (seções curtas no fim da página
  // não alinham ao topo, e o cálculo por posição escolheria outra aba).
  function goTo(categoryId: string) {
    setActive(categoryId);
    suspended.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(categoryAnchor(categoryId))?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  const firstScroll = useRef(true);
  useEffect(() => {
    if (firstScroll.current) {
      firstScroll.current = false;
      return;
    }
    if (!active) return;
    document.querySelector(`[data-category-tab="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <nav ref={navRef} aria-label="Categorias" className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <ul className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
        {categories.map((category) => (
          <li key={category.id} className="shrink-0">
            <button
              type="button"
              onClick={() => goTo(category.id)}
              data-category-tab={category.id}
              aria-current={active === category.id ? "true" : undefined}
              className={cn(
                "block cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active === category.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted",
              )}
            >
              {category.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
