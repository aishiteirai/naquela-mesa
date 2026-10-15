import Link from "next/link";
import { Suspense } from "react";
import { listOrderHistory, ORDER_STATUSES, resolvePeriod, statusLabel, type OrderStatus, type Period } from "@/modules/orders";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/app/painel/_components/native-select";
import { PeriodFields } from "@/app/painel/_components/period-fields";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { firstParam } from "@/app/painel/_lib/search-params";
import { HistoryList } from "./_components/history-list";

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
  const whenFormat = new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "short", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{history.total === 1 ? "1 pedido" : `${history.total} pedidos`}</p>
      {history.orders.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">Nenhum pedido encontrado.</p>
      ) : (
        <HistoryList rows={history.orders.map((order) => ({ order, when: whenFormat.format(new Date(order.createdAt)) }))} />
      )}
      {history.pageCount > 1 && (
        <nav aria-label="Paginação" className="flex items-center gap-3 text-sm">
          {history.page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(period, query, history.page - 1)}>Anterior</Link>
            </Button>
          )}
          <span className="text-muted-foreground">
            Página {history.page} de {history.pageCount}
          </span>
          {history.page < history.pageCount && (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(period, query, history.page + 1)}>Próxima</Link>
            </Button>
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
      <form aria-label="Filtros" className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
        <PeriodFields
          preset={result.ok ? result.period.preset : "personalizado"}
          from={result.ok ? result.period.from : (input.from ?? "")}
          to={result.ok ? result.period.to : (input.to ?? "")}
        />
        <Field className="w-auto">
          <FieldLabel htmlFor="filtro-status">Status</FieldLabel>
          <NativeSelect id="filtro-status" name="status" defaultValue={query.status ?? ""}>
            <option value="">Todos</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status, "delivery")}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field className="w-auto">
          <FieldLabel htmlFor="filtro-busca">Buscar</FieldLabel>
          <Input id="filtro-busca" type="search" name="q" defaultValue={query.search ?? ""} placeholder="Nº, nome ou telefone" maxLength={80} />
        </Field>
        <Button type="submit">Filtrar</Button>
      </form>
      {result.ok ? (
        <Results storeId={store.id} timeZone={store.timezone} period={result.period} query={query} requestedPage={requestedPage} />
      ) : (
        <p role="alert" className="text-sm text-destructive">
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
      <Suspense fallback={<p className="text-muted-foreground">Carregando pedidos...</p>}>
        <History searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
