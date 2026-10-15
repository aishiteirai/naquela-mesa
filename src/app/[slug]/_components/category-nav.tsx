"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { categoryAnchor } from "@/app/[slug]/_lib/anchors";

type NavCategory = { id: string; name: string };

export function CategoryNav({ categories }: { categories: NavCategory[] }) {
  const [active, setActive] = useState(categories[0]?.id ?? null);

  useEffect(() => {
    const sections = categories
      .map((category) => document.getElementById(categoryAnchor(category.id)))
      .filter((element): element is HTMLElement => element !== null);
    // A seção mais alta que cruza a faixa logo abaixo das abas é a ativa.
    const observer = new IntersectionObserver(
      (entries) => {
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

  useEffect(() => {
    if (!active) return;
    document.querySelector(`[data-category-tab="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <nav aria-label="Categorias" className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
        {categories.map((category) => (
          <li key={category.id} className="shrink-0">
            <a
              href={`#${categoryAnchor(category.id)}`}
              data-category-tab={category.id}
              aria-current={active === category.id ? "true" : undefined}
              className={cn(
                "block rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active === category.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted",
              )}
            >
              {category.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
