export const CHECKLIST_DISMISS_KEY = "primeiros-passos-fechado";

/** "Primeiros passos" volta a aparecer em toda sessão nova enquanto houver pendências. */
export function shouldShowChecklist(input: { sessionId: string; dismissedFor: string | null; pending: number }): boolean {
  if (input.pending === 0) return false;
  return input.dismissedFor !== input.sessionId;
}
