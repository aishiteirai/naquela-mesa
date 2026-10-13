import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { ProductForm } from "@/app/painel/cardapio/_components/product-form";

async function NewProduct({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const { store } = await requireStoreAccess();
  const catalog = await getCatalogForEditing(store.id);
  const category = catalog.categories.find((item) => item.id === categoria);
  if (!category) notFound();

  return (
    <ProductForm
      category={{ id: category.id, name: category.name, sizes: category.sizes }}
      optionGroups={catalog.optionGroups.map(({ id, name }) => ({ id, name }))}
      product={null}
    />
  );
}

export default function NewProductPage({ searchParams }: PageProps<"/painel/cardapio/produtos/novo">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Novo produto</h1>
      <Suspense fallback={<p>Carregando...</p>}>
        <NewProduct searchParams={searchParams as Promise<{ categoria?: string }>} />
      </Suspense>
    </div>
  );
}
