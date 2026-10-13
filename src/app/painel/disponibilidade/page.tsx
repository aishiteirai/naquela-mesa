import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { toggleOptionAvailabilityAction, toggleProductAvailabilityAction } from "./actions";

function ToggleRow({
  name,
  available,
  action,
  idField,
  id,
}: {
  name: string;
  available: boolean;
  action: (form: FormData) => Promise<void>;
  idField: "productId" | "optionId";
  id: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className={available ? "" : "text-neutral-700 line-through dark:text-neutral-300"}>{name}</span>
      <form action={action}>
        <input type="hidden" name={idField} value={id} />
        <input type="hidden" name="available" value={available ? "false" : "true"} />
        <button
          type="submit"
          aria-label={available ? `Marcar ${name} como esgotado` : `Marcar ${name} como disponível`}
          className={
            available
              ? "min-w-40 rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white"
              : "min-w-40 rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white"
          }
        >
          {available ? "Marcar esgotado" : "Marcar disponível"}
        </button>
      </form>
    </li>
  );
}

async function AvailabilityLists() {
  const { store } = await requireStoreAccess();
  const catalog = await getCatalogForEditing(store.id);

  return (
    <div className="flex flex-col gap-8">
      {catalog.categories
        .filter((category) => category.active)
        .map((category) => (
          <section key={category.id} aria-label={category.name}>
            <h2 className="mb-2 text-lg font-semibold">{category.name}</h2>
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {category.products
                .filter((product) => product.active)
                .map((product) => (
                  <ToggleRow
                    key={product.id}
                    name={product.name}
                    available={product.available}
                    action={toggleProductAvailabilityAction}
                    idField="productId"
                    id={product.id}
                  />
                ))}
            </ul>
          </section>
        ))}
      {catalog.optionGroups.map((group) => (
        <section key={group.id} aria-label={group.name}>
          <h2 className="mb-2 text-lg font-semibold">{group.name}</h2>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {group.options.map((option) => (
              <ToggleRow
                key={option.id}
                name={option.name}
                available={option.available}
                action={toggleOptionAvailabilityAction}
                idField="optionId"
                id={option.id}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function DisponibilidadePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Disponibilidade</h1>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">Acabou algum item? Marque aqui e o cardápio atualiza na hora.</p>
      <Suspense fallback={<p>Carregando...</p>}>
        <AvailabilityLists />
      </Suspense>
    </div>
  );
}
