"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import ThemeSwitcher from "@/components/ThemeSwitcher";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogoClick = () => {
    if (pathname === "/") {
      router.replace("/");
    } else {
      router.push("/");
    }
  };

  return (
    <header className="fixed w-full top-0 z-50 bg-background/80 backdrop-blur-xl transition-colors duration-300">
      <div className="w-full px-6 h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer select-none group" 
          onClick={handleLogoClick}
        >
          <div className="relative w-8 h-8 transition-transform group-hover:scale-105">
            <img 
              src="/logo-light.svg" 
              alt="Logo" 
              className="absolute inset-0 w-full h-full object-contain dark:hidden" 
            />
            <img 
              src="/logo-dark.svg" 
              alt="Logo" 
              className="absolute inset-0 w-full h-full object-contain hidden dark:block" 
            />
          </div>

          <span className="text-xl font-bold tracking-tight text-foreground">
            Tracker Pathways
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link 
            href="/map" 
            className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors hover:bg-foreground/5 ${
              pathname === "/map" 
                ? "text-foreground" 
                : "text-foreground/60 hover:text-foreground"
            }`}
            aria-label="View Map"
          >
            <span className="material-symbols-rounded text-lg">map</span>
          </Link>
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}