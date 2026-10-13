/** Normaliza telefone para E.164. Sem "+": assume Brasil (DDD + número), aceitando prefixo tronco "0" (ex.: 011). */
export function normalizeBrazilPhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (digits.startsWith("55")) return digits.length === 12 || digits.length === 13 ? `+${digits}` : null;
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  const national = digits.startsWith("0") ? digits.slice(1) : digits;
  if (national.length === 10 || national.length === 11) return `+55${national}`;
  if ((national.length === 12 || national.length === 13) && national.startsWith("55")) return `+${national}`;
  return null;
}
