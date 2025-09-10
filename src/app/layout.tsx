import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from 'next/link';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = { title: 'Under Achievers' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="en"><body className="min-h-screen bg-gray-50">
<nav className="sticky top-0 bg-white/70 backdrop-blur border-b">
<div className="max-w-4xl mx-auto p-3 flex gap-4">
<Link href="/">Home</Link>
<Link href="/play">Play</Link>
<Link href="/leaderboard">Leaderboard</Link>
</div>
</nav>
<main className="max-w-4xl mx-auto p-4">{children}</main>
</body></html>
);
}
