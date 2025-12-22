"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  if (pathname === "/map") {
    return null;
  }

  return (
    <footer className="w-full py-6 px-6 mt-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="w-full flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs font-medium text-foreground/40 text-center">
        <span>
          Data by <a href="https://www.reddit.com/r/TrackersInfo/wiki/official_recruitments/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline decoration-dotted underline-offset-4">TrackersInfo</a>
        </span>

        <span className="w-1 h-1 rounded-full bg-foreground/10 shrink-0"></span>

        <a
          href="https://github.com/handokota/trackerpathways"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <img src="/github-light.svg" alt="GitHub" className="w-3.5 h-3.5 block dark:hidden opacity-80" />
          <img src="/github-dark.svg" alt="GitHub" className="w-3.5 h-3.5 hidden dark:block opacity-80" />
          <span>GitHub</span>
        </a>
      </div>
    </footer>
  );
}