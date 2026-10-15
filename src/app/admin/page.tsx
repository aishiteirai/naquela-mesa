import { Suspense } from "react";
import { AUDIT_LABELS, listAuditLogs } from "@/modules/audit";
import { requireSuperAdmin } from "@/modules/auth";
import { STORE_TEMPLATES, TEMPLATE_LABELS } from "@/modules/onboarding";
import { listStoresForAdmin } from "@/modules/stores";
import { SignOutButton } from "@/app/_components/sign-out-button";
import { ModeToggle } from "@/components/mode-toggle";
import { secondaryButtonClass } from "@/app/_components/styles";
import { startSupportAction } from "./actions";
import { CreateStoreForm } from "./_components/create-store-form";
import { NewLinkForm } from "./_components/new-link-form";

const TIME_ZONE = "America/Sao_Paulo";
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });
const sectionClass = "flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800";

async function AdminContent() {
  const admin = await requireSuperAdmin();
  const [stores, logs] = await Promise.all([listStoresForAdmin(), listAuditLogs(20)]);
  const templates = STORE_TEMPLATES.map((value) => ({ value, label: TEMPLATE_LABELS[value] }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">Olá, {admin.name}.</p>
        <ModeToggle />
        <SignOutButton />
      </div>

      <section aria-label="Nova loja" className={sectionClass}>
        <h2 className="text-lg font-semibold">Nova loja</h2>
        <CreateStoreForm templates={templates} />
      </section>

      <section aria-label="Lojas" className={sectionClass}>
        <h2 className="text-lg font-semibold">Lojas</h2>
        {stores.length === 0 ? (
          <p className="text-sm">Nenhuma loja ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="py-2 pr-3">Loja</th>
                  <th className="py-2 pr-3">Endereço</th>
                  <th className="py-2 pr-3">Dono</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => {
                  const linkEmail = store.ownerEmail ?? store.pendingInvite?.email ?? null;
                  return (
                    <tr key={store.id} className="border-b border-neutral-200 align-top dark:border-neutral-800">
                      <td className="py-2 pr-3 font-medium">{store.name}</td>
                      <td className="py-2 pr-3">
                        <a href={`/${store.slug}`} target="_blank" rel="noreferrer" className="underline">
                          /{store.slug}
                        </a>
                      </td>
                      <td className="py-2 pr-3">
                        {store.ownerEmail ??
                          (store.pendingInvite
                            ? `Convite pendente: ${store.pendingInvite.email} (até ${dayMonth.format(store.pendingInvite.expiresAt)})`
                            : "Sem dono")}
                      </td>
                      <td className="flex flex-col gap-2 py-2">
                        <form action={startSupportAction}>
                          <input type="hidden" name="storeId" value={store.id} />
                          <button type="submit" disabled={!store.ownerEmail} className={secondaryButtonClass}>
                            Acessar como loja
                          </button>
                        </form>
                        <NewLinkForm storeId={store.id} email={linkEmail} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Registro de suporte" className={sectionClass}>
        <h2 className="text-lg font-semibold">Registro de suporte</h2>
        {logs.length === 0 ? (
          <p className="text-sm">Nenhum registro ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {logs.map((log) => (
              <li key={log.id}>
                <span className="tabular-nums">{dateTime.format(log.createdAt)}</span> · {AUDIT_LABELS[log.action]}
                {log.details.storeName ? ` · ${log.details.storeName}` : ""}
                {log.details.actorEmail ? ` · por ${log.details.actorEmail}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Painel do super-admin</h1>
      <Suspense fallback={<p className="text-sm text-neutral-700 dark:text-neutral-300">Carregando...</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}
