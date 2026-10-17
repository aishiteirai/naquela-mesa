/** "agora", "há N min" ou "há N h", a partir de quando o pedido foi criado. */
export function minutesAgo(createdAt: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)} h`;
}
