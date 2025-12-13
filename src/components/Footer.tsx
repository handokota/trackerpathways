"use client";

import { useMemo } from "react";
import rawData from "@/data/trackers.json";
import { DataStructure } from "@/types";

const data = rawData as unknown as DataStructure;

export default function Footer() {
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

  return (
    <footer className="py-6 text-center text-sm font-medium text-foreground/40 mt-auto">
      <p className="flex items-center justify-center gap-2">
        <span>Last updated {latestUpdateDate}</span>
        <span className="w-1 h-1 rounded-full bg-foreground/10"></span>
        <span>Data by <a href="https://www.reddit.com/r/TrackersInfo/wiki/official_recruitments/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline decoration-dotted underline-offset-4">TrackersInfo</a></span>
      </p>
    </footer>
  );
}