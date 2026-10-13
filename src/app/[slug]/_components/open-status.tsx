import { connection } from "next/server";
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
    <span
      data-testid="open-status"
      className={
        status.isOpen
          ? "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-900"
          : "rounded-full bg-neutral-200 px-3 py-1 text-sm font-medium text-neutral-900"
      }
    >
      {formatOpenStatus(status)}
    </span>
  );
}
