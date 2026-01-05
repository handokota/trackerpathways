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

  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);

  const allTrackerNames = useMemo(() => {
    // Determine sort based on graph data or rawData
    return data.nodes.map(n => n.id).sort((a: string, b: string) => a.localeCompare(b));
  }, [data]);

  // Collection State
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
      setCollectionInput(savedCollection);
    }
  }, []);

  const updateCollection = (newValue: string) => {
    setCollection(newValue);
    setCollectionInput(newValue);
    localStorage.setItem("tracker-collection", newValue);
  };

  const collectionNodes = useMemo(() => {
    return collection.split(",").map(s => s.trim()).filter(s => s && allTrackerNames.includes(s));
  }, [collection, allTrackerNames]);

  // Compute neighbors of the collection
  const collectionNeighbors = useMemo(() => {
    if (collectionNodes.length === 0) return new Set<string>();
    const neighbors = new Set<string>();

    collectionNodes.forEach(nodeId => {
      const outgoing = rawData.routeInfo[nodeId];
      if (outgoing) Object.keys(outgoing).forEach(target => neighbors.add(target));

      // Also check incoming if we want bidirectional neighborhood (usually graph visualization implies undirected or we care about connectivity)
      // Checking rawData for incoming is expensive if not pre-calculated. 
      // However, `data.links` contains all connections. Let's use `data.links`.
    });

    // Efficient lookup using data.links
    data.links.forEach((link: any) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      if (collectionNodes.includes(sourceId)) neighbors.add(targetId);
      if (collectionNodes.includes(targetId)) neighbors.add(sourceId);
    });

    // Remove collection nodes themselves from neighbors set
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
    const terms = collectionInput.split(",");
    terms.pop();
    terms.push(selectedItem);
    const newValue = terms.join(", ") + ", ";
    setCollectionInput(newValue);
    setCollection(newValue);
    localStorage.setItem("tracker-collection", newValue);
    setShowCollectionSug(false);
    setCollectionActiveIndex(-1);
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

  const isDark = resolvedTheme === "dark";
  const defaultNodeColor = isDark ? "#60a5fa" : "#2563eb";
  const dimColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const distantNodeColor = isDark ? "#4b5563" : "#9ca3af"; // Dark Gray / Gray for distant nodes
  const pathColor = "#22c55e";
  const collectionColor = "#a855f7"; // Purple
  const bgColor = "rgba(0,0,0,0)";
  const textColor = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)";
  const distantTextColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

  // Check if rings mode is active (collection exists and no path selected)
  const isRingMode = collectionNodes.length > 0 && !activePath && !selectedNodeId;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-background">

      {/* Panel Container */}
      <div className={`absolute top-4 left-4 z-20 flex flex-col gap-4 ${selectedNodeId ? "hidden md:flex" : ""}`}>

        {/* Pathfinder Panel */}
        <div
          className={`bg-card border border-border/50 rounded-xl overflow-hidden transition-all duration-500 ease-in-out ${isPanelOpen ? "w-64 md:w-80" : "w-[135px]"}`}
        >
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left outline-none whitespace-nowrap"
          >
            <span className={`material-symbols-rounded text-lg transition-transform duration-300 ${isPanelOpen ? "rotate-90 text-primary" : "text-foreground"}`}>
              directions
            </span>
            <span className="text-sm font-bold tracking-tight flex-1">Pathfinder</span>

            {!isPanelOpen && activePath && (
              <span className="w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse"></span>
            )}
          </button>

          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${isPanelOpen ? "max-h-[500px] opacity-100 border-t border-border/50" : "max-h-0 opacity-0 border-t-0"
              }`}
          >
            <div className="p-4 flex flex-col gap-4 min-w-[250px]">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-muted-foreground ml-1">Source Tracker</label>
                <select
                  className="w-full bg-foreground/5 border border-border/30 rounded-md text-sm p-2.5"
                  value={pathStart}
                  onChange={(e) => setPathStart(e.target.value)}
                >
                  <option value="">Select source</option>
                  {allTrackerNames.map(name => (
                    <option key={`start-${name}`} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-muted-foreground ml-1">Target Tracker</label>
                <select
                  className="w-full bg-foreground/5 border border-border/30 rounded-md text-sm p-2.5"
                  value={pathEnd}
                  onChange={(e) => setPathEnd(e.target.value)}
                >
                  <option value="">Select target</option>
                  {allTrackerNames.map(name => (
                    <option key={`end-${name}`} value={name}>{name}</option>
                  ))}
                </select>
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

              {(pathStart || pathEnd) && (
                <button
                  onClick={() => { setPathStart(""); setPathEnd(""); }}
                  className="text-sm text-muted-foreground hover:text-foreground underline decoration-dotted mt-1"
                >
                  Clear path
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Collection Panel */}
        <div
          className={`bg-card border border-border/50 rounded-xl overflow-hidden transition-all duration-500 ease-in-out ${isCollectionPanelOpen ? "w-64 md:w-80" : "w-[130px]"}`}
        >
          <button
            onClick={() => setIsCollectionPanelOpen(!isCollectionPanelOpen)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left outline-none whitespace-nowrap"
          >
            <span className={`material-symbols-rounded text-lg transition-transform duration-300 ${isCollectionPanelOpen ? "rotate-90 text-purple-500" : "text-foreground"}`}>
              bookmarks
            </span>
            <span className="text-sm font-bold tracking-tight flex-1">Collection</span>

            {!isCollectionPanelOpen && collectionNodes.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-purple-500 mr-1 animate-pulse"></span>
            )}
          </button>

          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${isCollectionPanelOpen ? "max-h-[500px] opacity-100 border-t border-border/50" : "max-h-0 opacity-0 border-t-0"
              }`}
          >
            <div className="p-4 flex flex-col gap-4 min-w-[250px]">
              <div className="flex flex-col gap-1.5 relative" ref={collectionWrapperRef}>
                <label className="text-sm font-medium text-muted-foreground ml-1">My Trackers</label>
                <input
                  type="text"
                  placeholder="e.g. RED, PTP, MAM"
                  className="w-full bg-foreground/5 border border-border/30 rounded-md text-sm p-2.5 outline-none focus:border-purple-500/50 transition-colors"
                  value={collectionInput}
                  onFocus={() => setShowCollectionSug(true)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCollectionInput(val);
                    setCollection(val);
                    localStorage.setItem("tracker-collection", val);
                    setShowCollectionSug(true);
                    setCollectionActiveIndex(-1);
                  }}
                  onKeyDown={handleCollectionKeyDown}
                />

                {showCollectionSug && getSuggestions(collectionInput).length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-card border border-border/50 rounded-md shadow-lg overflow-hidden z-50 max-h-40 overflow-y-auto" ref={collectionListRef}>
                    {getSuggestions(collectionInput).map((item, i) => (
                      <div
                        key={i}
                        className={`px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between ${i === collectionActiveIndex
                          ? 'bg-purple-500/10 text-purple-500'
                          : 'hover:bg-foreground/5'
                          }`}
                        onClick={() => handleCollectionSelect(item)}
                      >
                        <span>{item}</span>
                        <span className="text-xs text-muted-foreground">{getAbbr(item)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {collectionNodes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {collectionNodes.map((node) => (
                    <span key={node} className="text-xs font-semibold bg-purple-500/10 text-purple-500 px-2 py-1 rounded-md border border-purple-500/20">
                      {node}
                    </span>
                  ))}
                </div>
              )}

              {collection && (
                <button
                  onClick={() => {
                    setCollection("");
                    setCollectionInput("");
                    localStorage.removeItem("tracker-collection");
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground underline decoration-dotted mt-1 self-start"
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

            // Ring Visualization
            if (isRingMode) {
              if (collectionNodes.includes(node.id)) return collectionColor;
              if (collectionNeighbors.has(node.id)) return defaultNodeColor;
              return distantNodeColor;
            }

            if (collectionNodes.includes(node.id)) {
              return collectionColor;
            }
            return defaultNodeColor;
          }}

          nodeLabel="id"
          nodeRelSize={6}

          linkColor={(link: any) => {
            if (activePath) {
              const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;

              const sourceIndex = activePath.indexOf(sourceId);
              if (sourceIndex !== -1 && activePath[sourceIndex + 1] === targetId) {
                return pathColor;
              }
              return dimColor;
            }
            if (selectedNodeId) {
              return dimColor;
            }

            // Ring Link Visualization
            if (isRingMode) {
              const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;

              const isSourceRel = collectionNodes.includes(sourceId) || collectionNeighbors.has(sourceId);
              const isTargetRel = collectionNodes.includes(targetId) || collectionNeighbors.has(targetId);

              // Keep link visible if it connects to the "core" (collection or neighbors)
              // The request said: "If it is further than one hop away... make that second hop line 50% transparent"
              // Interpretation: 
              // Link between Collection <-> Neighbor: Visible
              // Link between Neighbor <-> Distant: Visible? Or Dimmed? 
              // "everything tracker directly conencted to the purple collection tracker, leave it blue." (Nodes)
              // "If it is further than one hop away, make it a darker gray." (Nodes)
              // "make that second hop line 50% transparent" (Links)

              // Logic: If BOTH ends are Distant (Gray), make it very dim.
              // If ONE end is at least Neighbor or Collection, keep it standard (or slightly dimmed?)
              // "second hop line" implies the line leaving the neighbor going outwards.
              // So if Source is Neighbor and Target is Distant -> 50% transparent.

              if (isSourceRel && isTargetRel) {
                return isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"; // Standard visibility
              }

              return isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; // High transparency for distant links
            }

            return isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";
          }}

          linkWidth={(link: any) => {
            if (activePath) {
              const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              const sourceIndex = activePath.indexOf(sourceId);
              if (sourceIndex !== -1 && activePath[sourceIndex + 1] === targetId) {
                return 3;
              }
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

          onBackgroundClick={() => {
            setSelectedNodeId(null);
          }}

          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.id;
            const fontSize = 12 / globalScale;

            const isDimmed = activePath && !activePath.includes(node.id);
            const isPathNode = activePath && activePath.includes(node.id);
            const isCollectionNode = !activePath && collectionNodes.includes(node.id);

            // Ring checks
            const isRingNeighbor = isRingMode && collectionNeighbors.has(node.id);
            const isRingDistant = isRingMode && !isCollectionNode && !isRingNeighbor;

            ctx.globalAlpha = isDimmed ? 0.1 : 1;

            ctx.beginPath();
            ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);

            if (isPathNode) {
              ctx.fillStyle = pathColor;
            } else if (isCollectionNode) {
              ctx.fillStyle = collectionColor;
            } else if (isRingDistant) {
              ctx.fillStyle = distantNodeColor;
            } else {
              ctx.fillStyle = defaultNodeColor;
            }

            ctx.fill();

            ctx.globalAlpha = 1;

            if (globalScale > 1.5 || isPathNode || isCollectionNode || isRingNeighbor) {
              ctx.font = `500 ${fontSize}px ${fontFace}`;
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
              } else if (isDimmed) {
                ctx.fillStyle = "rgba(128,128,128,0.2)";
              } else {
                ctx.fillStyle = textColor;
              }

              ctx.fillText(label, node.x, node.y + 8);
            }
          }}
        />
      </div>

      {!activePath && selectedNodeId && selectedNodeDetails && (
        <aside className="absolute top-4 bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-80 flex flex-col rounded-xl bg-card border border-border/50 z-10 overflow-hidden animate-in slide-in-from-right-10 fade-in duration-300">

          <div className="flex items-center justify-between p-5 border-b border-border/40 shrink-0">
            <h2 className="text-xl font-bold tracking-tight truncate pr-2">{selectedNodeId}</h2>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="p-1.5 rounded-full transition-opacity opacity-70 hover:opacity-100"
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