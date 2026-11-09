import "./globals.css";

export const metadata = {
  title: "SZ Prime Solutions",
  description: "One company. Multiple specialised solutions. One coordinated customer experience.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
