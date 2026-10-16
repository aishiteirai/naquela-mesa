import { getOnboardingChecklist } from "@/modules/onboarding";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { FloatingChecklist } from "@/app/painel/_components/floating-checklist";

export async function OnboardingChecklist() {
  const { store, user } = await requireStoreAccess();
  const items = await getOnboardingChecklist(store);
  return <FloatingChecklist sessionId={user.sessionId} items={items} />;
}
