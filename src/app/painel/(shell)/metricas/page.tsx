import { Suspense } from "react";
import {
  CHANNEL_LABELS,
  formatPeriodRange,
  formatQuantity,
  FULFILLMENT_LABELS,
  getStoreMetrics,
  PERIOD_LABELS,
  resolvePeriod,
  type Period,
} from "@/modules/orders";
import { formatBRL } from "@/shared/money";
import { secondaryButtonClass } from "@/app/_components/styles";
import { PeriodFields } from "@/app/painel/_components/period-fields";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { firstParam } from "@/app/painel/_lib/search-params";
import { BarList } from "./_components/bar-list";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <dt className="text-sm text-neutral-700 dark:text-neutral-300">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

async function Report({ storeId, timeZone, period }: { storeId: string; timeZone: string; period: Period }) {
  const metrics = await getStoreMetrics(storeId, period, timeZone);
  const empty = metrics.orderCount === 0 && metrics.cancelledCount === 0;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {PERIOD_LABELS[period.preset]} · {formatPeriodRange(period)}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicator label="Faturamento" value={formatBRL(metrics.revenueCents)} />
        <Indicator label="Pedidos" value={String(metrics.orderCount)} />
        <Indicator label="Ticket médio" value={formatBRL(metrics.averageTicketCents)} />
        <Indicator label="Cancelamentos" value={String(metrics.cancelledCount)} />
      </dl>
      <p className="text-xs text-neutral-700 dark:text-neutral-300">
        Faturamento, pedidos, ticket médio e gráficos consideram todos os pedidos, exceto os cancelados.
      </p>
      {empty ? (
        <p>Nenhum pedido neste período.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <BarList
            title="Mais vendidos (top 10)"
            items={metrics.topProducts.map((product) => ({
              key: product.name,
              label: product.name,
              value: product.quantity,
              display: `${formatQuantity(product.quantity)} · ${formatBRL(product.revenueCents)}`,
            }))}
          />
          <BarList
            title="Pedidos por hora"
            items={metrics.byHour.map((bucket) => ({
              key: String(bucket.hour),
              label: `${String(bucket.hour).padStart(2, "0")}h`,
              value: bucket.orders,
              display: String(bucket.orders),
            }))}
          />
          <BarList
            title="Por tipo de pedido"
            items={metrics.byFulfillment.map((row) => ({
              key: row.fulfillment,
              label: FULFILLMENT_LABELS[row.fulfillment],
              value: row.orders,
              display: `${row.orders} · ${formatBRL(row.revenueCents)}`,
            }))}
          />
          <BarList
            title="Por canal"
            items={metrics.byChannel.map((row) => ({
              key: row.channel,
              label: CHANNEL_LABELS[row.channel],
              value: row.orders,
              display: `${row.orders} · ${formatBRL(row.revenueCents)}`,
            }))}
          />
        </div>
      )}
    </div>
  );
}

async function Metrics({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { store } = await requireStoreAccess();
  const input = { preset: firstParam(params.periodo), from: firstParam(params.de), to: firstParam(params.ate) };
  const result = resolvePeriod(input, store.timezone);

  return (
    <div className="flex flex-col gap-6">
      <form aria-label="Período" className="flex flex-wrap items-end gap-3">
        <PeriodFields
          preset={result.ok ? result.period.preset : "personalizado"}
          from={result.ok ? result.period.from : (input.from ?? "")}
          to={result.ok ? result.period.to : (input.to ?? "")}
        />
        <button type="submit" className={secondaryButtonClass}>
          Aplicar
        </button>
        <p className="w-full text-xs text-neutral-700 dark:text-neutral-300">&quot;De&quot; e &quot;Até&quot; valem para o período Personalizado.</p>
      </form>
      {result.ok ? (
        <Report storeId={store.id} timeZone={store.timezone} period={result.period} />
      ) : (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {result.message}
        </p>
      )}
    </div>
  );
}

export default function MetricasPage({ searchParams }: PageProps<"/painel/metricas">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Métricas</h1>
      <Suspense fallback={<p>Carregando métricas...</p>}>
        <Metrics searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
