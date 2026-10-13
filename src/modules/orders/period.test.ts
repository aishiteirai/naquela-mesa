import { describe, expect, it } from "vitest";
import { addDays, formatPeriodRange, localDate, resolvePeriod, zonedMidnight } from "./period";

const SP = "America/Sao_Paulo";
// 13/10/2026 23:30 em São Paulo (UTC-3).
const NOW = new Date("2026-10-14T02:30:00Z");

describe("datas no fuso da loja", () => {
  it("localDate usa o dia local, não o UTC", () => {
    expect(localDate(NOW, SP)).toBe("2026-10-13");
    expect(localDate(NOW, "UTC")).toBe("2026-10-14");
  });

  it("zonedMidnight devolve o instante da meia-noite local", () => {
    expect(zonedMidnight("2026-10-13", SP).toISOString()).toBe("2026-10-13T03:00:00.000Z");
    // Nova York troca para horário de verão em 08/03/2026.
    expect(zonedMidnight("2026-03-08", "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(zonedMidnight("2026-03-09", "America/New_York").toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("addDays atravessa mês e ano", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-10-13", -29)).toBe("2026-09-14");
  });
});

describe("resolvePeriod", () => {
  it("hoje vai da meia-noite local até a meia-noite seguinte", () => {
    const result = resolvePeriod({ preset: "hoje" }, SP, NOW);
    expect(result).toEqual({
      ok: true,
      period: {
        preset: "hoje",
        from: "2026-10-13",
        to: "2026-10-13",
        start: new Date("2026-10-13T03:00:00Z"),
        end: new Date("2026-10-14T03:00:00Z"),
      },
    });
  });

  it("7 e 30 dias incluem hoje", () => {
    const week = resolvePeriod({ preset: "7d" }, SP, NOW);
    const month = resolvePeriod({ preset: "30d" }, SP, NOW);
    expect(week.ok && [week.period.from, week.period.to]).toEqual(["2026-10-07", "2026-10-13"]);
    expect(month.ok && [month.period.from, month.period.to]).toEqual(["2026-09-14", "2026-10-13"]);
  });

  it("preset ausente ou desconhecido cai em 7 dias", () => {
    for (const preset of [undefined, null, "", "ano"]) {
      const result = resolvePeriod({ preset }, SP, NOW);
      expect(result.ok && result.period.preset).toBe("7d");
    }
  });

  it("personalizado aceita datas válidas, inclusive 366 dias", () => {
    const result = resolvePeriod({ preset: "personalizado", from: "2026-10-01", to: "2026-10-05" }, SP, NOW);
    expect(result).toMatchObject({
      ok: true,
      period: { from: "2026-10-01", to: "2026-10-05", start: new Date("2026-10-01T03:00:00Z"), end: new Date("2026-10-06T03:00:00Z") },
    });
    expect(resolvePeriod({ preset: "personalizado", from: "2025-10-14", to: "2026-10-14" }, SP, NOW).ok).toBe(true);
  });

  it("personalizado recusa datas vazias, inexistentes, invertidas ou longas demais", () => {
    expect(resolvePeriod({ preset: "personalizado", from: "", to: "2026-10-05" }, SP, NOW)).toEqual({
      ok: false,
      message: "Informe as datas de início e fim.",
    });
    expect(resolvePeriod({ preset: "personalizado", from: "2026-02-30", to: "2026-03-05" }, SP, NOW)).toEqual({
      ok: false,
      message: "Informe as datas de início e fim.",
    });
    expect(resolvePeriod({ preset: "personalizado", from: "2026-10-05", to: "2026-10-01" }, SP, NOW)).toEqual({
      ok: false,
      message: "A data de início deve ser antes da data de fim.",
    });
    expect(resolvePeriod({ preset: "personalizado", from: "2025-10-13", to: "2026-10-14" }, SP, NOW)).toEqual({
      ok: false,
      message: "Escolha um período de até 366 dias.",
    });
  });

  it("formatPeriodRange mostra um dia ou o intervalo", () => {
    expect(formatPeriodRange({ from: "2026-10-13", to: "2026-10-13" })).toBe("13/10/2026");
    expect(formatPeriodRange({ from: "2026-10-07", to: "2026-10-13" })).toBe("07/10/2026 a 13/10/2026");
  });
});
