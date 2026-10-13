import { Suspense } from "react";
import { requireSuperAdmin } from "@/modules/auth";
import { SignOutButton } from "./sign-out-button";

async function AdminContent() {
  const admin = await requireSuperAdmin();

  return (
    <>
      <p className="mt-2 text-sm text-neutral-600">Olá, {admin.name}.</p>
      <SignOutButton />
    </>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Painel do super-admin</h1>
      <Suspense fallback={<p className="mt-2 text-sm text-neutral-600">Carregando...</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}
