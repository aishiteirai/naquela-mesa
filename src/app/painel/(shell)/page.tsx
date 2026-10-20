import { Suspense } from "react";
import { listQueue, type QueueOrder } from "@/modules/orders";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { OrderCard } from "./pedidos/_components/order-card";
import { QueueNoticeProvider } from "./pedidos/_components/queue-notice";
import { QueueControls } from "./pedidos/_components/queue-controls";

const COLUMNS: { title: string; statuses: QueueOrder["status"][] }[] = [
  { title: "Novos", statuses: ["received"] },
  { title: "Em preparo", statuses: ["preparing"] },
  { title: "Prontos e em entrega", statuses: ["ready", "out_for_delivery"] },
  { title: "Finalizados (24 h)", statuses: ["completed", "cancelled"] },
];

async function Queue() {
  const { store } = await requireStoreAccess();
  const orders = await listQueue(store.id);

  return (
    <QueueNoticeProvider>
      <QueueControls />
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnOrders = orders.filter((order) => column.statuses.includes(order.status));
          return (
            <section key={column.title} aria-label={column.title} className="flex flex-col gap-3 rounded-[14px] bg-muted p-3">
              <h2 className="flex items-center gap-2 font-semibold">
                {column.title}
                <span className="rounded-full bg-card px-2 py-px text-xs font-normal tabular-nums">{columnOrders.length}</span>
              </h2>
              {columnOrders.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum pedido.</p>}
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
      <h1 className="text-[26px] font-bold">Pedidos</h1>
      <Suspense fallback={<p className="text-muted-foreground">Carregando pedidos...</p>}>
        <Queue />
      </Suspense>
    </div>
  );
}
