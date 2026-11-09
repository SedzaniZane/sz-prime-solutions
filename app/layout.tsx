import "./globals.css";
import type { Viewport } from "next";

export const metadata = {
  title: "SZ Prime Solutions",
  description: "One company. Multiple specialised solutions. One coordinated customer experience.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
