import { Suspense } from "react";
import { getCatalogForEditing } from "@/modules/catalog";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { CategoryCard } from "./_components/category-card";
import { NewCategoryForm } from "./_components/new-category-form";

async function CatalogEditor() {
  const { store } = await requireStoreAccess();
  const catalog = await getCatalogForEditing(store.id);

  return (
    <div className="flex flex-col gap-6">
      <NewCategoryForm />
      {catalog.categories.length === 0 && (
        <p className="text-neutral-700 dark:text-neutral-300">Nenhuma categoria ainda. Comece criando uma.</p>
      )}
      {catalog.categories.map((category, index) => (
        <CategoryCard
          key={category.id}
          category={category}
          isFirst={index === 0}
          isLast={index === catalog.categories.length - 1}
        />
      ))}
    </div>
  );
}

export default function CardapioPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Cardápio</h1>
      <Suspense fallback={<p className="text-neutral-700 dark:text-neutral-300">Carregando cardápio...</p>}>
        <CatalogEditor />
      </Suspense>
    </div>
  );
}
