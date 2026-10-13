import { stopSupportAction } from "@/app/painel/support-actions";

export function SupportBanner({ storeName }: { storeName: string }) {
  return (
    <div role="status" className="bg-amber-100 px-4 py-2 text-sm text-amber-950 print:hidden">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
        <span>Modo suporte: você está vendo o painel da {storeName}.</span>
        <form action={stopSupportAction}>
          <button type="submit" className="rounded border border-amber-900 px-3 py-1 font-medium">
            Sair do modo suporte
          </button>
        </form>
      </div>
    </div>
  );
}
