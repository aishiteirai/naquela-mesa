import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { ProductForm } from "@/app/painel/cardapio/_components/product-form";

async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { store } = await requireStoreAccess();
  const catalog = await getCatalogForEditing(store.id);
  const category = catalog.categories.find((item) => item.products.some((product) => product.id === id));
  const product = category?.products.find((item) => item.id === id);
  if (!category || !product) notFound();

  return (
    <ProductForm
      category={{ id: category.id, name: category.name, sizes: category.sizes }}
      optionGroups={catalog.optionGroups.map(({ id: groupId, name }) => ({ id: groupId, name }))}
      product={product}
    />
  );
}

export default function EditProductPage({ params }: PageProps<"/painel/cardapio/produtos/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Editar produto</h1>
      <Suspense fallback={<p>Carregando...</p>}>
        <EditProduct params={params} />
      </Suspense>
    </div>
  );
}
