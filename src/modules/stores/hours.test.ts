import { describe, expect, it } from "vitest";
import { formatOpenStatus, getOpenStatus, localClock } from "./hours";
import type { StoreHour } from "./types";

const timeZone = "America/Sao_Paulo";

const hours: StoreHour[] = [
  { weekday: 2, opensAt: "11:00", closesAt: "14:00" },
  { weekday: 2, opensAt: "18:00", closesAt: "23:00" },
  { weekday: 5, opensAt: "18:00", closesAt: "23:30" },
  { weekday: 6, opensAt: "18:00", closesAt: "00:30" },
];

function statusAt(isoUtc: string, manualStatus: "auto" | "force_open" | "force_closed" = "auto") {
  return getOpenStatus({ hours, manualStatus, timeZone, now: new Date(isoUtc) });
}

describe("localClock", () => {
  it("converte o instante para dia e minutos no fuso da loja", () => {
    const instant = new Date("2026-10-17T02:30:00Z");
    expect(localClock(instant, timeZone)).toEqual({ weekday: 5, minutes: 23 * 60 + 30 });
    expect(localClock(instant, "UTC")).toEqual({ weekday: 6, minutes: 2 * 60 + 30 });
  });

  it("meia-noite vira minuto 0", () => {
    expect(localClock(new Date("2026-10-18T03:00:00Z"), timeZone)).toEqual({ weekday: 0, minutes: 0 });
  });
});

describe("getOpenStatus", () => {
  it("aberto dentro do turno (sexta 19:00)", () => {
    expect(statusAt("2026-10-16T22:00:00Z")).toEqual({ isOpen: true, nextOpening: null });
  });

  it("fechamento é exclusivo: sexta 23:30 fechado, próxima abertura amanhã 18:00", () => {
    expect(statusAt("2026-10-17T02:30:00Z")).toEqual({
      isOpen: false,
      nextOpening: { dayOffset: 1, weekday: 6, time: "18:00" },
    });
  });

  it("turno que vira a meia-noite: domingo 00:15 ainda aberto pelo turno de sábado", () => {
    expect(statusAt("2026-10-18T03:15:00Z").isOpen).toBe(true);
  });

  it("turno que vira a meia-noite: domingo 00:30 fechado, próxima abertura terça 11:00", () => {
    expect(statusAt("2026-10-18T03:30:00Z")).toEqual({
      isOpen: false,
      nextOpening: { dayOffset: 2, weekday: 2, time: "11:00" },
    });
  });

  it("entre dois turnos do mesmo dia: terça 15:00 abre hoje 18:00", () => {
    expect(statusAt("2026-10-13T18:00:00Z").nextOpening).toEqual({ dayOffset: 0, weekday: 2, time: "18:00" });
  });

  it("antes do primeiro turno: terça 10:00 abre hoje 11:00", () => {
    expect(statusAt("2026-10-13T13:00:00Z").nextOpening).toEqual({ dayOffset: 0, weekday: 2, time: "11:00" });
  });

  it("depois do último turno da semana volta para o mesmo dia da semana seguinte", () => {
    const onlyTuesday: StoreHour[] = [{ weekday: 2, opensAt: "11:00", closesAt: "14:00" }];
    const status = getOpenStatus({ hours: onlyTuesday, manualStatus: "auto", timeZone, now: new Date("2026-10-13T20:00:00Z") });
    expect(status.nextOpening).toEqual({ dayOffset: 7, weekday: 2, time: "11:00" });
  });

  it("force_open abre mesmo fora do horário (segunda)", () => {
    expect(statusAt("2026-10-12T22:00:00Z", "force_open")).toEqual({ isOpen: true, nextOpening: null });
  });

  it("force_closed fecha mesmo dentro do horário", () => {
    expect(statusAt("2026-10-16T22:00:00Z", "force_closed")).toEqual({ isOpen: false, nextOpening: null });
  });

  it("sem horários cadastrados: fechado sem próxima abertura", () => {
    expect(getOpenStatus({ hours: [], manualStatus: "auto", timeZone, now: new Date("2026-10-16T22:00:00Z") })).toEqual({
      isOpen: false,
      nextOpening: null,
    });
  });
});

describe("formatOpenStatus", () => {
  it.each([
    [{ isOpen: true, nextOpening: null }, "Aberto agora"],
    [{ isOpen: false, nextOpening: null }, "Fechado no momento"],
    [{ isOpen: false, nextOpening: { dayOffset: 0, weekday: 2, time: "18:00" } }, "Abre hoje às 18:00"],
    [{ isOpen: false, nextOpening: { dayOffset: 1, weekday: 6, time: "18:00" } }, "Abre amanhã às 18:00"],
    [{ isOpen: false, nextOpening: { dayOffset: 2, weekday: 2, time: "11:00" } }, "Abre terça às 11:00"],
    [{ isOpen: false, nextOpening: { dayOffset: 7, weekday: 0, time: "11:00" } }, "Abre domingo às 11:00"],
  ])("%o → %s", (status, text) => {
    expect(formatOpenStatus(status)).toBe(text);
  });
});
