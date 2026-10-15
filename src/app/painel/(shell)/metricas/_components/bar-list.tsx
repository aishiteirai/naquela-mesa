import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Bar = { key: string; label: string; value: number; display: string };

/** Gráfico de barras horizontal só com CSS; o valor exato fica em texto ao lado. */
export function BarList({ title, items }: { title: string; items: Bar[] }) {
  const max = Math.max(0, ...items.map((item) => item.value));
  return (
    <Card role="region" aria-label={title}>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
                <span className="truncate" title={item.label}>
                  {item.label}
                </span>
                <span aria-hidden="true" className="h-3 rounded-full bg-muted">
                  <span
                    className="block h-3 rounded-full bg-primary"
                    style={{ width: `${max > 0 ? Math.max(2, (item.value / max) * 100) : 0}%` }}
                  />
                </span>
                <span className="text-muted-foreground tabular-nums">{item.display}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
