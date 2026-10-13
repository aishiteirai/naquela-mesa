export const PERIOD_PRESETS = ["hoje", "7d", "30d", "personalizado"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  personalizado: "Personalizado",
};

export const DEFAULT_PERIOD: PeriodPreset = "7d";
export const MAX_PERIOD_DAYS = 366;

/** `from`/`to`: dias locais inclusivos (YYYY-MM-DD). `start`/`end`: instantes, `end` exclusivo. */
export type Period = { preset: PeriodPreset; from: string; to: string; start: Date; end: Date };
export type PeriodInput = { preset?: string | null; from?: string | null; to?: string | null };
export type PeriodResult = { ok: true; period: Period } | { ok: false; message: string };

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function splitDate(isoDate: string): [number, number, number] {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);
  return [year, month, day];
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = splitDate(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = splitDate(isoDate);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

function zonedParts(instant: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
}

/** Diferença (ms) entre o relógio local do fuso e o UTC naquele instante. */
function offsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - (instant.getTime() - instant.getUTCMilliseconds());
}

export function localDate(now: Date, timeZone: string): string {
  const p = zonedParts(now, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Instante da meia-noite local do dia `isoDate` no fuso (duas passadas cobrem a troca de horário de verão). */
export function zonedMidnight(isoDate: string, timeZone: string): Date {
  const [year, month, day] = splitDate(isoDate);
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

function daySpan(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
}

export function resolvePeriod(input: PeriodInput, timeZone: string, now: Date = new Date()): PeriodResult {
  const preset = (PERIOD_PRESETS as readonly string[]).includes(input.preset ?? "") ? (input.preset as PeriodPreset) : DEFAULT_PERIOD;
  const today = localDate(now, timeZone);
  let from: string;
  let to: string;

  if (preset === "personalizado") {
    from = input.from?.trim() ?? "";
    to = input.to?.trim() ?? "";
    if (!isIsoDate(from) || !isIsoDate(to)) return { ok: false, message: "Informe as datas de início e fim." };
    if (from > to) return { ok: false, message: "A data de início deve ser antes da data de fim." };
    if (daySpan(from, to) > MAX_PERIOD_DAYS) return { ok: false, message: `Escolha um período de até ${MAX_PERIOD_DAYS} dias.` };
  } else {
    to = today;
    from = preset === "hoje" ? today : addDays(today, preset === "7d" ? -6 : -29);
  }

  return {
    ok: true,
    period: { preset, from, to, start: zonedMidnight(from, timeZone), end: zonedMidnight(addDays(to, 1), timeZone) },
  };
}

function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function formatPeriodRange(period: Pick<Period, "from" | "to">): string {
  if (period.from === period.to) return formatIsoDate(period.from);
  return `${formatIsoDate(period.from)} a ${formatIsoDate(period.to)}`;
}
