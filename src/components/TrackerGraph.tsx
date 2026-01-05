"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef, useMemo } from "react";
import { useTheme } from "next-themes";
import { DataStructure } from "@/types";
import { findShortestPath } from "@/lib/graphUtils";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-muted-foreground">Loading Graph...</div>,
});

interface TrackerGraphProps {
  data: {
    nodes: any[];
    links: any[];
  };
  rawData: DataStructure;
}

export default function TrackerGraph({ data, rawData }: TrackerGraphProps) {
  const { resolvedTheme } = useTheme();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [fontFace, setFontFace] = useState("sans-serif");

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [pathStart, setPathStart] = useState<string>("");
  const [pathEnd, setPathEnd] = useState<string>("");
  const [activePath, setActivePath] = useState<string[] | null>(null);

  const [pathStartInput, setPathStartInput] = useState("");
  const [showPathStartSug, setShowPathStartSug] = useState(false);
  const [pathStartActiveIndex, setPathStartActiveIndex] = useState(-1);
  const pathStartListRef = useRef<HTMLDivElement>(null);

  const [pathEndInput, setPathEndInput] = useState("");
  const [showPathEndSug, setShowPathEndSug] = useState(false);
  const [pathEndActiveIndex, setPathEndActiveIndex] = useState(-1);
  const pathEndListRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);

  const allTrackerNames = useMemo(() => {
    return data.nodes.map(n => n.id).sort((a: string, b: string) => a.localeCompare(b));
  }, [data]);

  const [collection, setCollection] = useState<string>("");
  const [isCollectionPanelOpen, setIsCollectionPanelOpen] = useState(false);
  const [collectionInput, setCollectionInput] = useState("");
  const [showCollectionSug, setShowCollectionSug] = useState(false);
  const [collectionActiveIndex, setCollectionActiveIndex] = useState(-1);
  const collectionWrapperRef = useRef<HTMLDivElement>(null);
  const collectionListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedCollection = localStorage.getItem("tracker-collection");
    if (savedCollection) {
      setCollection(savedCollection);
    }
  }, []);

  const collectionNodes = useMemo(() => {
    return collection.split(",").map(s => s.trim()).filter(s => s && allTrackerNames.includes(s));
  }, [collection, allTrackerNames]);

  const collectionNeighbors = useMemo(() => {
    if (collectionNodes.length === 0) return new Set<string>();
    const neighbors = new Set<string>();

    collectionNodes.forEach(nodeId => {
      const outgoing = rawData.routeInfo[nodeId];
      if (outgoing) Object.keys(outgoing).forEach(target => neighbors.add(target));
    });

    data.links.forEach((link: any) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      if (collectionNodes.includes(sourceId)) neighbors.add(targetId);
      if (collectionNodes.includes(targetId)) neighbors.add(sourceId);
    });

    collectionNodes.forEach(nodeId => neighbors.delete(nodeId));
    return neighbors;
  }, [collectionNodes, data.links, rawData]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    setFontFace(window.getComputedStyle(document.body).fontFamily);
    window.addEventListener("resize", updateDimensions);
    updateDimensions();
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    if (pathStart && pathEnd) {
      const path = findShortestPath(rawData, pathStart, pathEnd);
      setActivePath(path);
      setSelectedNodeId(null);
    } else {
      setActivePath(null);
    }
  }, [pathStart, pathEnd, rawData]);

  useEffect(() => {
    if (pathStartActiveIndex >= 0 && pathStartListRef.current) {
      const list = pathStartListRef.current;
      const activeElement = list.children[pathStartActiveIndex] as HTMLElement;
      if (activeElement) {
        if (pathStartActiveIndex === 0) list.scrollTop = 0;
        else if (pathStartActiveIndex === list.children.length - 1) list.scrollTop = list.scrollHeight;
        else activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [pathStartActiveIndex]);

  useEffect(() => {
    if (pathEndActiveIndex >= 0 && pathEndListRef.current) {
      const list = pathEndListRef.current;
      const activeElement = list.children[pathEndActiveIndex] as HTMLElement;
      if (activeElement) {
        if (pathEndActiveIndex === 0) list.scrollTop = 0;
        else if (pathEndActiveIndex === list.children.length - 1) list.scrollTop = list.scrollHeight;
        else activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [pathEndActiveIndex]);

  useEffect(() => {
    if (collectionActiveIndex >= 0 && collectionListRef.current) {
      const list = collectionListRef.current;
      const activeElement = list.children[collectionActiveIndex] as HTMLElement;
      if (activeElement) {
        if (collectionActiveIndex === 0) list.scrollTop = 0;
        else if (collectionActiveIndex === list.children.length - 1) list.scrollTop = list.scrollHeight;
        else activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [collectionActiveIndex]);

  const selectedNodeDetails = useMemo(() => {
    if (!selectedNodeId) return null;
    const outgoing = rawData.routeInfo[selectedNodeId] || {};
    const incoming: Record<string, any> = {};
    Object.entries(rawData.routeInfo).forEach(([source, targets]) => {
      if (targets[selectedNodeId]) {
        incoming[source] = targets[selectedNodeId];
      }
    });
    return { outgoing, incoming };
  }, [selectedNodeId, rawData]);

  const getAbbr = (name: string) => {
    if (rawData.abbrList && rawData.abbrList[name]) return rawData.abbrList[name];
    const capitals = name.match(/[A-Z]/g);
    if (capitals && capitals.length >= 2) return capitals.join("");
    return name.substring(0, 3).toUpperCase();
  };

  const getSuggestions = (query: string) => {
    if (!query) return [];
    const terms = query.split(",");
    const lastTerm = terms[terms.length - 1].trim().toLowerCase();
    if (!lastTerm) return [];

    return allTrackerNames.filter(t => {
      const abbr = getAbbr(t).toLowerCase();
      return t.toLowerCase().includes(lastTerm) || abbr.includes(lastTerm);
    }).slice(0, 8);
  };

  const handleCollectionSelect = (selectedItem: string) => {
    const currentList = collection.split(",").map(s => s.trim()).filter(s => s);
    
    if (!currentList.includes(selectedItem)) {
      const newValue = [...currentList, selectedItem].join(", ");
      setCollection(newValue);
      localStorage.setItem("tracker-collection", newValue);
    }
    
    setCollectionInput("");
    setShowCollectionSug(false);
    setCollectionActiveIndex(-1);
  };

  const removeCollectionItem = (itemToRemove: string) => {
    const currentList = collection.split(",").map(s => s.trim()).filter(s => s);
    const newValue = currentList.filter(item => item !== itemToRemove).join(", ");
    setCollection(newValue);
    localStorage.setItem("tracker-collection", newValue);
  };

  const handleCollectionKeyDown = (e: React.KeyboardEvent) => {
    if (!showCollectionSug) return;
    const suggestions = getSuggestions(collectionInput);
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCollectionActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCollectionActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && collectionActiveIndex >= 0 && suggestions[collectionActiveIndex]) {
      e.preventDefault();
      handleCollectionSelect(suggestions[collectionActiveIndex]);
    } else if (e.key === "Escape") {
      setShowCollectionSug(false);
    }
  };

  const handlePathStartSelect = (selectedItem: string) => {
    setPathStart(selectedItem);
    setPathStartInput(selectedItem);
    setShowPathStartSug(false);
    setPathStartActiveIndex(-1);
  };

  const handlePathStartKeyDown = (e: React.KeyboardEvent) => {
    if (!showPathStartSug) return;
    const suggestions = getSuggestions(pathStartInput);
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPathStartActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPathStartActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && pathStartActiveIndex >= 0 && suggestions[pathStartActiveIndex]) {
      e.preventDefault();
      handlePathStartSelect(suggestions[pathStartActiveIndex]);
    } else if (e.key === "Escape") {
      setShowPathStartSug(false);
    }
  };

  const handlePathEndSelect = (selectedItem: string) => {
    setPathEnd(selectedItem);
    setPathEndInput(selectedItem);
    setShowPathEndSug(false);
    setPathEndActiveIndex(-1);
  };

  const handlePathEndKeyDown = (e: React.KeyboardEvent) => {
    if (!showPathEndSug) return;
    const suggestions = getSuggestions(pathEndInput);
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPathEndActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPathEndActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && pathEndActiveIndex >= 0 && suggestions[pathEndActiveIndex]) {
      e.preventDefault();
      handlePathEndSelect(suggestions[pathEndActiveIndex]);
    } else if (e.key === "Escape") {
      setShowPathEndSug(false);
    }
  };

  const isDark = resolvedTheme === "dark";
  const defaultNodeColor = isDark ? "#60a5fa" : "#2563eb";
  const dimColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const distantNodeColor = isDark ? "#4b5563" : "#9ca3af";
  const pathColor = "#22c55e";
  const collectionColor = "#a855f7";
  const bgColor = "rgba(0,0,0,0)";
  const textColor = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)";
  const distantTextColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

  const isRingMode = collectionNodes.length > 0 && !activePath && !selectedNodeId;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-background">

      <div className={`absolute top-4 left-4 z-20 flex flex-col gap-4 ${selectedNodeId ? "hidden md:flex" : ""}`}>

        <div className={`relative z-30 bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl transition-all duration-500 ease-in-out ${isPanelOpen ? "w-64 md:w-80" : "w-12"}`}>
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className={`w-full flex items-center py-3 text-left outline-none whitespace-nowrap overflow-hidden transition-all duration-500 ${isPanelOpen ? "justify-start px-4" : "justify-center px-0"}`}
          >
            <span className={`material-symbols-rounded text-lg shrink-0 transition-transform duration-300 ${isPanelOpen ? "rotate-90 text-green-500" : "text-foreground"}`}>
              directions
            </span>
            <span className={`text-sm font-bold tracking-tight transition-all duration-500 ${isPanelOpen ? "opacity-100 max-w-[200px] ml-2" : "opacity-0 max-w-0 ml-0"}`}>
              Pathfinder
            </span>

            {!isPanelOpen && activePath && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </button>

          <div className={`transition-all duration-500 ease-in-out ${isPanelOpen ? "max-h-[500px] opacity-100 border-t border-border/50 overflow-visible" : "max-h-0 opacity-0 border-t-0 overflow-hidden"}`}>
            <div className="p-4 flex flex-col gap-4 min-w-[250px]">
              
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-sm font-medium text-muted-foreground ml-1">Source Tracker</label>
                <input
                  type="text"
                  placeholder="Select source"
                  className="w-full bg-foreground/5 border border-border/30 rounded-md text-sm p-2.5 outline-none focus:border-green-500/50 transition-colors"
                  value={pathStartInput}
                  onFocus={() => setShowPathStartSug(true)}
                  onChange={(e) => {
                    setPathStartInput(e.target.value);
                    setPathStart(""); 
                    setShowPathStartSug(true);
                    setPathStartActiveIndex(-1);
                  }}
                  onKeyDown={handlePathStartKeyDown}
                />
                
                {showPathStartSug && getSuggestions(pathStartInput).length > 0 && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowPathStartSug(false)} />
                    <div className="absolute top-full left-0 w-full mt-1 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden z-40 max-h-40 overflow-y-auto p-1" ref={pathStartListRef}>
                      {getSuggestions(pathStartInput).map((item, i) => (
                        <div
                          key={i}
                          className={`px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors text-foreground/90 font-medium flex items-center justify-between ${i === pathStartActiveIndex
                            ? 'bg-foreground/10'
                            : 'hover:bg-foreground/5'
                          }`}
                          onClick={() => handlePathStartSelect(item)}
                        >
                          <span>{item}</span>
                          <span className="text-[10px] text-foreground/40 font-semibold">{getAbbr(item)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-1.5 relative">
                <label className="text-sm font-medium text-muted-foreground ml-1">Target Tracker</label>
                <input
                  type="text"
                  placeholder="Select target"
                  className="w-full bg-foreground/5 border border-border/30 rounded-md text-sm p-2.5 outline-none focus:border-green-500/50 transition-colors"
                  value={pathEndInput}
                  onFocus={() => setShowPathEndSug(true)}
                  onChange={(e) => {
                    setPathEndInput(e.target.value);
                    setPathEnd("");
                    setShowPathEndSug(true);
                    setPathEndActiveIndex(-1);
                  }}
                  onKeyDown={handlePathEndKeyDown}
                />
                
                {showPathEndSug && getSuggestions(pathEndInput).length > 0 && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowPathEndSug(false)} />
                    <div className="absolute top-full left-0 w-full mt-1 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden z-40 max-h-40 overflow-y-auto p-1" ref={pathEndListRef}>
                      {getSuggestions(pathEndInput).map((item, i) => (
                        <div
                          key={i}
                          className={`px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors text-foreground/90 font-medium flex items-center justify-between ${i === pathEndActiveIndex
                            ? 'bg-foreground/10'
                            : 'hover:bg-foreground/5'
                          }`}
                          onClick={() => handlePathEndSelect(item)}
                        >
                          <span>{item}</span>
                          <span className="text-[10px] text-foreground/40 font-semibold">{getAbbr(item)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {pathStart && pathEnd && !activePath && (
                <div className="text-sm text-red-500 font-medium text-center py-1">
                  No path found
                </div>
              )}
              {pathStart && pathEnd && activePath && (
                <div className="text-sm text-green-500 font-medium text-center py-1 flex items-center justify-center gap-1.5">
                  <span className="material-symbols-rounded text-base">check_circle</span>
                  Path found ({activePath.length - 1} steps)
                </div>
              )}

              {(pathStart || pathEnd || pathStartInput || pathEndInput) && (
                <button
                  onClick={() => { 
                    setPathStart(""); setPathEnd(""); 
                    setPathStartInput(""); setPathEndInput(""); 
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground underline decoration-dotted mt-1 self-center"
                >
                  Clear path
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={`relative z-20 bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl transition-all duration-500 ease-in-out ${isCollectionPanelOpen ? "w-64 md:w-80" : "w-12"}`}>
          <button
            onClick={() => setIsCollectionPanelOpen(!isCollectionPanelOpen)}
            className={`w-full flex items-center py-3 text-left outline-none whitespace-nowrap overflow-hidden transition-all duration-500 ${isCollectionPanelOpen ? "justify-start px-4" : "justify-center px-0"}`}
          >
            <span className={`material-symbols-rounded text-lg shrink-0 transition-transform duration-300 ${isCollectionPanelOpen ? "rotate-90 text-purple-500" : "text-foreground"}`}>
              bookmarks
            </span>
            <span className={`text-sm font-bold tracking-tight transition-all duration-500 ${isCollectionPanelOpen ? "opacity-100 max-w-[200px] ml-2" : "opacity-0 max-w-0 ml-0"}`}>
              Collection
            </span>

            {!isCollectionPanelOpen && collectionNodes.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            )}
          </button>

          <div className={`transition-all duration-500 ease-in-out ${isCollectionPanelOpen ? "max-h-[500px] opacity-100 border-t border-border/50 overflow-visible" : "max-h-0 opacity-0 border-t-0 overflow-hidden"}`}>
            <div className="p-4 flex flex-col gap-4 min-w-[250px]">
              <div className="flex flex-col gap-1.5 relative" ref={collectionWrapperRef}>
                <label className="text-sm font-medium text-muted-foreground ml-1">My Trackers</label>
                <input
                  type="text"
                  placeholder="Type to add (e.g. RED)"
                  className="w-full bg-foreground/5 border border-border/30 rounded-md text-sm p-2.5 outline-none focus:border-purple-500/50 transition-colors"
                  value={collectionInput}
                  onFocus={() => setShowCollectionSug(true)}
                  onChange={(e) => {
                    setCollectionInput(e.target.value);
                    setShowCollectionSug(true);
                    setCollectionActiveIndex(-1);
                  }}
                  onKeyDown={handleCollectionKeyDown}
                />

                {showCollectionSug && getSuggestions(collectionInput).length > 0 && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowCollectionSug(false)} />
                    <div className="absolute top-full left-0 w-full mt-1 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden z-40 max-h-40 overflow-y-auto p-1" ref={collectionListRef}>
                      {getSuggestions(collectionInput).map((item, i) => (
                        <div
                          key={i}
                          className={`px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors text-foreground/90 font-medium flex items-center justify-between ${i === collectionActiveIndex
                            ? 'bg-foreground/10'
                            : 'hover:bg-foreground/5'
                          }`}
                          onClick={() => handleCollectionSelect(item)}
                        >
                          <span>{item}</span>
                          <span className="text-[10px] text-foreground/40 font-semibold">{getAbbr(item)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {collectionNodes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {collectionNodes.map((node) => (
                    <button 
                      key={node} 
                      onClick={() => removeCollectionItem(node)}
                      className="px-2.5 py-1 rounded-md text-sm font-medium bg-purple-500/10 hover:bg-red-500/10 text-purple-600 dark:text-purple-400 hover:text-red-600 dark:hover:text-red-400 border border-purple-500/20 hover:border-red-500/20 transition-colors cursor-pointer"
                      title="Remove from collection"
                    >
                      {node}
                    </button>
                  ))}
                </div>
              )}

              {collection && (
                <button
                  onClick={() => {
                    setCollection("");
                    localStorage.removeItem("tracker-collection");
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground underline decoration-dotted mt-1 self-center"
                >
                  Clear collection
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 cursor-move">
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={data}
          backgroundColor={bgColor}

          nodeColor={(node: any) => {
            if (activePath) {
              return activePath.includes(node.id) ? pathColor : dimColor;
            }
            if (selectedNodeId) {
              return node.id === selectedNodeId || rawData.routeInfo[selectedNodeId]?.[node.id] || rawData.routeInfo[node.id]?.[selectedNodeId]
                ? defaultNodeColor
                : dimColor;
            }

            if (isRingMode) {
              if (collectionNodes.includes(node.id)) return collectionColor;
              if (collectionNeighbors.has(node.id)) return defaultNodeColor;
              return distantNodeColor;
            }

            if (collectionNodes.includes(node.id)) return collectionColor;
            return defaultNodeColor;
          }}

          nodeLabel="id"
          nodeRelSize={6}

          linkColor={(link: any) => {
            if (activePath) {
              const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              const sourceIndex = activePath.indexOf(sourceId);
              if (sourceIndex !== -1 && activePath[sourceIndex + 1] === targetId) return pathColor;
              return dimColor;
            }
            if (selectedNodeId) return dimColor;

            if (isRingMode) {
              const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              const isSourceRel = collectionNodes.includes(sourceId) || collectionNeighbors.has(sourceId);
              const isTargetRel = collectionNodes.includes(targetId) || collectionNeighbors.has(targetId);

              if (isSourceRel && isTargetRel) return isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";
              return isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
            }

            return isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";
          }}

          linkWidth={(link: any) => {
            if (activePath) {
              const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              const sourceIndex = activePath.indexOf(sourceId);
              if (sourceIndex !== -1 && activePath[sourceIndex + 1] === targetId) return 3;
            }
            return 1;
          }}

          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.1}

          onNodeClick={(node: any) => {
            if (activePath) return;
            setSelectedNodeId(node.id);
            fgRef.current.centerAt(node.x, node.y, 1000);
            fgRef.current.zoom(2.5, 2000);
          }}

          onBackgroundClick={() => setSelectedNodeId(null)}

          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.id;
            const fontSize = 12 / globalScale;

            const isDimmed = activePath && !activePath.includes(node.id);
            const isPathNode = activePath && activePath.includes(node.id);
            const isCollectionNode = !activePath && collectionNodes.includes(node.id);
            const isRingNeighbor = isRingMode && collectionNeighbors.has(node.id);
            const isRingDistant = isRingMode && !isCollectionNode && !isRingNeighbor;

            ctx.globalAlpha = isDimmed ? 0.1 : 1;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);

            if (isPathNode) ctx.fillStyle = pathColor;
            else if (isCollectionNode) ctx.fillStyle = collectionColor;
            else if (isRingDistant) ctx.fillStyle = distantNodeColor;
            else ctx.fillStyle = defaultNodeColor;

            ctx.fill();
            ctx.globalAlpha = 1;

            if (globalScale > 1.5 || isPathNode || isCollectionNode || isRingNeighbor) {
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';

              if (isPathNode) {
                ctx.fillStyle = isDark ? "#fff" : "#000";
                ctx.font = `bold ${fontSize * 1.2}px ${fontFace}`;
              } else if (isCollectionNode) {
                ctx.fillStyle = collectionColor;
                ctx.font = `500 ${fontSize}px ${fontFace}`;
              } else if (isRingDistant) {
                ctx.fillStyle = distantTextColor;
                ctx.font = `500 ${fontSize}px ${fontFace}`;
              } else if (isDimmed) {
                ctx.fillStyle = "rgba(128,128,128,0.2)";
                ctx.font = `500 ${fontSize}px ${fontFace}`;
              } else {
                ctx.fillStyle = textColor;
                ctx.font = `500 ${fontSize}px ${fontFace}`;
              }
              ctx.fillText(label, node.x, node.y + 8);
            }
          }}
        />
      </div>

      {!activePath && selectedNodeId && selectedNodeDetails && (
        <aside className="absolute top-4 bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-80 flex flex-col rounded-xl bg-card/95 backdrop-blur border border-border/50 z-10 overflow-hidden animate-in slide-in-from-right-10 fade-in duration-300 shadow-lg">
          <div className="flex items-center justify-between p-5 border-b border-border/40 shrink-0">
            <h2 className="text-xl font-bold tracking-tight truncate pr-2">{selectedNodeId}</h2>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="p-1.5 rounded-full transition-opacity opacity-70 hover:opacity-100 hover:bg-foreground/5"
            >
              <span className="material-symbols-rounded text-lg">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {Object.keys(selectedNodeDetails.outgoing).length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="material-symbols-rounded text-base">arrow_outward</span>
                  Can invite to ({Object.keys(selectedNodeDetails.outgoing).length})
                </h3>
                <div className="space-y-3">
                  {Object.entries(selectedNodeDetails.outgoing).map(([target, info]: [string, any]) => (
                    <div key={target} className="p-4 rounded-xl bg-foreground/5 border border-border/30">
                      <div className="font-bold text-base mb-1">{target}</div>
                      <div className="text-sm text-muted-foreground leading-relaxed">
                        {info.reqs || "No specific requirements."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(selectedNodeDetails.incoming).length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="material-symbols-rounded text-base rotate-180">arrow_outward</span>
                  Recruited from ({Object.keys(selectedNodeDetails.incoming).length})
                </h3>
                <div className="space-y-3">
                  {Object.entries(selectedNodeDetails.incoming).map(([source, info]: [string, any]) => (
                    <div key={source} className="p-4 rounded-xl bg-foreground/5 border border-border/30">
                      <div className="font-bold text-base mb-1">{source}</div>
                      <div className="text-sm text-muted-foreground leading-relaxed">
                        {info.reqs || "No specific requirements."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(selectedNodeDetails.outgoing).length === 0 && Object.keys(selectedNodeDetails.incoming).length === 0 && (
              <p className="text-sm text-muted-foreground italic">No route data available.</p>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}