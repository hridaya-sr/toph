import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Toph",
  description: "Farm activity logging, from voice to record.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${GeistSans.variable}`}>
      <body className="min-h-full flex flex-col bg-white text-zinc-900 font-sans">{children}</body>
    </html>
  );
}
