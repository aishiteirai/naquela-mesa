import Link from "next/link";
import { Suspense } from "react";
import { listOrderHistory, ORDER_STATUSES, resolvePeriod, statusLabel, type OrderStatus, type Period } from "@/modules/orders";
import { inputClass, secondaryButtonClass } from "@/app/_components/styles";
import { PeriodFields } from "@/app/painel/_components/period-fields";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { firstParam } from "@/app/painel/_lib/search-params";
import { HistoryItem } from "./_components/history-item";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Query = { status: OrderStatus | null; search: string | null };

function parseStatus(value: string | null): OrderStatus | null {
  return (ORDER_STATUSES as readonly string[]).includes(value ?? "") ? (value as OrderStatus) : null;
}

function pageHref(period: Period, query: Query, page: number): string {
  const params = new URLSearchParams({ periodo: period.preset, de: period.from, ate: period.to });
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("q", query.search);
  params.set("pagina", String(page));
  return `/painel/pedidos?${params.toString()}`;
}

async function Results({
  storeId,
  timeZone,
  period,
  query,
  requestedPage,
}: {
  storeId: string;
  timeZone: string;
  period: Period;
  query: Query;
  requestedPage: number;
}) {
  const history = await listOrderHistory(storeId, { start: period.start, end: period.end, ...query, page: requestedPage });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {history.total === 1 ? "1 pedido" : `${history.total} pedidos`}
      </p>
      {history.orders.length === 0 ? (
        <p>Nenhum pedido encontrado.</p>
      ) : (
        history.orders.map((order) => <HistoryItem key={order.id} order={order} timeZone={timeZone} />)
      )}
      {history.pageCount > 1 && (
        <nav aria-label="Paginação" className="flex items-center gap-3 text-sm">
          {history.page > 1 && (
            <Link href={pageHref(period, query, history.page - 1)} className="underline">
              Anterior
            </Link>
          )}
          <span>
            Página {history.page} de {history.pageCount}
          </span>
          {history.page < history.pageCount && (
            <Link href={pageHref(period, query, history.page + 1)} className="underline">
              Próxima
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

async function History({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { store } = await requireStoreAccess();
  const input = { preset: firstParam(params.periodo), from: firstParam(params.de), to: firstParam(params.ate) };
  const query: Query = {
    status: parseStatus(firstParam(params.status)),
    search: firstParam(params.q)?.trim().slice(0, 80) || null,
  };
  const requestedPage = Number(firstParam(params.pagina) ?? "1");
  const result = resolvePeriod(input, store.timezone);

  return (
    <div className="flex flex-col gap-6">
      <form aria-label="Filtros" className="flex flex-wrap items-end gap-3">
        <PeriodFields
          preset={result.ok ? result.period.preset : "personalizado"}
          from={result.ok ? result.period.from : (input.from ?? "")}
          to={result.ok ? result.period.to : (input.to ?? "")}
        />
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select name="status" defaultValue={query.status ?? ""} className={inputClass}>
            <option value="">Todos</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status, "delivery")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Buscar
          <input type="search" name="q" defaultValue={query.search ?? ""} placeholder="Nº, nome ou telefone" maxLength={80} className={inputClass} />
        </label>
        <button type="submit" className={secondaryButtonClass}>
          Filtrar
        </button>
      </form>
      {result.ok ? (
        <Results storeId={store.id} timeZone={store.timezone} period={result.period} query={query} requestedPage={requestedPage} />
      ) : (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {result.message}
        </p>
      )}
    </div>
  );
}

export default function HistoricoPage({ searchParams }: PageProps<"/painel/pedidos">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Histórico de pedidos</h1>
      <Suspense fallback={<p>Carregando pedidos...</p>}>
        <History searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
