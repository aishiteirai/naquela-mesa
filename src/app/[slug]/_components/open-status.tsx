import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { formatOpenStatus, getOpenStatus, type Store } from "@/modules/stores";

export async function OpenStatus({ store }: { store: Store }) {
  await connection();
  const status = getOpenStatus({
    hours: store.hours,
    manualStatus: store.manualStatus,
    timeZone: store.timezone,
    now: new Date(),
  });

  return (
    <Badge
      data-testid="open-status"
      variant="secondary"
      className={status.isOpen ? "bg-brand-secondary text-brand-secondary-foreground" : undefined}
    >
      {formatOpenStatus(status)}
    </Badge>
  );
}
