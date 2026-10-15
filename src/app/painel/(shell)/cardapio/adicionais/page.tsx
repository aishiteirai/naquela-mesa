import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { NewOptionGroupForm } from "./_components/new-option-group-form";
import { OptionGroupCard } from "./_components/option-group-card";

async function OptionGroups() {
  const { store } = await requireStoreAccess();
  const { optionGroups } = await getCatalogForEditing(store.id);

  return (
    <div className="flex flex-col gap-6">
      <NewOptionGroupForm />
      {optionGroups.length === 0 && (
        <p className="text-neutral-700 dark:text-neutral-300">Nenhum grupo de adicionais ainda.</p>
      )}
      {optionGroups.map((group) => (
        <OptionGroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}

export default function AdicionaisPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Adicionais</h1>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        Grupos como &quot;Borda recheada&quot;. Ligue um grupo a um produto no formulário do produto.
      </p>
      <Suspense fallback={<p>Carregando...</p>}>
        <OptionGroups />
      </Suspense>
    </div>
  );
}
