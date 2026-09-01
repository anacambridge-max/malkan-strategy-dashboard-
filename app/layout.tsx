import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Malkan Strategy Dashboard",
  description: "Rule-based technical scanner for GFS, breakouts, CIP, volume and volatility.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
