import { describe, expect, it } from "vitest";
import { findHourConflict, formatOpenStatus, formatStoreStatus, getOpenStatus, localClock } from "./hours";
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
    expect(statusAt("2026-10-16T22:00:00Z")).toEqual({ isOpen: true, nextOpening: null, closesAt: "23:30" });
  });

  it("fechamento é exclusivo: sexta 23:30 fechado, próxima abertura amanhã 18:00", () => {
    expect(statusAt("2026-10-17T02:30:00Z")).toEqual({
      isOpen: false,
      nextOpening: { dayOffset: 1, weekday: 6, time: "18:00" },
      closesAt: null,
    });
  });

  it("turno que vira a meia-noite informa 00:30 antes e depois da meia-noite", () => {
    // sábado 23:00 em São Paulo = domingo 02:00Z
    expect(statusAt("2026-10-18T02:00:00Z").closesAt).toBe("00:30");
    // domingo 00:10 em São Paulo = domingo 03:10Z
    expect(statusAt("2026-10-18T03:10:00Z").closesAt).toBe("00:30");
  });

  it("manual não tem horário de fechamento", () => {
    expect(statusAt("2026-10-12T22:00:00Z", "force_open")).toEqual({ isOpen: true, nextOpening: null, closesAt: null });
    expect(statusAt("2026-10-16T22:00:00Z", "force_closed")).toEqual({ isOpen: false, nextOpening: null, closesAt: null });
  });

  it("turno que vira a meia-noite: domingo 00:15 ainda aberto pelo turno de sábado", () => {
    expect(statusAt("2026-10-18T03:15:00Z").isOpen).toBe(true);
  });

  it("turno que vira a meia-noite: domingo 00:30 fechado, próxima abertura terça 11:00", () => {
    expect(statusAt("2026-10-18T03:30:00Z")).toEqual({
      isOpen: false,
      nextOpening: { dayOffset: 2, weekday: 2, time: "11:00" },
      closesAt: null,
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
    expect(statusAt("2026-10-12T22:00:00Z", "force_open")).toEqual({ isOpen: true, nextOpening: null, closesAt: null });
  });

  it("force_closed fecha mesmo dentro do horário", () => {
    expect(statusAt("2026-10-16T22:00:00Z", "force_closed")).toEqual({ isOpen: false, nextOpening: null, closesAt: null });
  });

  it("turno 18:00–00:00 fecha exatamente à meia-noite", () => {
    const toMidnight: StoreHour[] = [{ weekday: 2, opensAt: "18:00", closesAt: "00:00" }];
    const at = (iso: string) => getOpenStatus({ hours: toMidnight, manualStatus: "auto", timeZone, now: new Date(iso) }).isOpen;
    expect(at("2026-10-14T02:59:00Z")).toBe(true); // terça 23:59
    expect(at("2026-10-14T03:00:00Z")).toBe(false); // quarta 00:00
  });

  it("turno de domingo que vira para segunda", () => {
    const sunday: StoreHour[] = [{ weekday: 0, opensAt: "18:00", closesAt: "01:00" }];
    const at = (iso: string) => getOpenStatus({ hours: sunday, manualStatus: "auto", timeZone, now: new Date(iso) }).isOpen;
    expect(at("2026-10-19T03:30:00Z")).toBe(true); // segunda 00:30
    expect(at("2026-10-19T04:00:00Z")).toBe(false); // segunda 01:00
  });

  it("sem horários cadastrados: fechado sem próxima abertura", () => {
    expect(getOpenStatus({ hours: [], manualStatus: "auto", timeZone, now: new Date("2026-10-16T22:00:00Z") })).toEqual({
      isOpen: false,
      nextOpening: null,
      closesAt: null,
    });
  });
});

describe("formatStoreStatus", () => {
  it("aberto no automático mostra o fechamento", () => {
    expect(formatStoreStatus({ isOpen: true, nextOpening: null, closesAt: "23:30" }, "auto")).toBe("Aberto · fecha às 23:30");
  });

  it("fechado no automático mostra a próxima abertura", () => {
    expect(formatStoreStatus({ isOpen: false, nextOpening: { dayOffset: 0, weekday: 5, time: "18:00" }, closesAt: null }, "auto")).toBe(
      "Fechado · abre hoje às 18:00",
    );
  });

  it("fechado sem próxima abertura", () => {
    expect(formatStoreStatus({ isOpen: false, nextOpening: null, closesAt: null }, "auto")).toBe("Fechado");
  });

  it("manual", () => {
    expect(formatStoreStatus({ isOpen: true, nextOpening: null, closesAt: null }, "force_open")).toBe("Aberto agora (manual)");
    expect(formatStoreStatus({ isOpen: false, nextOpening: null, closesAt: null }, "force_closed")).toBe("Fechado agora (manual)");
  });
});

describe("formatOpenStatus", () => {
  it.each([
    [{ isOpen: true, nextOpening: null, closesAt: null }, "Aberto agora"],
    [{ isOpen: false, nextOpening: null, closesAt: null }, "Fechado no momento"],
    [{ isOpen: false, nextOpening: { dayOffset: 0, weekday: 2, time: "18:00" }, closesAt: null }, "Abre hoje às 18:00"],
    [{ isOpen: false, nextOpening: { dayOffset: 1, weekday: 6, time: "18:00" }, closesAt: null }, "Abre amanhã às 18:00"],
    [{ isOpen: false, nextOpening: { dayOffset: 2, weekday: 2, time: "11:00" }, closesAt: null }, "Abre terça às 11:00"],
    [{ isOpen: false, nextOpening: { dayOffset: 7, weekday: 0, time: "11:00" }, closesAt: null }, "Abre domingo às 11:00"],
  ])("%o → %s", (status, text) => {
    expect(formatOpenStatus(status)).toBe(text);
  });
});

describe("findHourConflict", () => {
  const shift = (weekday: number, opensAt: string, closesAt: string): StoreHour => ({ weekday, opensAt, closesAt });

  it.each([
    ["mesmo dia sobreposto", [shift(2, "18:00", "23:00"), shift(2, "22:00", "23:30")]],
    ["turno duplicado", [shift(1, "18:00", "23:00"), shift(1, "18:00", "23:00")]],
    ["madrugada de sexta para sábado", [shift(5, "18:00", "02:00"), shift(6, "01:00", "03:00")]],
    ["sábado para domingo (virada da semana)", [shift(6, "23:00", "02:00"), shift(0, "01:00", "03:00")]],
  ])("conflito: %s", (_label, hours) => {
    expect(findHourConflict(hours)).toEqual([0, 1]);
  });

  it.each([
    ["turnos que só se encostam", [shift(6, "18:00", "00:30"), shift(0, "00:30", "02:00")]],
    ["almoço e jantar", [shift(2, "11:00", "14:00"), shift(2, "18:00", "23:00")]],
    ["dias diferentes", [shift(1, "18:00", "23:00"), shift(3, "18:00", "23:00")]],
    ["vazio", []],
  ])("sem conflito: %s", (_label, hours) => {
    expect(findHourConflict(hours)).toBeNull();
  });
});
