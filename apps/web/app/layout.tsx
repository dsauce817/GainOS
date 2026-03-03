import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "GainOS — Dashboard",
  description: "Track workouts, hit PRs, train smarter with AI coaching.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} antialiased bg-[#0a0a0b] text-gray-100 font-sans`}>
        {children}
      </body>
    </html>
  );
}
