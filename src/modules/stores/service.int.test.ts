import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "@/shared/db/client";
import { storeHours, stores } from "./schema";
import { createStore, deleteStoreBySlug, getStoreBySlug, replaceStoreHours } from "./service";

const base = { slug: "pizzaria-teste", name: "Pizzaria Teste", whatsappPhone: "+5511988887777" };

describe("stores service", () => {
  beforeEach(async () => {
    await db.delete(stores);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("cria loja com configurações padrão", async () => {
    await createStore(base);

    const store = await getStoreBySlug("pizzaria-teste");

    expect(store).toMatchObject({
      slug: "pizzaria-teste",
      name: "Pizzaria Teste",
      whatsappPhone: "+5511988887777",
      address: null,
      timezone: "America/Sao_Paulo",
      manualStatus: "auto",
      hours: [],
    });
    expect(store?.theme).toEqual({ primary: "#B91C1C", secondary: "#F59E0B", font: "sans" });
    expect(store?.features).toMatchObject({ delivery: true, pickup: true, dineIn: false, halfAndHalf: true });
    expect(store?.rules).toMatchObject({ minOrderCents: 0, halfPriceRule: "highest", deliveryFee: { strategy: "fixed", fixedCents: 0 } });
    expect(store?.paymentMethods).toEqual({ cash: true, cardOnDelivery: true, pixKey: null });
  });

  it("retorna null para slug inexistente", async () => {
    expect(await getStoreBySlug("nao-existe")).toBeNull();
  });

  it("recusa slug duplicado com VALIDATION", async () => {
    await createStore(base);
    await expect(createStore({ ...base, name: "Outra" })).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "slug", message: "slug já está em uso" }] },
    });
  });

  it.each(["red", "#FFF", "#B91C1C;background:url(x)", "url(javascript:alert(1))"])(
    "recusa cor de tema inválida %s",
    async (primary) => {
      await expect(createStore({ ...base, theme: { primary } })).rejects.toMatchObject({ code: "VALIDATION" });
    },
  );

  it.each(["Pizzaria Teste", "pizzaria_teste", "-pizzaria", "ab"])("recusa slug inválido %s", async (slug) => {
    await expect(createStore({ ...base, slug })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it.each(["admin", "painel", "login"])("recusa slug reservado %s", async (slug) => {
    await expect(createStore({ ...base, slug })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it.each(["http://x.com/a.png", "javascript:alert(1)"])("recusa logoUrl que não é https %s", async (logoUrl) => {
    await expect(createStore({ ...base, logoUrl })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("recusa telefone fora do E.164 e fuso inválido", async () => {
    await expect(createStore({ ...base, whatsappPhone: "11988887777" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createStore({ ...base, timezone: "Marte/Olimpo" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("substitui horários (sem duplicar) e devolve HH:MM ordenados", async () => {
    const { id } = await createStore(base);
    const hours = [
      { weekday: 5, opensAt: "18:00", closesAt: "00:30" },
      { weekday: 2, opensAt: "18:00", closesAt: "23:00" },
      { weekday: 2, opensAt: "11:00", closesAt: "14:00" },
    ];

    await replaceStoreHours(id, hours);
    await replaceStoreHours(id, hours);

    const store = await getStoreBySlug("pizzaria-teste");
    expect(store?.hours).toEqual([
      { weekday: 2, opensAt: "11:00", closesAt: "14:00" },
      { weekday: 2, opensAt: "18:00", closesAt: "23:00" },
      { weekday: 5, opensAt: "18:00", closesAt: "00:30" },
    ]);
  });

  it.each([
    [{ weekday: 7, opensAt: "18:00", closesAt: "23:00" }],
    [{ weekday: 1, opensAt: "25:00", closesAt: "23:00" }],
    [{ weekday: 1, opensAt: "18:00", closesAt: "18:00" }],
  ])("recusa horário inválido %o", async (hour) => {
    const { id } = await createStore(base);
    await expect(replaceStoreHours(id, [hour])).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("deleteStoreBySlug remove loja e horários em cascata", async () => {
    const { id } = await createStore(base);
    await replaceStoreHours(id, [{ weekday: 1, opensAt: "18:00", closesAt: "23:00" }]);

    expect(await deleteStoreBySlug("pizzaria-teste")).toBe(true);
    expect(await deleteStoreBySlug("pizzaria-teste")).toBe(false);
    expect(await db.select().from(storeHours).where(eq(storeHours.storeId, id))).toEqual([]);
  });
});
