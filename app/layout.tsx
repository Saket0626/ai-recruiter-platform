import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ResearchReach",
  description: "Evidence-grounded undergraduate research outreach",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper text-ink">
        <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
          <Nav />
          <main className="px-4 py-6 sm:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
