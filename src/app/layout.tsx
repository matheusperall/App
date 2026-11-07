import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: {
    default: "Sempre Zero — Garagem digital",
    template: "%s · Sempre Zero",
  },
  description:
    "Sua garagem digital: histórico de serviços, apontamentos, lembretes de manutenção e vencimentos do seu veículo.",
  applicationName: "Sempre Zero",
  appleWebApp: { capable: true, title: "Sempre Zero", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
