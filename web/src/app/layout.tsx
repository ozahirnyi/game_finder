import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Game Finder",
  description: "Find your next favorite game, track its price, and save it for later.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
