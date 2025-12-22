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

  const allTrackerNames = useMemo(() => {
    return data.nodes.map(n => n.id).sort();
  }, [data]);

  const isDark = resolvedTheme === "dark";
  const defaultNodeColor = isDark ? "#60a5fa" : "#2563eb";
  const dimColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const pathColor = "#22c55e"; 
  const bgColor = "rgba(0,0,0,0)";
  const textColor = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)";

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-background">
      
      <div 
        className={`absolute top-4 left-4 z-20 bg-card border border-border/50 rounded-xl overflow-hidden transition-all duration-500 ease-in-out ${
          isPanelOpen ? "w-64 md:w-80" : "w-[135px]"
        } ${selectedNodeId ? "hidden md:block" : ""}`}
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
          className={`overflow-hidden transition-all duration-500 ease-in-out ${
            isPanelOpen ? "max-h-[500px] opacity-100 border-t border-border/50" : "max-h-0 opacity-0 border-t-0"
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
              
              ctx.globalAlpha = isDimmed ? 0.1 : 1;

              ctx.beginPath();
              ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
              ctx.fillStyle = isPathNode ? pathColor : defaultNodeColor;
              ctx.fill();

              ctx.globalAlpha = 1; 

              if (globalScale > 1.5 || isPathNode) {
                ctx.font = `500 ${fontSize}px ${fontFace}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                if (isPathNode) {
                    ctx.fillStyle = isDark ? "#fff" : "#000";
                    ctx.font = `bold ${fontSize * 1.2}px ${fontFace}`;
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