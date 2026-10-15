import Link from "next/link";
import { CircleCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Placed = { numberLabel: string; trackingPath: string; whatsappUrl: string };

export function OrderPlaced({ placed }: { placed: Placed }) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
        <CircleCheckIcon className="size-8" aria-hidden="true" />
      </span>
      <h2 className="text-2xl font-bold">Pedido {placed.numberLabel} recebido!</h2>
      <p className="text-muted-foreground">Envie o pedido para a loja pelo WhatsApp para agilizar o atendimento.</p>
      <a
        href={placed.whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white"
      >
        Enviar pedido no WhatsApp
      </a>
      <Button asChild variant="outline" className="w-full">
        <Link href={placed.trackingPath}>Acompanhar pedido</Link>
      </Button>
    </section>
  );
}
