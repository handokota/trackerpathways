"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  if (pathname === "/map") {
    return null;
  }

  return (
    <footer className="w-full py-6 px-6 mt-auto motion-safe:animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="w-full flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs font-medium text-foreground/60 text-center">
        <span>
          Data by <a href="https://www.reddit.com/r/TrackersInfo/wiki/official_recruitments/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline decoration-dotted underline-offset-4">TrackersInfo</a>
        </span>

        <span className="w-1 h-1 rounded-full bg-foreground/10 shrink-0"></span>

        <a
          href="https://github.com/handokota/trackerpathways"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5 text-foreground/60 hover:text-foreground transition-colors"
        >
          <Image
            src="/github-light.svg"
            alt="GitHub"
            width={14}
            height={14}
            className="w-3.5 h-3.5 opacity-100 ui-icon-light"
          />
          <Image
            src="/github-dark.svg"
            alt="GitHub"
            width={14}
            height={14}
            className="w-3.5 h-3.5 opacity-100 ui-icon-dark"
          />
          <span>GitHub</span>
        </a>
      </div>
    </footer>
  );
}
