import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { MenuEditor } from "./_components/menu-editor";

async function CatalogEditor() {
  const { store } = await requireStoreAccess();
  const catalog = await getCatalogForEditing(store.id);
  return <MenuEditor catalog={catalog} />;
}

export default function CardapioPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Cardápio</h1>
        <p className="text-sm text-muted-foreground">Clique num produto para editar. A chave marca o que acabou: o cardápio atualiza na hora.</p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Carregando cardápio...</p>}>
        <CatalogEditor />
      </Suspense>
    </div>
  );
}
