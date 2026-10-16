import { PanelThemeProvider } from "@/components/panel-theme-provider";

// Vale para todo o painel, inclusive a impressão da comanda (fora do shell com sidebar).
export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return <PanelThemeProvider>{children}</PanelThemeProvider>;
}
