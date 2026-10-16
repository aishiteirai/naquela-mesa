import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Títulos de lojas com theme.font = "serif". Sem preload: a maioria das páginas não usa.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Naquela Mesa",
  description: "Cardápio digital e pedidos para restaurantes da região.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Toasts sempre claros (tema forçado), com cores dos tokens (--popover etc.). */}
        {/* Toasts no topo para nunca cobrir os botões fixos de baixo (barra da sacola, checkout, rodapé do item). */}
        <Toaster theme="light" position="top-center" />
      </body>
    </html>
  );
}
