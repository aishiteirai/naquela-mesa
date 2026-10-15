export type Bar = { key: string; label: string; value: number; display: string };

/** Gráfico de barras horizontal só com CSS; o valor exato fica em texto ao lado. */
export function BarList({ title, items }: { title: string; items: Bar[] }) {
  const max = Math.max(0, ...items.map((item) => item.value));
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-700 dark:text-neutral-300">Sem dados no período.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
              <span className="truncate" title={item.label}>
                {item.label}
              </span>
              <span aria-hidden="true" className="h-3 rounded bg-neutral-200 dark:bg-neutral-800">
                <span
                  className="block h-3 rounded bg-neutral-800 dark:bg-neutral-200"
                  style={{ width: `${max > 0 ? Math.max(2, (item.value / max) * 100) : 0}%` }}
                />
              </span>
              <span className="tabular-nums">{item.display}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
