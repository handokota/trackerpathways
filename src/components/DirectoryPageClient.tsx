"use client";

import { useState, useMemo } from "react";
import rawData from "@/data/trackers.json";

export default function DirectoryPageClient() {
  const [search, setSearch] = useState("");

  const trackers = useMemo(() => {
    if (!rawData.abbrList) return [];
    
    const list = Object.entries(rawData.abbrList).map(([name, abbr]) => ({
      name,
      abbr
    }));

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filteredTrackers = useMemo(() => {
    if (!search) return trackers;
    const lowerSearch = search.toLowerCase();
    return trackers.filter(t => 
      t.name.toLowerCase().includes(lowerSearch) || 
      t.abbr.toLowerCase().includes(lowerSearch)
    );
  }, [search, trackers]);

  return (
    <main className="w-full px-6 pt-24 md:pt-32 pb-10 min-h-screen">
      <div className="max-w-2xl mx-auto flex flex-col gap-6 mb-12">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Tracker Directory</h1>
          <p className="text-foreground/60">
            Complete list of {trackers.length} trackers and their abbreviations.
          </p>
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30">
            <span className="material-symbols-rounded">search</span>
          </span>
          <input
            type="text"
            placeholder="Search by name or abbreviation..."
            className="w-full bg-foreground/3 rounded-xl py-3 pl-11 pr-4 outline-none font-medium text-foreground placeholder:text-foreground/30 text-sm transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredTrackers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTrackers.map((t) => (
            <div 
              key={t.name} 
              className="bg-card rounded-xl p-4 flex items-center justify-between"
            >
              <span className="text-sm font-medium truncate text-foreground/80 pr-3" title={t.name}>
                {t.name}
              </span>
              <span className="shrink-0 px-1.5 py-0.5 text-xs font-semibold rounded-md bg-foreground/10 text-foreground/70">
                {t.abbr}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-50 border-2 border-dashed border-foreground/10 rounded-lg">
          <span className="material-symbols-rounded text-6xl mb-4 text-foreground/20">search_off</span>
          <p className="text-foreground/50 font-medium">
            No trackers found matching "{search}"
          </p>
        </div>
      )}
    </main>
  );
}