import type { Metadata } from "next";
import { PanelThemeProvider } from "@/components/panel-theme-provider";

export const metadata: Metadata = { title: "Naquela Mesa - Admin" };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <PanelThemeProvider>{children}</PanelThemeProvider>;
}
