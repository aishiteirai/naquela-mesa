export type MoveDirection = "up" | "down";

/** Nova ordem com o item trocado de lugar com o vizinho; null se não há para onde mover. */
export function swapOrder(ids: string[], id: string, direction: MoveDirection): string[] | null {
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return null;

  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
