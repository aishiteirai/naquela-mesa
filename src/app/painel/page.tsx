import { Suspense } from "react";
import { getQueueVersion, listQueue, type QueueOrder } from "@/modules/orders";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { OrderCard } from "./pedidos/_components/order-card";
import { QueueNoticeProvider } from "./pedidos/_components/queue-notice";
import { QueuePoller } from "./pedidos/_components/queue-poller";

const COLUMNS: { title: string; statuses: QueueOrder["status"][] }[] = [
  { title: "Novos", statuses: ["received"] },
  { title: "Em preparo", statuses: ["preparing"] },
  { title: "Prontos e em entrega", statuses: ["ready", "out_for_delivery"] },
  { title: "Finalizados (24 h)", statuses: ["completed", "cancelled"] },
];

async function Queue() {
  const { store } = await requireStoreAccess();
  // Versão ANTES da lista: pedido que chegar entre as duas leituras dispara alerta no próximo poll.
  const version = await getQueueVersion(store.id);
  const orders = await listQueue(store.id);

  return (
    <QueueNoticeProvider>
      <QueuePoller initialVersion={version.version} initialReceived={version.received} initialTotal={version.total} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnOrders = orders.filter((order) => column.statuses.includes(order.status));
          return (
            <section key={column.title} aria-label={column.title} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">
                {column.title} <span className="text-neutral-700 dark:text-neutral-300">({columnOrders.length})</span>
              </h2>
              {columnOrders.length === 0 && <p className="text-sm text-neutral-700 dark:text-neutral-300">Nenhum pedido.</p>}
              {columnOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  storeName={store.name}
                  storeSlug={store.slug}
                  timezone={store.timezone}
                  autoPrintOnAccept={store.rules.autoPrintOnAccept}
                />
              ))}
            </section>
          );
        })}
      </div>
    </QueueNoticeProvider>
  );
}

export default function PedidosPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Pedidos</h1>
      <Suspense fallback={<p>Carregando pedidos...</p>}>
        <Queue />
      </Suspense>
    </div>
  );
}
