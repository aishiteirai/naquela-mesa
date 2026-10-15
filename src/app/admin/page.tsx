import { Suspense, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModeToggle } from "@/components/mode-toggle";
import { AUDIT_LABELS, listAuditLogs } from "@/modules/audit";
import { requireSuperAdmin } from "@/modules/auth";
import { STORE_TEMPLATES, TEMPLATE_LABELS } from "@/modules/onboarding";
import { listStoresForAdmin } from "@/modules/stores";
import { SignOutButton } from "@/app/_components/sign-out-button";
import { startSupportAction } from "./actions";
import { CreateStoreForm } from "./_components/create-store-form";
import { NewLinkDialog } from "./_components/new-link-dialog";

const TIME_ZONE = "America/Sao_Paulo";
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });

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

async function AdminHeaderActions() {
  const admin = await requireSuperAdmin();
  return (
    <div className="flex items-center gap-2">
      <p className="hidden text-sm text-muted-foreground sm:block">Olá, {admin.name}.</p>
      <ModeToggle />
      <SignOutButton />
    </div>
  );
}

async function AdminContent() {
  await requireSuperAdmin();
  const [stores, logs] = await Promise.all([listStoresForAdmin(), listAuditLogs(20)]);
  const templates = STORE_TEMPLATES.map((value) => ({ value, label: TEMPLATE_LABELS[value] }));

  return (
    <div className="flex flex-col gap-6">
      <Section title="Nova loja" description="Cria a loja a partir de um modelo de cardápio e gera o link de acesso do dono.">
        <CreateStoreForm templates={templates} />
      </Section>

      <Section title="Lojas">
        {stores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma loja ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Dono</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => {
                  const linkEmail = store.ownerEmail ?? store.pendingInvite?.email ?? null;
                  return (
                    <TableRow key={store.id}>
                      <TableCell className="font-medium">{store.name}</TableCell>
                      <TableCell>
                        <a href={`/${store.slug}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                          /{store.slug}
                        </a>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {store.ownerEmail ?? (
                          store.pendingInvite ? (
                            <span className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary">Convite pendente</Badge>
                              {store.pendingInvite.email} (até {dayMonth.format(store.pendingInvite.expiresAt)})
                            </span>
                          ) : (
                            <Badge variant="outline">Sem dono</Badge>
                          )
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <form action={startSupportAction}>
                            <input type="hidden" name="storeId" value={store.id} />
                            <Button type="submit" size="sm" disabled={!store.ownerEmail}>
                              Acessar como loja
                            </Button>
                          </form>
                          <NewLinkDialog storeId={store.id} storeName={store.name} email={linkEmail} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section title="Registro de suporte" description="Últimos 20 eventos.">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {logs.map((log) => (
              <li key={log.id} className="py-2">
                <span className="text-muted-foreground tabular-nums">{dateTime.format(log.createdAt)}</span> · {AUDIT_LABELS[log.action]}
                {log.details.storeName ? ` · ${log.details.storeName}` : ""}
                {log.details.actorEmail ? ` · por ${log.details.actorEmail}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <h1 className="font-semibold">Painel do super-admin</h1>
          <div className="ml-auto">
            <Suspense fallback={null}>
              <AdminHeaderActions />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando...</p>}>
          <AdminContent />
        </Suspense>
      </main>
    </div>
  );
}
