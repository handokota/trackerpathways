import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

const materialSymbols = localFont({
  src: "./fonts/MaterialSymbolsRounded.woff2",
  variable: "--font-material-symbols",
  display: "block",
  weight: "100 700",
});

export const metadata: Metadata = {
  title: "Tracker Pathways - Discover the private tracker network",
  description: "Find your way to the trackers worth chasing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${materialSymbols.variable} font-sans antialiased bg-background text-foreground transition-colors duration-300`}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            
            <div className="flex-1 w-full">
              {children}
            </div>

            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}