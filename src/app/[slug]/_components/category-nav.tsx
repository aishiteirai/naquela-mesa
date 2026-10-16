"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { categoryAnchor } from "@/app/[slug]/_lib/anchors";

type NavCategory = { id: string; name: string };

export function CategoryNav({ categories }: { categories: NavCategory[] }) {
  const [active, setActive] = useState(categories[0]?.id ?? null);
  const suspended = useRef(false);
  const suspendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sections = categories
      .map((category) => document.getElementById(categoryAnchor(category.id)))
      .filter((element): element is HTMLElement => element !== null);
    // A seção mais alta que cruza a faixa logo abaixo das abas é a ativa.
    const observer = new IntersectionObserver(
      (entries) => {
        if (suspended.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace(categoryAnchor(""), ""));
      },
      { rootMargin: "-64px 0px -60% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [categories]);

  // No fim da página a última categoria vence (seções curtas nunca chegam à faixa do observer).
  useEffect(() => {
    const last = categories[categories.length - 1]?.id;
    if (!last) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      if (suspended.current) return;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) setActive(last);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [categories]);

  useEffect(
    () => () => {
      if (suspendTimer.current) clearTimeout(suspendTimer.current);
    },
    [],
  );

  function goTo(categoryId: string) {
    setActive(categoryId);
    suspended.current = true;
    if (suspendTimer.current) clearTimeout(suspendTimer.current);
    const resume = () => {
      suspended.current = false;
      window.removeEventListener("scrollend", resume);
      if (suspendTimer.current) clearTimeout(suspendTimer.current);
    };
    if ("onscrollend" in window) window.addEventListener("scrollend", resume, { once: true });
    suspendTimer.current = setTimeout(resume, 1000);
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
    <nav aria-label="Categorias" className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
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
