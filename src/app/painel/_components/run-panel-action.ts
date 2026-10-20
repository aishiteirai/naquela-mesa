import { toast } from "sonner";
import { connectionErrorState, type ActionState } from "@/app/_lib/action-state";

/** Para ações sem formulário (mover, remover, status): erro vira toast; falha de rede também. */
export async function runPanelAction(call: () => Promise<ActionState>): Promise<ActionState> {
  let state: ActionState;
  try {
    state = await call();
  } catch {
    state = connectionErrorState();
  }
  if (state.status === "error") toast.error(state.message);
  return state;
}
