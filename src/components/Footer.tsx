"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import rawData from "@/data/trackers.json";
import { DataStructure } from "@/types";

const data = rawData as unknown as DataStructure;

export default function Footer() {
  const pathname = usePathname();

  const latestUpdateDate = useMemo(() => {
    const monthMap: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

    let maxTime = 0;
    let maxStr = "";

    Object.values(data.routeInfo).forEach((targets) => {
      Object.values(targets).forEach((route) => {
        if (!route.updated) return;
        const parts = route.updated.split(" ");
        if (parts.length < 2) return;
        
        const monthStr = parts[0];
        const yearStr = parts[1];
        const month = monthMap[monthStr];
        const year = parseInt(yearStr);

        if (month !== undefined && !isNaN(year)) {
          const dateObj = new Date(year, month);
          const time = dateObj.getTime();
          if (time > maxTime) {
            maxTime = time;
            maxStr = route.updated;
          }
        }
      });
    });
    return maxStr || "Unknown";
  }, []);

  if (pathname === "/map") {
    return null;
  }

  return (
    <footer className="w-full py-6 px-6 mt-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="w-full flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs font-medium text-foreground/40 text-center">
        <span>Last updated {latestUpdateDate}</span>
        
        <span className="w-1 h-1 rounded-full bg-foreground/10 shrink-0"></span>
        
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