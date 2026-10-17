import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doxia — Your identity. Your signal. Your impact.",
  description: "A privacy-minded social space for identity, crypto community signal, and impact.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
