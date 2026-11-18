import "./globals.css";
import type { ReactNode } from "react";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata = {
  title: "Nevon Pay",
  description: "Demonstração em sandbox de um gateway de pagamentos para comerciantes em Moçambique. Sem processamento de dinheiro real.",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt"><body>{children}</body></html>;
}
