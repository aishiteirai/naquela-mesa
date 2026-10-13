/** Query string pode repetir a chave (`?a=1&a=2`): usa a primeira. */
export function firstParam(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first ?? null;
}
