import { getMenu } from "@/modules/catalog";
import { getDeliveryZones, type Store } from "@/modules/stores";
import { buildOnboardingChecklist, type ChecklistItem } from "./checklist";

export async function getOnboardingChecklist(store: Store): Promise<ChecklistItem[]> {
  const [zones, menu] = await Promise.all([getDeliveryZones(store.id), getMenu(store.id)]);
  return buildOnboardingChecklist({
    logoUrl: store.logoUrl,
    hoursCount: store.hours.length,
    deliveryEnabled: store.features.delivery,
    deliveryFee: store.rules.deliveryFee,
    zonesCount: zones.length,
    pixKey: store.paymentMethods.pixKey,
    productCount: menu.categories.reduce((sum, category) => sum + category.products.length, 0),
  });
}
