import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "@/shared/db/client";
import { createStore, deleteStoreBySlug, getStoreById, replaceStoreHours } from "./service";
import { stores } from "./schema";
import {
  getDeliveryZones,
  replaceDeliveryZones,
  setManualStatus,
  updateStoreOperations,
  updateStoreProfile,
  type StoreProfileInput,
} from "./settings-service";

const missingStore = "00000000-0000-4000-8000-000000000000";

async function newStore(slug: string): Promise<string> {
  const { id } = await createStore({ slug, name: slug, whatsappPhone: "+5511988887777" });
  return id;
}

const profile: StoreProfileInput = {
  name: "Pizzaria Nova",
  address: "Rua A, 1",
  whatsappPhone: "+5511977776666",
  theme: { primary: "#1d4ed8", secondary: "#facc15" },
  logoUrl: "/uploads/3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp",
  bannerUrl: null,
};

describe("store settings service", () => {
  beforeEach(async () => {
    await deleteStoreBySlug("loja-a");
    await deleteStoreBySlug("loja-b");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("atualiza perfil e aparência", async () => {
    const storeId = await newStore("loja-a");
    await updateStoreProfile(storeId, profile);

    const store = await getStoreById(storeId);
    expect(store).toMatchObject({
      name: "Pizzaria Nova",
      address: "Rua A, 1",
      whatsappPhone: "+5511977776666",
      logoUrl: profile.logoUrl,
      bannerUrl: null,
      theme: { primary: "#1d4ed8", secondary: "#facc15", panelColors: "naquela" },
    });
  });

  it("fonte serif persiste e mantém as cores; sem fonte, a salva continua", async () => {
    const storeId = await newStore("loja-a");
    await updateStoreProfile(storeId, { ...profile, theme: { ...profile.theme, font: "serif" } });
    expect((await getStoreById(storeId))?.theme).toEqual({ primary: "#1d4ed8", secondary: "#facc15", font: "serif", panelColors: "naquela" });

    await updateStoreProfile(storeId, { ...profile, theme: { primary: "#000000", secondary: "#ffffff" } });
    expect((await getStoreById(storeId))?.theme).toEqual({ primary: "#000000", secondary: "#ffffff", font: "serif", panelColors: "naquela" });
  });

  it("cores do painel: padrão naquela, salva store e preserva quando omitido", async () => {
    const storeId = await newStore("loja-a");
    expect((await getStoreById(storeId))!.theme.panelColors).toBe("naquela");

    await updateStoreProfile(storeId, { ...profile, theme: { primary: "#B91C1C", secondary: "#F59E0B", panelColors: "store" } });
    expect((await getStoreById(storeId))!.theme.panelColors).toBe("store");

    await updateStoreProfile(storeId, { ...profile, theme: { primary: "#B91C1C", secondary: "#F59E0B" } });
    expect((await getStoreById(storeId))!.theme.panelColors).toBe("store");
  });

  it("cores do painel: valor inválido é rejeitado", async () => {
    const storeId = await newStore("loja-a");
    await expect(
      updateStoreProfile(storeId, { ...profile, theme: { primary: "#B91C1C", secondary: "#F59E0B", panelColors: "roxo" as never } }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("loja com tema antigo (sem panelColors) lê como naquela", async () => {
    const storeId = await newStore("loja-a");
    await db
      .update(stores)
      .set({ theme: { primary: "#B91C1C", secondary: "#F59E0B", font: "sans" } as never })
      .where(eq(stores.id, storeId));
    expect((await getStoreById(storeId))!.theme.panelColors).toBe("naquela");
  });

  it.each([
    ["cor inválida", { theme: { primary: "red", secondary: "#facc15" } }],
    ["fonte inválida", { theme: { primary: "#1d4ed8", secondary: "#facc15", font: "comic" as "sans" } }],
    ["logo http", { logoUrl: "http://x.com/a.png" }],
    ["telefone inválido", { whatsappPhone: "1199" }],
    ["nome vazio", { name: " " }],
  ])("recusa perfil com %s", async (_label, overrides) => {
    const storeId = await newStore("loja-a");
    await expect(updateStoreProfile(storeId, { ...profile, ...overrides })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("status manual", async () => {
    const storeId = await newStore("loja-a");
    await setManualStatus(storeId, "force_closed");
    expect((await getStoreById(storeId))?.manualStatus).toBe("force_closed");
  });

  it("operação: tipos de pedido, regras e pagamento", async () => {
    const storeId = await newStore("loja-a");
    await updateStoreOperations(storeId, {
      features: { delivery: false, pickup: true, dineIn: true, halfAndHalf: false, addons: true },
      rules: { minOrderCents: 2500, prepTimeMin: 20, deliveryTimeMin: 40, halfPriceRule: "average", deliveryFee: { strategy: "by_neighborhood" } },
      paymentMethods: { cash: true, cardOnDelivery: false, pixKey: "pix@loja.com" },
    });

    const store = await getStoreById(storeId);
    expect(store?.features).toMatchObject({ delivery: false, pickup: true, dineIn: true, halfAndHalf: false });
    expect(store?.rules).toMatchObject({ minOrderCents: 2500, halfPriceRule: "average", deliveryFee: { strategy: "by_neighborhood" } });
    expect(store?.paymentMethods).toEqual({ cash: true, cardOnDelivery: false, pixKey: "pix@loja.com" });
  });

  it("operação exige ao menos um tipo de pedido", async () => {
    const storeId = await newStore("loja-a");
    await expect(
      updateStoreOperations(storeId, {
        features: { delivery: false, pickup: false, dineIn: false },
        rules: {},
        paymentMethods: {},
      }),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "features" }] } });
  });

  it("bairros: substitui, ordena e recusa repetidos", async () => {
    const storeA = await newStore("loja-a");
    const storeB = await newStore("loja-b");
    await replaceDeliveryZones(storeB, [{ neighborhood: "Centro", feeCents: 300 }]);

    await replaceDeliveryZones(storeA, [
      { neighborhood: "Vila Nova", feeCents: 800 },
      { neighborhood: "Centro", feeCents: 500 },
    ]);
    await replaceDeliveryZones(storeA, [
      { neighborhood: "Vila Nova", feeCents: 900 },
      { neighborhood: "Centro", feeCents: 500 },
    ]);

    expect((await getDeliveryZones(storeA)).map((z) => [z.neighborhood, z.feeCents])).toEqual([
      ["Vila Nova", 900],
      ["Centro", 500],
    ]);
    expect((await getDeliveryZones(storeB)).map((z) => z.neighborhood)).toEqual(["Centro"]);

    await expect(
      replaceDeliveryZones(storeA, [
        { neighborhood: "Centro", feeCents: 500 },
        { neighborhood: "centro ", feeCents: 600 },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "zones.1.neighborhood" }] } });
  });

  it("bairros: taxa absurda vira VALIDATION, não erro do banco", async () => {
    const storeId = await newStore("loja-a");
    await expect(replaceDeliveryZones(storeId, [{ neighborhood: "Centro", feeCents: 3_000_000_000 }])).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "zones.0.feeCents" }] },
    });
  });

  it("horários sobrepostos são recusados", async () => {
    const storeId = await newStore("loja-a");
    await expect(
      replaceStoreHours(storeId, [
        { weekday: 2, opensAt: "18:00", closesAt: "23:00" },
        { weekday: 2, opensAt: "22:00", closesAt: "23:30" },
      ]),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ message: "há turnos sobrepostos" }] } });
  });

  it("loja inexistente → NOT_FOUND", async () => {
    await expect(setManualStatus(missingStore, "auto")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateStoreProfile(missingStore, profile)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
