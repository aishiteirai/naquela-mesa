export const SETTINGS_TABS = [
  ["aparencia", "Aparência"],
  ["horarios", "Horários e status"],
  ["pedidos", "Pedidos e pagamento"],
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number][0];

export function parseSettingsTab(value: string | null): SettingsTab {
  return SETTINGS_TABS.find(([tab]) => tab === value)?.[0] ?? "aparencia";
}
