import Link from "next/link";
import { getOnboardingChecklist } from "@/modules/onboarding";
import { requireStoreAccess } from "@/app/painel/_lib/access";

export async function OnboardingChecklist() {
  const { store } = await requireStoreAccess();
  const items = await getOnboardingChecklist(store);
  const done = items.filter((item) => item.done).length;
  if (done === items.length) return null;

  return (
    <section aria-label="Primeiros passos" className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50">
      <h2 className="text-lg font-semibold">
        Primeiros passos ({done} de {items.length})
      </h2>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.key}>
            {item.done ? (
              <span className="text-amber-900/70 line-through dark:text-amber-100/70">✓ {item.label}</span>
            ) : (
              <Link href={item.href} className="underline">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
