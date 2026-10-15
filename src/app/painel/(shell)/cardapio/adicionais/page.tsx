import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { NewOptionGroup } from "./_components/new-option-group";
import { OptionGroupCard } from "./_components/option-group-card";

async function OptionGroups() {
  const { store } = await requireStoreAccess();
  const { optionGroups } = await getCatalogForEditing(store.id);

  if (optionGroups.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">Nenhum grupo de adicionais ainda.</p>;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {optionGroups.map((group) => (
        <OptionGroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}

export default function AdicionaisPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Adicionais</h1>
          <p className="text-sm text-muted-foreground">Grupos como &quot;Borda recheada&quot;. Ligue um grupo a um produto no formulário do produto.</p>
        </div>
        <div className="ml-auto">
          <NewOptionGroup />
        </div>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Carregando...</p>}>
        <OptionGroups />
      </Suspense>
    </div>
  );
}
