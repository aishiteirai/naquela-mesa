import type { ManualStatus, StoreHour } from "./types";

export type NextOpening = { dayOffset: number; weekday: number; time: string };
export type OpenStatus = { isOpen: boolean; nextOpening: NextOpening | null };

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MINUTES_PER_HOUR = 60;
const DAYS_PER_WEEK = 7;

function toMinutes(hourMinute: string): number {
  const [hour = 0, minute = 0] = hourMinute.split(":").map(Number);
  return hour * MINUTES_PER_HOUR + minute;
}

const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MINUTES_PER_WEEK = DAYS_PER_WEEK * MINUTES_PER_DAY;

function shiftInterval(shift: StoreHour): [number, number] {
  const opens = toMinutes(shift.opensAt);
  const closes = toMinutes(shift.closesAt);
  const duration = closes > opens ? closes - opens : MINUTES_PER_DAY - opens + closes;
  const start = shift.weekday * MINUTES_PER_DAY + opens;
  return [start, start + duration];
}

/** Primeiro par de turnos que se sobrepõe na semana (circular), ou null. */
export function findHourConflict(hours: StoreHour[]): [number, number] | null {
  const intervals = hours.map(shiftInterval);
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const [startA, endA] = intervals[i]!;
      const [startB, endB] = intervals[j]!;
      for (const offset of [-MINUTES_PER_WEEK, 0, MINUTES_PER_WEEK]) {
        if (startA < endB + offset && startB + offset < endA) return [i, j];
      }
    }
  }
  return null;
}

function formatMinutes(minutes: number): string {
  const hour = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, "0");
  const minute = String(minutes % MINUTES_PER_HOUR).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function localClock(now: Date, timeZone: string): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    weekday: WEEKDAY_INDEX[part("weekday")] ?? 0,
    minutes: Number(part("hour")) * MINUTES_PER_HOUR + Number(part("minute")),
  };
}

function isWithinShift(shift: StoreHour, weekday: number, minutes: number): boolean {
  const opens = toMinutes(shift.opensAt);
  const closes = toMinutes(shift.closesAt);

  if (opens < closes) {
    return shift.weekday === weekday && minutes >= opens && minutes < closes;
  }

  // Turno vira a meia-noite: parte da noite no próprio dia + madrugada do dia seguinte.
  const previousWeekday = (weekday + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  return (shift.weekday === weekday && minutes >= opens) || (shift.weekday === previousWeekday && minutes < closes);
}

function findNextOpening(hours: StoreHour[], weekday: number, minutes: number): NextOpening | null {
  for (let dayOffset = 0; dayOffset <= DAYS_PER_WEEK; dayOffset++) {
    const day = (weekday + dayOffset) % DAYS_PER_WEEK;
    const opening = hours
      .filter((shift) => shift.weekday === day)
      .map((shift) => toMinutes(shift.opensAt))
      .filter((opens) => dayOffset > 0 || opens > minutes)
      .sort((a, b) => a - b)[0];

    if (opening !== undefined) return { dayOffset, weekday: day, time: formatMinutes(opening) };
  }
  return null;
}

export function getOpenStatus(input: {
  hours: StoreHour[];
  manualStatus: ManualStatus;
  timeZone: string;
  now: Date;
}): OpenStatus {
  if (input.manualStatus === "force_open") return { isOpen: true, nextOpening: null };
  if (input.manualStatus === "force_closed") return { isOpen: false, nextOpening: null };

  const { weekday, minutes } = localClock(input.now, input.timeZone);
  if (input.hours.some((shift) => isWithinShift(shift, weekday, minutes))) {
    return { isOpen: true, nextOpening: null };
  }
  return { isOpen: false, nextOpening: findNextOpening(input.hours, weekday, minutes) };
}

export function formatOpenStatus(status: OpenStatus): string {
  if (status.isOpen) return "Aberto agora";
  if (!status.nextOpening) return "Fechado no momento";

  const { dayOffset, weekday, time } = status.nextOpening;
  if (dayOffset === 0) return `Abre hoje às ${time}`;
  if (dayOffset === 1) return `Abre amanhã às ${time}`;
  return `Abre ${WEEKDAY_NAMES[weekday]} às ${time}`;
}
