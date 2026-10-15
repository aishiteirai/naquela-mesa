import Link from "next/link";
import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOnboardingChecklist } from "@/modules/onboarding";
import { requireStoreAccess } from "@/app/painel/_lib/access";

export async function OnboardingChecklist() {
  const { store } = await requireStoreAccess();
  const items = await getOnboardingChecklist(store);
  const done = items.filter((item) => item.done).length;
  if (done === items.length) return null;

  return (
    <Card role="region" aria-label="Primeiros passos" className="ring-primary/30">
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg font-semibold">
            Primeiros passos ({done} de {items.length})
          </h2>
        </CardTitle>
        <CardDescription>Complete para a loja ficar pronta para receber pedidos.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2">
              {item.done ? (
                <>
                  <CheckCircle2Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground line-through">{item.label}</span>
                </>
              ) : (
                <>
                  <CircleIcon aria-hidden="true" className="size-4" />
                  <Link href={item.href} className="underline underline-offset-4">
                    {item.label}
                  </Link>
                </>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
