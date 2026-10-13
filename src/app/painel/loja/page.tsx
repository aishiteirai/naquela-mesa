import { Suspense } from "react";
import { getDeliveryZones } from "@/modules/stores";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { HoursEditor } from "./_components/hours-editor";
import { OperationsForm } from "./_components/operations-form";
import { ProfileForm } from "./_components/profile-form";
import { StatusButtons } from "./_components/status-buttons";
import { ZonesEditor } from "./_components/zones-editor";

const sectionClass = "flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800";

async function StoreSettings() {
  const { store } = await requireStoreAccess();
  const zones = await getDeliveryZones(store.id);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Aparência" className={sectionClass}>
        <h2 className="text-lg font-semibold">Aparência</h2>
        <ProfileForm
          name={store.name}
          address={store.address}
          whatsappPhone={store.whatsappPhone}
          logoUrl={store.logoUrl}
          bannerUrl={store.bannerUrl}
          primary={store.theme.primary.toLowerCase()}
          secondary={store.theme.secondary.toLowerCase()}
        />
      </section>

      <section aria-label="Funcionamento" className={sectionClass}>
        <h2 className="text-lg font-semibold">Funcionamento</h2>
        <StatusButtons current={store.manualStatus} />
        <HoursEditor initialHours={store.hours} />
      </section>

      <section aria-label="Entrega, retirada e pagamento" className={sectionClass}>
        <h2 className="text-lg font-semibold">Entrega, retirada e pagamento</h2>
        <OperationsForm features={store.features} rules={store.rules} paymentMethods={store.paymentMethods} />
      </section>

      <section aria-label="Bairros atendidos" className={sectionClass}>
        <h2 className="text-lg font-semibold">Bairros atendidos</h2>
        <ZonesEditor initialZones={zones} />
      </section>
    </div>
  );
}

export default function LojaPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Configurações da loja</h1>
      <Suspense fallback={<p>Carregando...</p>}>
        <StoreSettings />
      </Suspense>
    </div>
  );
}
