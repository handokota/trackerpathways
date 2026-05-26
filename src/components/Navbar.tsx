"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import ThemeSwitcher from "@/components/ThemeSwitcher";

const subscribe = () => () => {};

export default function Navbar() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <header className="fixed w-full top-0 z-50 bg-background/80 backdrop-blur-xl transition-colors duration-300 border-b border-border/40">
      <div className="w-full px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Go to home"
          className="flex items-center gap-3 select-none group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
        >
          <div className="w-8 h-8 transition-transform group-hover:scale-105">
            {mounted ? (
              <Image
                src={resolvedTheme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
                alt=""
                aria-hidden="true"
                width={32}
                height={32}
                className="w-8 h-8 object-contain"
                priority
              />
            ) : (
              <div className="w-8 h-8" />
            )}
          </div>

          <span className="text-xl font-bold tracking-tight text-foreground hidden sm:block">
            Tracker Pathways
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link 
            href="/map" 
            className={`w-9 h-9 flex items-center justify-center rounded-md transition-all hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 ${
              pathname === "/map" 
                ? "text-foreground" 
                : "text-foreground/60"
            }`}
            aria-label="View Map"
          >
            <span className="material-symbols-rounded text-lg">map</span>
          </Link>

          <Link 
            href="/directory" 
            className={`w-9 h-9 flex items-center justify-center rounded-md transition-all hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 ${
              pathname === "/directory" 
                ? "text-foreground" 
                : "text-foreground/60"
            }`}
            aria-label="Tracker Directory"
          >
            <span className="material-symbols-rounded text-lg">menu_book</span>
          </Link>
          
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
