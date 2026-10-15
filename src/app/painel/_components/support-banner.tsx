import { Button } from "@/components/ui/button";
import { stopSupportAction } from "@/app/painel/support-actions";

// Âmbar fixo de propósito: o aviso de suporte precisa destoar do painel nos dois modos.
export function SupportBanner({ storeName }: { storeName: string }) {
  return (
    <div role="status" className="bg-amber-100 px-4 py-2 text-sm text-amber-950 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <span>Modo suporte: você está vendo o painel da {storeName}.</span>
        <form action={stopSupportAction}>
          <Button type="submit" size="sm" variant="outline" className="border-amber-900 bg-transparent text-amber-950 hover:bg-amber-200 hover:text-amber-950">
            Sair do modo suporte
          </Button>
        </form>
      </div>
    </div>
  );
}
