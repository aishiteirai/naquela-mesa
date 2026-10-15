import { CheckIcon, XCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { statusLabel, timelineFor, type Fulfillment, type OrderStatus } from "@/modules/orders";

export function OrderTimeline({ fulfillment, status }: { fulfillment: Fulfillment; status: OrderStatus }) {
  const steps = timelineFor(fulfillment, status);

  if (!steps) {
    return (
      <Alert variant="destructive">
        <XCircleIcon />
        <AlertTitle>Pedido cancelado</AlertTitle>
        <AlertDescription>Fale com a loja pelo WhatsApp se tiver dúvidas.</AlertDescription>
      </Alert>
    );
  }

  return (
    <ol className="flex flex-col rounded-xl border bg-card p-4">
      {steps.map((step, index) => (
        <li key={step.status} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border-2",
                step.state === "done" && "border-primary bg-primary text-primary-foreground",
                step.state === "current" && "border-primary bg-background",
                step.state === "upcoming" && "border-muted bg-background",
              )}
            >
              {step.state === "done" ? (
                <CheckIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <span className={cn("size-2 rounded-full", step.state === "current" ? "bg-primary" : "bg-muted")} />
              )}
            </span>
            {index < steps.length - 1 && <span className={cn("min-h-6 w-0.5 flex-1", step.state === "done" ? "bg-primary" : "bg-muted")} />}
          </div>
          <p
            className={cn(
              "pb-4 text-sm",
              step.state === "current" && "font-semibold text-foreground",
              step.state === "done" && "text-foreground",
              step.state === "upcoming" && "text-muted-foreground",
            )}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            {statusLabel(step.status, fulfillment)}
          </p>
        </li>
      ))}
    </ol>
  );
}
