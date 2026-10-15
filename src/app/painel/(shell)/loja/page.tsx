import { Suspense, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDeliveryZones } from "@/modules/stores";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { HoursEditor } from "./_components/hours-editor";
import { OperationsForm } from "./_components/operations-form";
import { ProfileForm } from "./_components/profile-form";
import { SettingsTabs } from "./_components/settings-tabs";
import { StatusButtons } from "./_components/status-buttons";
import { ZonesEditor } from "./_components/zones-editor";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card role="region" aria-label={title}>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

async function StoreSettings() {
  const { store } = await requireStoreAccess();
  const zones = await getDeliveryZones(store.id);

  return (
    <SettingsTabs
      panels={{
        aparencia: (
          <Section title="Aparência" description="Como a loja aparece no cardápio. A prévia muda enquanto você edita.">
            <ProfileForm
              name={store.name}
              address={store.address}
              whatsappPhone={store.whatsappPhone}
              logoUrl={store.logoUrl}
              bannerUrl={store.bannerUrl}
              primary={store.theme.primary.toLowerCase()}
              secondary={store.theme.secondary.toLowerCase()}
              font={store.theme.font}
            />
          </Section>
        ),
        horarios: (
          <>
            <Section title="Status agora" description="Automático segue os horários abaixo. Abrir/Fechar agora vale até você voltar ao automático.">
              <StatusButtons current={store.manualStatus} />
            </Section>
            <Section title="Horários de funcionamento">
              <HoursEditor initialHours={store.hours} />
            </Section>
          </>
        ),
        pedidos: (
          <>
            <Section title="Entrega, retirada e pagamento">
              <OperationsForm features={store.features} rules={store.rules} paymentMethods={store.paymentMethods} />
            </Section>
            <Section title="Bairros atendidos">
              <ZonesEditor initialZones={zones} />
            </Section>
          </>
        ),
      }}
    />
  );
}

export default function LojaPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Configurações da loja</h1>
      <Suspense fallback={<p className="text-muted-foreground">Carregando...</p>}>
        <StoreSettings />
      </Suspense>
    </div>
  );
}
