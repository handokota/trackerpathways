"use client";

import { useState, useMemo, useEffect, useDeferredValue, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import rawData from "@/data/trackers.json"; 
import { DataStructure, PathResult } from "@/types"; 

const data = rawData as unknown as DataStructure;

export default function TrackerSearchApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sourceSearch, setSourceSearch] = useState(searchParams.get("source") || "");
  const [targetSearch, setTargetSearch] = useState(searchParams.get("target") || "");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>((searchParams.get("view") as 'grid' | 'list') || 'grid');
  
  const [maxJumps, setMaxJumps] = useState<number>(
    searchParams.get("jumps") ? parseInt(searchParams.get("jumps")!) : 1
  );
  const [maxDays, setMaxDays] = useState<number | null>(
    searchParams.get("days") ? parseInt(searchParams.get("days")!) : null
  );
  const [sortBy, setSortBy] = useState<'days' | 'jumps'>((searchParams.get("sort") as 'days' | 'jumps') || 'jumps');

  const [showFilters, setShowFilters] = useState(false);

  const [showSourceSug, setShowSourceSug] = useState(false);
  const [showTargetSug, setShowTargetSug] = useState(false);
  const sourceWrapperRef = useRef<HTMLDivElement>(null);
  const targetWrapperRef = useRef<HTMLDivElement>(null);

  const deferredSource = useDeferredValue(sourceSearch);
  const deferredTarget = useDeferredValue(targetSearch);
  const isStale = sourceSearch !== deferredSource || targetSearch !== deferredTarget;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const params = new URLSearchParams();
    if (deferredSource) params.set("source", deferredSource);
    if (deferredTarget) params.set("target", deferredTarget);
    if (viewMode !== 'grid') params.set("view", viewMode);
    if (maxJumps !== 1) params.set("jumps", maxJumps.toString());
    if (maxDays !== null) params.set("days", maxDays.toString());
    if (sortBy !== 'jumps') params.set("sort", sortBy);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [deferredSource, deferredTarget, viewMode, maxJumps, maxDays, sortBy, mounted, pathname, router]);

  useEffect(() => {
     if (!searchParams.get("source") && !searchParams.get("target")) {
        setSourceSearch("");
        setTargetSearch("");
     }
  }, [searchParams]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sourceWrapperRef.current && !sourceWrapperRef.current.contains(event.target as Node)) {
        setShowSourceSug(false);
      }
      if (targetWrapperRef.current && !targetWrapperRef.current.contains(event.target as Node)) {
        setShowTargetSug(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getAbbr = (name: string) => {
    if (data.abbrList[name]) return data.abbrList[name];
    const capitals = name.match(/[A-Z]/g);
    if (capitals && capitals.length >= 2) return capitals.join("");
    return name.substring(0, 3).toUpperCase();
  };

  const allTrackers = useMemo(() => {
    const set = new Set<string>();
    Object.keys(data.routeInfo).forEach(key => {
      set.add(key);
      const targets = data.routeInfo[key];
      if (targets) {
        Object.keys(targets).forEach(t => set.add(t));
      }
    });
    return Array.from(set).sort();
  }, []);

  const getSuggestions = (query: string) => {
    if (!query) return [];
    const terms = query.split(",");
    const lastTerm = terms[terms.length - 1].trim().toLowerCase();
    if (!lastTerm) return [];

    return allTrackers.filter(t => {
      const abbr = getAbbr(t).toLowerCase();
      return t.toLowerCase().includes(lastTerm) || abbr.includes(lastTerm);
    }).slice(0, 8);
  };

  const handleSourceSelect = (selectedItem: string) => {
    const terms = sourceSearch.split(",");
    terms.pop(); 
    terms.push(selectedItem); 
    setSourceSearch(terms.join(", ")); 
    setShowSourceSug(false);
  };

  const handleTargetSelect = (selectedItem: string) => {
    setTargetSearch(selectedItem);
    setShowTargetSug(false);
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'yes' || s === 'open') return 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40';
    if (s === 'no' || s === 'closed') return 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40';
    return 'text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40';
  };

  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'yes') return 'Recruiting'; 
    if (s === 'no') return 'Closed';
    return status; 
  };

  const renderReqs = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const foundPaths = useMemo(() => {
    const sQueryRaw = deferredSource.toLowerCase().trim();
    const sourceInputs = sQueryRaw ? sQueryRaw.split(',').map(s => s.trim()).filter(s => s) : [];
    const tQuery = deferredTarget.toLowerCase().trim();

    if (!sQueryRaw && !tQuery) return [];
    
    const isStrictTarget = allTrackers.some(t => 
       t.toLowerCase() === tQuery || getAbbr(t).toLowerCase() === tQuery
    );
    
    const results: PathResult[] = [];
    const queue: PathResult[] = [];

    const allTrackerKeys = Object.keys(data.routeInfo);
    let startNodes: string[] = [];

    if (sourceInputs.length > 0) {
      startNodes = allTrackerKeys.filter(t => {
        const tLower = t.toLowerCase();
        const tAbbr = getAbbr(t).toLowerCase();
        return sourceInputs.some(input => {
            const isStrictInput = allTrackers.some(validT => validT.toLowerCase() === input || getAbbr(validT).toLowerCase() === input);
            if (isStrictInput) {
                return tLower === input || tAbbr === input;
            }
            return tLower.includes(input) || tAbbr === input;
        });
      });
    } else {
      if (tQuery) {
        startNodes = allTrackerKeys;
      }
    }

    const startNodeSet = new Set(startNodes);

    startNodes.forEach(start => {
      queue.push({
        source: start,
        target: start,
        nodes: [start],
        totalDays: 0,
        routes: []
      });
    });

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const currentNode = currentPath.nodes[currentPath.nodes.length - 1];

      if (currentPath.nodes.length > 1) {
        let isTargetMatch = true;
        
        if (tQuery) {
          const cName = currentNode.toLowerCase();
          const cAbbr = getAbbr(currentNode).toLowerCase();

          if (isStrictTarget) {
             isTargetMatch = cName === tQuery || cAbbr === tQuery;
          } else {
             isTargetMatch = cName.includes(tQuery) || cAbbr.includes(tQuery);
          }
        }
        
        if (isTargetMatch) {
          if (maxDays === null || currentPath.totalDays <= maxDays) {
            results.push(currentPath);
          }
        }
      }

      if (currentPath.routes.length >= maxJumps) continue;

      const neighbors = data.routeInfo[currentNode];
      if (neighbors) {
        Object.entries(neighbors).forEach(([nextTracker, details]) => {
          if (startNodeSet.has(nextTracker) && nextTracker.toLowerCase() !== tQuery) {
             return;
          }

          if (!currentPath.nodes.includes(nextTracker)) {
            const days = details.days; 
            if (maxDays !== null && (currentPath.totalDays + days) > maxDays) return;

            queue.push({
              source: currentPath.source,
              target: nextTracker,
              nodes: [...currentPath.nodes, nextTracker],
              totalDays: currentPath.totalDays + days,
              routes: [...currentPath.routes, details] 
            });
          }
        });
      }
    }

    return results.sort((a, b) => {
      if (sortBy === 'days') {
        return a.totalDays - b.totalDays;
      }
      return a.routes.length - b.routes.length;
    });

  }, [deferredSource, deferredTarget, maxJumps, maxDays, sortBy, allTrackers]);

  const groupedResults = useMemo(() => {
    const groups: { [key: string]: PathResult[] } = {};
    foundPaths.forEach(path => {
      if (!groups[path.source]) groups[path.source] = [];
      groups[path.source].push(path);
    });
    return groups;
  }, [foundPaths]);


  if (!mounted) return <div className="w-full" />;

  const abbrClass = "text-xs font-semibold text-foreground/70 bg-foreground/10 rounded-md shrink-0 px-1.5 py-0.5";

  return (
    <>
      <div className={`w-full transition-all duration-500 ease-out ${sourceSearch || targetSearch ? 'translate-y-0' : 'translate-y-4 md:translate-y-16'}`}>
        {!sourceSearch && !targetSearch && (
          <div className="text-center mb-10 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              Discover the private tracker network.
            </h1>
            <p className="text-lg text-foreground/60 font-medium mx-auto leading-relaxed">
              Find your way to the trackers worth chasing. Explore detailed pathways, requirements, and invite tiers.
            </p>
          </div>
        )}

        <div className="w-full max-w-2xl mx-auto bg-foreground/3 rounded-2xl p-2 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col relative">
            
            <div className="absolute left-4 top-4 bottom-14 flex flex-col items-center gap-1 z-0 pointer-events-none">
              <div className="w-2.5 h-2.5 rounded-full border-[3px] border-foreground/10 bg-background"></div>
              <div className="w-px flex-1 bg-linear-to-b from-foreground/10 to-foreground/10"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-foreground/10"></div>
            </div>

            <div className="flex flex-col gap-1 pl-9 pr-2 py-2">
              
              <div className="relative" ref={sourceWrapperRef}>
                <input 
                  aria-label="Source tracker"
                  type="text"
                  placeholder="Source tracker(s) (e.g. MAM, RED)"
                  className="w-full h-10 bg-transparent border-none outline-none font-medium text-foreground placeholder:text-foreground/30 text-sm"
                  value={sourceSearch}
                  onFocus={() => setShowSourceSug(true)}
                  onChange={(e) => {
                    setSourceSearch(e.target.value);
                    setShowSourceSug(true);
                  }}
                />
                {showSourceSug && getSuggestions(sourceSearch).length > 0 && (
                  <div className="absolute top-full -left-8 w-[calc(100%+2rem)] mt-2 bg-card rounded-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 border border-foreground/10">
                    <div className="max-h-60 overflow-y-auto p-1">
                      {getSuggestions(sourceSearch).map((item, i) => (
                        <div 
                          key={i}
                          className="px-3 py-2.5 rounded-md text-sm cursor-pointer hover:bg-foreground/5 transition-colors text-foreground/90 font-medium flex items-center justify-between"
                          onClick={() => handleSourceSelect(item)}
                        >
                          <span>{item}</span>
                          <span className="text-xs text-foreground/40 font-semibold">{getAbbr(item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px w-full bg-foreground/5 my-1"></div>

              <div className="relative" ref={targetWrapperRef}>
                <input 
                  aria-label="Target tracker"
                  type="text"
                  placeholder="Target tracker(s)"
                  className="w-full h-10 bg-transparent border-none outline-none font-medium text-foreground placeholder:text-foreground/30 text-sm"
                  value={targetSearch}
                  onFocus={() => setShowTargetSug(true)}
                  onChange={(e) => {
                    setTargetSearch(e.target.value);
                    setShowTargetSug(true);
                  }}
                />
                {showTargetSug && getSuggestions(targetSearch).length > 0 && (
                  <div className="absolute top-full -left-8 w-[calc(100%+2rem)] mt-2 bg-card rounded-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 border border-foreground/10">
                    <div className="max-h-60 overflow-y-auto p-1">
                      {getSuggestions(targetSearch).map((item, i) => (
                        <div 
                          key={i}
                          className="px-3 py-2.5 rounded-md text-sm cursor-pointer hover:bg-foreground/5 transition-colors text-foreground/90 font-medium flex items-center justify-between"
                          onClick={() => handleTargetSelect(item)}
                        >
                          <span>{item}</span>
                          <span className="text-xs text-foreground/40 font-semibold">{getAbbr(item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

            <div className="flex items-center justify-between mt-1 pt-1 px-2 pb-1">
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all text-sm font-medium bg-foreground/5 ${
                  showFilters 
                    ? 'text-foreground' 
                    : 'text-foreground/50 hover:text-foreground' 
                }`}
              >
                <span className="material-symbols-rounded text-lg">tune</span>
                <span>Options</span>
              </button>

              <div className="hidden md:flex items-center bg-foreground/5 rounded-md p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-sm flex items-center justify-center transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-card text-foreground' 
                      : 'text-foreground/40 hover:text-foreground/70'
                  }`}
                  title="Grid View"
                >
                  <span className="material-symbols-rounded text-lg">grid_view</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-sm flex items-center justify-center transition-all ${
                    viewMode === 'list' 
                      ? 'bg-card text-foreground' 
                      : 'text-foreground/40 hover:text-foreground/70'
                  }`}
                  title="List View"
                >
                  <span className="material-symbols-rounded text-lg">view_list</span>
                </button>
              </div>

            </div>

          </div>
        </div>

        {showFilters && (
          <div className="max-w-2xl mx-auto mt-2 p-6 bg-foreground/3 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div>
                <label className="text-sm font-medium text-foreground/50 mb-2 block">Max jumps</label>
                <div className="flex rounded-lg bg-foreground/5 p-1">
                  {[1, 2, 3, 5, 10].map((val) => (
                    <button
                      key={val}
                      onClick={() => setMaxJumps(val)}
                      className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all ring-0 focus:ring-0 font-medium ${
                        maxJumps === val 
                          ? 'bg-foreground/10 text-foreground' 
                          : 'text-foreground/60 hover:text-foreground'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground/50 mb-2 block">Max days</label>
                <div className="flex rounded-lg bg-foreground/5 p-1 overflow-x-auto">
                  {[
                    { l: 'Any', v: null },
                    { l: '90d', v: 90 },
                    { l: '6m', v: 180 },
                    { l: '1y', v: 365 },
                    { l: '2y', v: 730 }
                  ].map((opt) => (
                    <button
                      key={opt.l}
                      onClick={() => setMaxDays(opt.v)}
                      className={`flex-1 px-2 py-1.5 text-sm rounded-md whitespace-nowrap transition-all ring-0 focus:ring-0 font-medium ${
                        maxDays === opt.v 
                          ? 'bg-foreground/10 text-foreground' 
                          : 'text-foreground/60 hover:text-foreground'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground/50 mb-2 block">Sort by</label>
                <div className="flex rounded-lg bg-foreground/5 p-1">
                  {[
                    { l: 'Jumps', v: 'jumps' },
                    { l: 'Days', v: 'days' }
                  ].map((opt) => (
                    <button
                      key={opt.l}
                      onClick={() => setSortBy(opt.v as 'days' | 'jumps')}
                      className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all ring-0 focus:ring-0 font-medium ${
                        sortBy === opt.v 
                          ? 'bg-foreground/10 text-foreground' 
                          : 'text-foreground/60 hover:text-foreground'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {(sourceSearch || targetSearch) && (
        <div className="mt-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="flex items-center justify-between mb-5 px-1">
            <h2 className="text-sm font-medium text-foreground/50 tracking-wide">
              Search results
            </h2>
            {isStale ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-foreground/5 rounded-md">
                <span className="material-symbols-rounded text-lg text-foreground/50 animate-spin">progress_activity</span>
              </div>
            ) : (
              <span className="text-sm font-medium font-sans text-foreground bg-foreground/5 px-3 py-1 rounded-md">{foundPaths.length} Found</span>
            )}
          </div>

          <div className="flex flex-col gap-10 pb-10">
            {Object.keys(groupedResults).sort().map((sourceName) => {
              const paths = groupedResults[sourceName];
              const sourceAbbr = getAbbr(sourceName);
              const unlockInfo = data.unlockInviteClass[sourceName];

              return (
                <div key={sourceName} className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1 pb-2 mb-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-foreground tracking-tight">{sourceName}</h3>
                      {sourceAbbr && <span className={`px-1.5 py-0.5 text-xs font-semibold text-foreground/70 bg-foreground/10 rounded-md`}>{sourceAbbr}</span>}
                    </div>
                    
                    {unlockInfo && (
                      <div className="flex items-center gap-2 w-fit self-start md:self-auto text-sm text-foreground/60 bg-foreground/5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-md mt-1 md:mt-0">
                        <span className="material-symbols-rounded text-lg">lock_open</span>
                        <span className="font-medium">{unlockInfo[1]} ({unlockInfo[0]}d)</span>
                      </div>
                    )}
                  </div>

                  <div className={
                    viewMode === 'grid' 
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                      : "grid grid-cols-1 gap-3"
                  }>
                    {paths.map((path, idx) => {
                      const targetAbbr = getAbbr(path.target);
                      const isDirect = path.routes.length === 1;

                      return (
                        <div key={idx} className="group flex flex-col p-5 rounded-md bg-card transition-colors duration-200 h-full">
                          
                          <div className="flex justify-between items-start mb-3 gap-4"> 
                            <div className="min-w-0">
                              
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                                <div className="font-bold text-foreground text-lg wrap-break-word">{path.target}</div>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={abbrClass}>
                                    {targetAbbr}
                                  </span>

                                  {!isDirect && <span className="text-xs font-medium bg-foreground/10 text-foreground/60 px-1.5 py-0.5 rounded-md whitespace-nowrap">{path.routes.length} hop</span>}
                                </div>
                              </div>
                              
                              <div className="text-sm font-medium text-foreground/50 tracking-wide flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                <span>From</span>
                                <span className="text-foreground/80 font-medium">{sourceName}</span>
                                <span className={abbrClass}>
                                  {sourceAbbr}
                                </span>
                              </div>
                              
                            </div>
                            
                            <span className="text-sm font-medium text-foreground/70 bg-transparent border border-foreground/10 px-2 py-1 rounded-md whitespace-nowrap shrink-0">
                              {path.totalDays} days
                            </span>
                          </div>
                          
                          <div className="space-y-3 mt-auto flex-1">
                            {path.routes.map((req, rIdx) => {
                              const fromNode = path.nodes[rIdx];
                              const toNode = path.nodes[rIdx + 1];
                              
                              return (
                                <div key={rIdx} className="text-sm pl-3 relative border-l-2 border-foreground/10">
                                  {!isDirect && (
                                    <div className="text-sm font-semibold text-foreground/40 mb-1 flex items-center gap-1">
                                      <span>{fromNode}</span><span className="material-symbols-rounded text-base">arrow_right_alt</span><span>{toNode}</span>
                                    </div>
                                  )}
                                  <p className="text-foreground/70 leading-relaxed font-normal text-sm">{renderReqs(req.reqs)}</p>
                                  
                                  <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-foreground/5 border-dashed">
                                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                                      <span className={`text-sm font-semibold px-2 py-0.5 rounded-md ${getStatusColor(req.active)}`}>
                                        {getStatusLabel(req.active)}
                                      </span>
                                      <div className="flex items-center gap-1 text-foreground/30" title="Last checked date">
                                        <span className="material-symbols-rounded text-sm">history</span>
                                        <span className="text-xs font-medium">Last checked: {req.updated}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}
            
            {!isStale && foundPaths.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 opacity-50 border-2 border-dashed border-foreground/10 rounded-lg">
                <span className="material-symbols-rounded text-6xl mb-4 text-foreground/20">search_off</span>
                <p className="text-foreground/50 font-medium">
                  No routes found matching your criteria
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}