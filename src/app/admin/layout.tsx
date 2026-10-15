import { PanelThemeProvider } from "@/components/panel-theme-provider";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <PanelThemeProvider>{children}</PanelThemeProvider>;
}
