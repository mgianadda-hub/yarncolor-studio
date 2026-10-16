import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YarnColor Studio",
  description: "Applica il colore di un filato alla foto di un gomitolo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
