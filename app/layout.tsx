import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Display serif, used only for the wordmark and headings. */
const displaySerif = Cormorant_Garamond({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "êmet — Brand governance",
  description:
    "AI-powered brand governance: review content against approved guidelines, detect unsupported claims, and route work for human approval.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
