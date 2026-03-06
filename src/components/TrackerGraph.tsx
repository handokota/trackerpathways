"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { DataStructure, RouteDetail } from "@/types";
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

interface CollectionPathOption {
  id: string;
  source: string;
  nodes: string[];
  totalDays: number | null;
  stepDays: Array<number | null>;
}

interface UnlockRequirementSection {
  key: string;
  rank: string;
  requirements: string[];
  requirementText: string;
  ageText: string | null;
}

interface OfficialInviteEntry {
  tracker: string;
  details: RouteDetail;
  officialInvites: number;
}

type OfficialInvitesTab = "canInviteTo" | "invitedFrom";
type DialogSortByOption = "officialInvites" | "unlockAfter";
type SortDirection = "asc" | "desc";

interface OfficialInvitesPanelData {
  sourceName: string;
  unlockDays: number | null;
  sections: UnlockRequirementSection[];
  canInviteTo: OfficialInviteEntry[];
  invitedFrom: OfficialInviteEntry[];
}

export default function TrackerGraph({ data, rawData }: TrackerGraphProps) {
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [fontFace, setFontFace] = useState("sans-serif");

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [officialInvitesTab, setOfficialInvitesTab] = useState<OfficialInvitesTab>("canInviteTo");
  const [officialInvitesSortBy, setOfficialInvitesSortBy] = useState<DialogSortByOption>("officialInvites");
  const [officialInvitesSortDirection, setOfficialInvitesSortDirection] = useState<SortDirection>("desc");
  const [isUnlockAccordionOpen, setIsUnlockAccordionOpen] = useState(true);
  const [expandedOfficialInviteCards, setExpandedOfficialInviteCards] = useState<Record<string, boolean>>({});
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [pathStart, setPathStart] = useState<string>("");
  const [pathEnd, setPathEnd] = useState<string>("");
  const [activePath, setActivePath] = useState<string[] | null>(null);
  const [pathSortBy, setPathSortBy] = useState<"jumps" | "days">("jumps");
  const [useCollectionAsSource, setUseCollectionAsSource] = useState(false);
  const [selectedCollectionPathId, setSelectedCollectionPathId] = useState<string | null>(null);

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

  const getCollectionPathId = (source: string, nodes: string[]) => `${source}>${nodes.join(">")}`;

  const collectionPathOptions = useMemo<CollectionPathOption[]>(() => {
    if (!useCollectionAsSource || !pathEnd || collectionNodes.length === 0) {
      return [];
    }

    const timedPaths: CollectionPathOption[] = [];

    for (const source of collectionNodes) {
      if (source === pathEnd) {
        continue;
      }

      const nodes = findShortestPath(rawData, source, pathEnd);
      if (!nodes || nodes.length < 2) {
        continue;
      }

      let totalDays: number | null = 0;
      const stepDays: Array<number | null> = [];

      for (let index = 0; index < nodes.length - 1; index += 1) {
        const fromNode = nodes[index];
        const toNode = nodes[index + 1];
        const route = rawData.routeInfo[fromNode]?.[toNode];
        const routeDays = route?.days;
        const unlockDays = rawData.unlockInviteClass[fromNode]?.[0] ?? 0;

        if (routeDays === null || routeDays === undefined) {
          stepDays.push(null);
          totalDays = null;
          continue;
        }

        const stepTime = Math.max(routeDays, unlockDays);
        stepDays.push(stepTime);
        if (totalDays !== null) {
          totalDays += stepTime;
        }
      }

      timedPaths.push({
        id: getCollectionPathId(source, nodes),
        source,
        nodes,
        totalDays,
        stepDays,
      });
    }

    return timedPaths.sort((a, b) => {
      if (pathSortBy === "days") {
        if (a.totalDays === null && b.totalDays !== null) return 1;
        if (a.totalDays !== null && b.totalDays === null) return -1;
        if (a.totalDays !== null && b.totalDays !== null && a.totalDays !== b.totalDays) {
          return a.totalDays - b.totalDays;
        }
      }

      const hopsA = a.nodes.length - 1;
      const hopsB = b.nodes.length - 1;
      if (hopsA !== hopsB) {
        return hopsA - hopsB;
      }

      return a.source.localeCompare(b.source);
    });
  }, [collectionNodes, pathEnd, pathSortBy, rawData, useCollectionAsSource]);

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
    if (useCollectionAsSource) {
      setPathStart("");
      setPathStartInput("");
      setShowPathStartSug(false);
      setPathStartActiveIndex(-1);
    }
  }, [useCollectionAsSource]);

  useEffect(() => {
    if (!useCollectionAsSource) {
      return;
    }

    if (collectionPathOptions.length === 0) {
      setSelectedCollectionPathId(null);
      return;
    }

    if (
      selectedCollectionPathId
      && collectionPathOptions.some((path) => path.id === selectedCollectionPathId)
    ) {
      return;
    }

    setSelectedCollectionPathId(collectionPathOptions[0].id);
  }, [collectionPathOptions, selectedCollectionPathId, useCollectionAsSource]);

  useEffect(() => {
    if (useCollectionAsSource) {
      const selectedCollectionPath = collectionPathOptions.find((path) => path.id === selectedCollectionPathId);
      setActivePath(selectedCollectionPath?.nodes || null);
      setSelectedNodeId(null);
      return;
    }

    if (pathStart && pathEnd) {
      const path = findShortestPath(rawData, pathStart, pathEnd);
      setActivePath(path);
      setSelectedNodeId(null);
      return;
    }

    setActivePath(null);
  }, [
    collectionPathOptions,
    pathEnd,
    pathStart,
    rawData,
    selectedCollectionPathId,
    useCollectionAsSource,
  ]);

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

  const activeInviteCountBySource = useMemo(() => {
    const counts: { [key: string]: number } = {};
    Object.keys(rawData.routeInfo).forEach(sourceName => {
      counts[sourceName] = Object.values(rawData.routeInfo[sourceName] || {})
        .filter(route => route.active.toLowerCase() === "yes")
        .length;
    });
    return counts;
  }, [rawData]);

  const parseRequirementSections = (text: string, keyPrefix: string): UnlockRequirementSection[] => {
    if (!text.trim()) {
      return [];
    }

    return text
      .replace(
        /(\d+(?:\.\d+)?\s*(?:years?|yrs?|y|months?|mos?|weeks?|w|days?|d)\b)\s+or\s+([A-Za-z_+\- ]+),\s*(\d+(?:\.\d+)?\s*(?:years?|yrs?|y|months?|mos?|weeks?|w|days?|d)\b)/gi,
        "$1; $2: $3"
      )
      .replace(/,?\s*or\s+([A-Za-z0-9_+\- ]+):/gi, "; $1:")
      .split(";")
      .map(part => part.trim())
      .filter(part => part.length > 0)
      .map((part, index) => {
        const rankMatch = part.match(/^([A-Za-z0-9_+\- ]{1,40}):\s+(.+)$/);
        const potentialRank = rankMatch?.[1].trim() || "";
        const isRankPrefix = Boolean(
          rankMatch
          && potentialRank.split(/\s+/).length <= 4
          && !/requirements?/i.test(potentialRank)
        );
        const rank = isRankPrefix ? potentialRank : "";
        const requirementText = isRankPrefix && rankMatch ? rankMatch[2].trim() : part;

        const rawRequirements = requirementText
          .split(",")
          .map(item => item.trim())
          .filter(item => item.length > 0);

        let ageText = null;
        let updatedRequirementText = requirementText;

        const ageIndex = rawRequirements.findIndex(req =>
          /(?:year|month|week|day)s?|\b\d+d\b/i.test(req) &&
          !/(seedtime|seed size|seedsize|upload|ratio|adoptions|bp|torrents|seeds|bonus)/i.test(req)
        );

        const requirements = [...rawRequirements];
        if (ageIndex !== -1) {
          ageText = requirements[ageIndex];
          requirements.splice(ageIndex, 1);
          updatedRequirementText = requirements.join(", ");
        }

        return {
          key: `${keyPrefix}-${index}`,
          rank,
          requirements,
          requirementText: updatedRequirementText,
          ageText,
        };
      });
  };

  const parseAgeTextToDays = (ageText: string): number | null => {
    const normalizedAgeText = ageText.toLowerCase();
    let totalDays = 0;
    let matched = false;

    const durationMatches = normalizedAgeText.matchAll(/(\d+(?:\.\d+)?)\s*(years?|yrs?|y|months?|mos?|weeks?|w|days?|d)\b/g);
    for (const match of durationMatches) {
      const value = Number.parseFloat(match[1]);
      if (Number.isNaN(value)) {
        continue;
      }

      const unit = match[2];
      matched = true;
      if (unit.startsWith("y")) {
        totalDays += value * 365;
      } else if (unit.startsWith("mo") || unit.startsWith("month")) {
        totalDays += value * 30;
      } else if (unit.startsWith("w")) {
        totalDays += value * 7;
      } else {
        totalDays += value;
      }
    }

    if (!matched) {
      return null;
    }

    return Math.round(totalDays);
  };

  const getInviteUnlockAfterDays = (invite: OfficialInviteEntry, keyPrefix: string): number | null => {
    const requirementSections = parseRequirementSections(invite.details.reqs || "", keyPrefix);
    const unlockAfterDays = requirementSections
      .map((section) => section.ageText ? parseAgeTextToDays(section.ageText) : null)
      .filter((days): days is number => days !== null);

    if (unlockAfterDays.length === 0) {
      return null;
    }

    return Math.min(...unlockAfterDays);
  };

  const getUnlockRequirementSections = (sourceName: string): UnlockRequirementSection[] => {
    const unlockInfo = rawData.unlockInviteClass[sourceName];
    if (!unlockInfo) {
      return [];
    }

    return parseRequirementSections(unlockInfo[1], sourceName);
  };

  const selectedNodeOfficialData: OfficialInvitesPanelData | null = selectedNodeId ? (() => {
    const unlockInfo = rawData.unlockInviteClass[selectedNodeId];
    const canInviteTo = Object.entries(rawData.routeInfo[selectedNodeId] || {})
      .filter(([, route]) => route.active.toLowerCase() === "yes")
      .map(([target, details]) => ({
        tracker: target,
        details,
        officialInvites: activeInviteCountBySource[target] || 0,
      }))
      .sort((a, b) => {
        if (a.officialInvites !== b.officialInvites) {
          return b.officialInvites - a.officialInvites;
        }
        return a.tracker.localeCompare(b.tracker);
      });

    const invitedFrom = Object.entries(rawData.routeInfo)
      .filter(([, routes]) => routes[selectedNodeId]?.active.toLowerCase() === "yes")
      .map(([tracker, routes]) => ({
        tracker,
        details: routes[selectedNodeId] as RouteDetail,
        officialInvites: activeInviteCountBySource[tracker] || 0,
      }))
      .sort((a, b) => {
        if (a.officialInvites !== b.officialInvites) {
          return b.officialInvites - a.officialInvites;
        }
        return a.tracker.localeCompare(b.tracker);
      });

    return {
      sourceName: selectedNodeId,
      unlockDays: unlockInfo?.[0] ?? null,
      sections: getUnlockRequirementSections(selectedNodeId),
      canInviteTo,
      invitedFrom,
    };
  })() : null;

  const sortedPanelInvites = useMemo(() => {
    if (!selectedNodeOfficialData) {
      return [];
    }

    const currentInvites = officialInvitesTab === "canInviteTo"
      ? selectedNodeOfficialData.canInviteTo
      : selectedNodeOfficialData.invitedFrom;
    const unlockAfterCache: { [key: string]: number | null } = {};
    const getCachedUnlockAfterDays = (invite: OfficialInviteEntry) => {
      if (invite.tracker in unlockAfterCache) {
        return unlockAfterCache[invite.tracker];
      }

      const unlockAfterDays = getInviteUnlockAfterDays(
        invite,
        `${selectedNodeOfficialData.sourceName}-${invite.tracker}-${officialInvitesTab}-sort`
      );
      unlockAfterCache[invite.tracker] = unlockAfterDays;
      return unlockAfterDays;
    };

    return [...currentInvites].sort((a, b) => {
      if (officialInvitesSortBy === "unlockAfter") {
        const aUnlockAfterDays = getCachedUnlockAfterDays(a);
        const bUnlockAfterDays = getCachedUnlockAfterDays(b);

        if (aUnlockAfterDays === null && bUnlockAfterDays !== null) {
          return 1;
        }
        if (aUnlockAfterDays !== null && bUnlockAfterDays === null) {
          return -1;
        }
        if (
          aUnlockAfterDays !== null
          && bUnlockAfterDays !== null
          && aUnlockAfterDays !== bUnlockAfterDays
        ) {
          return aUnlockAfterDays - bUnlockAfterDays;
        }
      }

      if (a.officialInvites !== b.officialInvites) {
        return b.officialInvites - a.officialInvites;
      }

      return a.tracker.localeCompare(b.tracker);
    });
  }, [officialInvitesSortBy, officialInvitesTab, selectedNodeOfficialData]);

  const setDialogTrackerInUrl = (trackerName: string | null, method: "push" | "replace" = "push") => {
    const params = new URLSearchParams(searchParams.toString());
    if (trackerName) {
      params.set("tracker", trackerName);
    } else {
      params.delete("tracker");
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    if (method === "replace") {
      router.replace(nextUrl, { scroll: false });
      return;
    }

    router.push(nextUrl, { scroll: false });
  };

  useEffect(() => {
    if (activePath) {
      return;
    }

    const trackerParam = searchParams.get("tracker");
    if (!trackerParam) {
      if (selectedNodeId !== null) {
        setSelectedNodeId(null);
      }
      return;
    }

    const targetNode = data.nodes.find((node) => node.id === trackerParam);
    if (!targetNode) {
      if (selectedNodeId !== null) {
        setSelectedNodeId(null);
      }
      setDialogTrackerInUrl(null, "replace");
      return;
    }

    if (selectedNodeId === trackerParam) {
      return;
    }

    setOfficialInvitesTab("canInviteTo");
    setOfficialInvitesSortBy("officialInvites");
    setIsUnlockAccordionOpen(true);
    setExpandedOfficialInviteCards({});
    setSelectedNodeId(trackerParam);
    if (
      typeof targetNode.x === "number"
      && typeof targetNode.y === "number"
      && fgRef.current
    ) {
      fgRef.current.centerAt(targetNode.x, targetNode.y, 1000);
      fgRef.current.zoom(2.5, 2000);
    }
  }, [activePath, data.nodes, searchParams]);

  const getAbbr = (name: string) => {
    if (rawData.abbrList && rawData.abbrList[name]) return rawData.abbrList[name];
    const capitals = name.match(/[A-Z]/g);
    if (capitals && capitals.length >= 2) return capitals.join("");
    return name.substring(0, 3).toUpperCase();
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === "yes" || s === "open") return "text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30";
    if (s === "no" || s === "closed") return "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30";
    return "text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30";
  };

  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === "yes") return "Recruiting";
    if (s === "no") return "Closed";
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
            className="text-blue-500 hover:underline wrap-break-words"
          >
            {part}
          </a>
        );
      }
      return part;
    });
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

  const formatStepDays = (days: number | null) => (days === null ? "?" : `${days}d`);

  const selectedCollectionPath = useMemo(
    () => collectionPathOptions.find((path) => path.id === selectedCollectionPathId) || null,
    [collectionPathOptions, selectedCollectionPathId]
  );

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

        <div className={`relative z-30 bg-card/90 backdrop-blur border border-foreground/10 rounded-xl transition-all duration-500 ease-in-out ${isPanelOpen ? "w-64 md:w-80" : "w-12"}`}>
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className={`w-full flex items-center py-3 text-left outline-none whitespace-nowrap overflow-hidden transition-all duration-500 ${isPanelOpen ? "justify-start px-4" : "justify-center px-0"}`}
          >
            <span className={`material-symbols-rounded text-lg shrink-0 transition-transform duration-300 text-foreground ${isPanelOpen ? "rotate-90" : ""}`}>
              directions
            </span>
            <span className={`text-sm font-bold tracking-tight transition-all duration-500 ${isPanelOpen ? "opacity-100 max-w-[200px] ml-2" : "opacity-0 max-w-0 ml-0"}`}>
              Pathfinder
            </span>

            {!isPanelOpen && activePath && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </button>

          <div className={`transition-all duration-500 ease-in-out ${isPanelOpen ? "max-h-[800px] opacity-100 border-t border-foreground/10 overflow-visible" : "max-h-0 opacity-0 border-t-0 overflow-hidden"}`}>
            <div className="p-4 flex flex-col gap-4 min-w-[250px]">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setUseCollectionAsSource((current) => !current)}
                  disabled={collectionNodes.length === 0}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                    collectionNodes.length === 0
                      ? "cursor-not-allowed opacity-50 bg-foreground/5 text-foreground/70 border-foreground/10"
                      : useCollectionAsSource
                        ? "bg-green-500/15 text-green-600 dark:text-green-300 border-green-500/40"
                        : "bg-foreground/5 text-foreground/70 border-foreground/10 hover:bg-foreground/10 hover:text-foreground"
                  }`}
                >
                  <span className="material-symbols-rounded text-sm">bookmarks</span>
                  Use My Trackers
                </button>

                {useCollectionAsSource && (
                  <div className="grid grid-cols-2 w-[120px] shrink-0 rounded-md bg-foreground/5 p-0.5">
                    <button
                      onClick={() => setPathSortBy("jumps")}
                      className={`text-center px-2 py-1 text-xs rounded-sm transition-colors ${
                        pathSortBy === "jumps"
                          ? "bg-foreground/10 text-foreground"
                          : "text-foreground/60 hover:text-foreground"
                      }`}
                    >
                      Jumps
                    </button>
                    <button
                      onClick={() => setPathSortBy("days")}
                      className={`text-center px-2 py-1 text-xs rounded-sm transition-colors ${
                        pathSortBy === "days"
                          ? "bg-foreground/10 text-foreground"
                          : "text-foreground/60 hover:text-foreground"
                      }`}
                    >
                      Days
                    </button>
                  </div>
                )}
              </div>

              {useCollectionAsSource && collectionNodes.length === 0 && (
                <p className="text-xs text-foreground/50 leading-relaxed">
                  Add trackers in the Collection panel to find routes from your current trackers.
                </p>
              )}
              
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-sm font-medium text-muted-foreground ml-1">Source Tracker</label>
                <input
                  type="text"
                  disabled={useCollectionAsSource}
                  placeholder={useCollectionAsSource ? "Using My Trackers" : "Search starting tracker..."}
                  className={`w-full bg-foreground/5 border border-foreground/10 rounded-md text-sm p-2.5 outline-none transition-colors ${
                    useCollectionAsSource
                      ? "cursor-not-allowed text-foreground/50"
                      : "focus:border-green-500/50"
                  }`}
                  value={useCollectionAsSource ? collectionNodes.join(", ") : pathStartInput}
                  onFocus={() => {
                    if (!useCollectionAsSource) {
                      setShowPathStartSug(true);
                    }
                  }}
                  onChange={(e) => {
                    if (useCollectionAsSource) {
                      return;
                    }
                    setPathStartInput(e.target.value);
                    setPathStart(""); 
                    setShowPathStartSug(true);
                    setPathStartActiveIndex(-1);
                  }}
                  onKeyDown={handlePathStartKeyDown}
                />

                {useCollectionAsSource && (
                  <span className="text-xs text-foreground/50 ml-1">
                    Using {collectionNodes.length} tracker{collectionNodes.length === 1 ? "" : "s"} from collection.
                  </span>
                )}
                
                {!useCollectionAsSource && showPathStartSug && getSuggestions(pathStartInput).length > 0 && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowPathStartSug(false)} />
                    <div className="absolute top-full left-0 w-full mt-1 bg-card border border-foreground/10 rounded-xl overflow-hidden z-40 max-h-40 overflow-y-auto p-1" ref={pathStartListRef}>
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
                  placeholder="Search destination tracker..."
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-md text-sm p-2.5 outline-none focus:border-green-500/50 transition-colors"
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
                    <div className="absolute top-full left-0 w-full mt-1 bg-card border border-foreground/10 rounded-xl overflow-hidden z-40 max-h-40 overflow-y-auto p-1" ref={pathEndListRef}>
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

              {useCollectionAsSource && pathEnd && collectionPathOptions.length === 0 && (
                <div className="text-sm text-red-500 font-medium text-center py-1">
                  No path found from My Trackers
                </div>
              )}
              {useCollectionAsSource && pathEnd && selectedCollectionPath && (
                <div className="text-sm text-green-500 font-medium text-center py-1 flex items-center justify-center gap-1.5">
                  <span className="material-symbols-rounded text-base">check_circle</span>
                  Best route: {collectionPathOptions[0].source} ({collectionPathOptions[0].nodes.length - 1} steps)
                </div>
              )}
              {!useCollectionAsSource && pathStart && pathEnd && !activePath && (
                <div className="text-sm text-red-500 font-medium text-center py-1">
                  No path found
                </div>
              )}
              {!useCollectionAsSource && pathStart && pathEnd && activePath && (
                <div className="text-sm text-green-500 font-medium text-center py-1 flex items-center justify-center gap-1.5">
                  <span className="material-symbols-rounded text-base">check_circle</span>
                  Path found ({activePath.length - 1} steps)
                </div>
              )}

              {useCollectionAsSource && pathEnd && collectionPathOptions.length > 0 && (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                  {collectionPathOptions.map((pathOption, index) => {
                    const isSelected = selectedCollectionPathId === pathOption.id;

                    return (
                      <button
                        key={pathOption.id}
                        onClick={() => setSelectedCollectionPathId(pathOption.id)}
                        className={`shrink-0 rounded-lg border p-2.5 text-left transition-colors ${
                          isSelected
                            ? "border-green-500/40 bg-green-500/10"
                            : "border-foreground/10 bg-foreground/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-xs mb-1">
                          <span className="font-semibold text-foreground">{pathOption.source}</span>
                          <span className="text-foreground/60">{pathOption.nodes.length - 1} hops</span>
                          <span className={pathOption.totalDays === null ? "text-foreground/40" : "text-foreground/70"}>
                            {pathOption.totalDays === null ? "Unknown" : `${pathOption.totalDays}d`}
                          </span>
                        </div>
                        <div className="text-[11px] text-foreground/50 leading-relaxed">
                          {pathOption.nodes.slice(0, -1).map((node, stepIndex) => (
                            <span key={`${pathOption.id}-${node}-${stepIndex}`}>
                              {stepIndex > 0 && " • "}
                              {node}
                              <span className="material-symbols-rounded align-middle text-[11px] mx-0.5">arrow_right_alt</span>
                              {pathOption.nodes[stepIndex + 1]}
                              {" ("}
                              {formatStepDays(pathOption.stepDays[stepIndex] ?? null)}
                              {")"}
                            </span>
                          ))}
                        </div>
                        {index === 0 && (
                          <div className="mt-1 text-[11px] font-medium text-green-600/80 dark:text-green-300/80">
                            Shortest by {pathSortBy === "days" ? "total time" : "hops"}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {(pathStart || pathEnd || pathStartInput || pathEndInput || useCollectionAsSource) && (
                <button
                  onClick={() => { 
                    setPathStart(""); setPathEnd(""); 
                    setPathStartInput(""); setPathEndInput(""); 
                    setSelectedCollectionPathId(null);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground underline decoration-dotted mt-1 self-center"
                >
                  Clear path
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={`relative z-20 bg-card/90 backdrop-blur border border-foreground/10 rounded-xl transition-all duration-500 ease-in-out ${isCollectionPanelOpen ? "w-64 md:w-80" : "w-12"}`}>
          <button
            onClick={() => setIsCollectionPanelOpen(!isCollectionPanelOpen)}
            className={`w-full flex items-center py-3 text-left outline-none whitespace-nowrap overflow-hidden transition-all duration-500 ${isCollectionPanelOpen ? "justify-start px-4" : "justify-center px-0"}`}
          >
            <span className={`material-symbols-rounded text-lg shrink-0 transition-transform duration-300 text-foreground ${isCollectionPanelOpen ? "rotate-90" : ""}`}>
              bookmarks
            </span>
            <span className={`text-sm font-bold tracking-tight transition-all duration-500 ${isCollectionPanelOpen ? "opacity-100 max-w-[200px] ml-2" : "opacity-0 max-w-0 ml-0"}`}>
              Collection
            </span>

            {!isCollectionPanelOpen && collectionNodes.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            )}
          </button>

          <div className={`transition-all duration-500 ease-in-out ${isCollectionPanelOpen ? "max-h-[800px] opacity-100 border-t border-foreground/10 overflow-visible" : "max-h-0 opacity-0 border-t-0 overflow-hidden"}`}>
            <div className="p-4 flex flex-col gap-4 min-w-[250px]">
              <div className="flex flex-col gap-1.5 relative" ref={collectionWrapperRef}>
                <label className="text-sm font-medium text-muted-foreground ml-1">My Trackers</label>
                <input
                  type="text"
                  placeholder="Add tracker to collection..."
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-md text-sm p-2.5 outline-none focus:border-purple-500/50 transition-colors"
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
                    <div className="absolute top-full left-0 w-full mt-1 bg-card border border-foreground/10 rounded-xl overflow-hidden z-40 max-h-40 overflow-y-auto p-1" ref={collectionListRef}>
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
            setOfficialInvitesTab("canInviteTo");
            setOfficialInvitesSortBy("officialInvites");
            setIsUnlockAccordionOpen(true);
            setExpandedOfficialInviteCards({});
            setSelectedNodeId(node.id);
            setDialogTrackerInUrl(node.id);
            fgRef.current.centerAt(node.x, node.y, 1000);
            fgRef.current.zoom(2.5, 2000);
          }}

          onBackgroundClick={() => {
            setSelectedNodeId(null);
            setDialogTrackerInUrl(null);
          }}

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

      {!activePath && selectedNodeOfficialData && (
        <aside className="absolute top-4 bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-[44rem] flex flex-col rounded-xl bg-card/90 backdrop-blur border border-foreground/10 z-10 overflow-hidden animate-in slide-in-from-right-10 fade-in duration-300">
          <div className="flex items-center justify-between p-5 border-b border-foreground/10 shrink-0">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight truncate pr-2">{selectedNodeOfficialData.sourceName}</h2>
              <p className="text-xs text-foreground/60 mt-0.5">Official invite forum and official invites</p>
            </div>
            <button
              onClick={() => {
                setSelectedNodeId(null);
                setDialogTrackerInUrl(null);
              }}
              className="p-1.5 rounded-full transition-opacity opacity-70 hover:opacity-100"
            >
              <span className="material-symbols-rounded text-lg">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
              <button
                type="button"
                onClick={() => setIsUnlockAccordionOpen(current => !current)}
                className="w-full flex items-center justify-between gap-2 text-left text-sm font-semibold text-foreground cursor-pointer"
                aria-expanded={isUnlockAccordionOpen}
              >
                <span>Official invite forum unlock requirements</span>
                <span className={`material-symbols-rounded text-lg text-foreground/60 transition-transform duration-200 ${isUnlockAccordionOpen ? "rotate-180" : ""}`}>
                  keyboard_arrow_down
                </span>
              </button>
              <div
                className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                  isUnlockAccordionOpen ? "grid-rows-[1fr] opacity-100 mt-2.5" : "grid-rows-[0fr] opacity-0 mt-0"
                }`}
              >
                <div className="overflow-hidden space-y-2.5">
                  {selectedNodeOfficialData.unlockDays !== null && (
                    <div className="relative group inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/75 bg-foreground/10 rounded-md px-1.5 py-1">
                      <span className="material-symbols-rounded text-[13px] shrink-0">schedule</span>
                      After {selectedNodeOfficialData.unlockDays} days
                      <span className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 translate-y-2 rounded-md border border-foreground/15 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 whitespace-nowrap opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                        You can join the official invite forum from {selectedNodeOfficialData.sourceName} after {selectedNodeOfficialData.unlockDays} days.
                      </span>
                    </div>
                  )}

                  {selectedNodeOfficialData.sections.length > 0 ? (
                    <div className="space-y-2.5">
                      {selectedNodeOfficialData.sections.map((section, sectionIndex) => (
                        <div key={section.key}>
                          {sectionIndex > 0 && (
                            <div className="flex items-center justify-center my-2">
                              <span className="text-xs font-semibold text-foreground/40 uppercase">or</span>
                            </div>
                          )}
                          <div className="rounded-lg border border-foreground/10 bg-card p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                              {section.rank ? (
                                <h4 className="text-sm font-semibold text-foreground">{section.rank}</h4>
                              ) : (
                                <h4 className="text-sm font-semibold text-foreground">Requirements</h4>
                              )}

                              {section.ageText && (
                                <div className="relative group inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/75 bg-foreground/10 rounded-md px-1.5 py-1 shrink-0 max-w-full">
                                  <span className="material-symbols-rounded text-[13px] shrink-0">schedule</span>
                                  <span className="wrap-break-words text-left leading-tight">
                                    After {section.ageText.trim()}
                                  </span>
                                  <span className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 translate-y-2 rounded-md border border-foreground/15 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 whitespace-nowrap opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                                    You can join the official invite forum from {selectedNodeOfficialData.sourceName} after {section.ageText.trim()}.
                                  </span>
                                </div>
                              )}
                            </div>

                            {section.requirements.length > 0 ? (
                              <ul className="space-y-1.5">
                                {section.requirements.map((requirement, requirementIndex) => (
                                  <li key={`${section.key}-${requirementIndex}`} className="text-sm text-foreground/80 leading-snug flex items-start gap-2">
                                    <span className="mt-[7px] h-1 w-1 rounded-full bg-foreground/45 shrink-0" />
                                    <span className="wrap-break-words">{requirement}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-foreground/80 leading-snug wrap-break-words">
                                {section.requirementText || "No additional requirements."}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/70">No specific requirements were provided.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOfficialInvitesTab("canInviteTo")}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                      officialInvitesTab === "canInviteTo"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                        : "bg-foreground/8 text-foreground/70 border border-foreground/10 hover:bg-foreground/12"
                    }`}
                  >
                    <span className="material-symbols-rounded text-sm">outbound</span>
                    <span>Can Invite To ({selectedNodeOfficialData.canInviteTo.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOfficialInvitesTab("invitedFrom")}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                      officialInvitesTab === "invitedFrom"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                        : "bg-foreground/8 text-foreground/70 border border-foreground/10 hover:bg-foreground/12"
                    }`}
                  >
                    <span className="material-symbols-rounded text-sm">south_west</span>
                    <span>Invited From ({selectedNodeOfficialData.invitedFrom.length})</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs font-semibold text-foreground/60">Sort by</span>
                  <div className="relative">
                    <select
                      value={officialInvitesSortBy}
                      onChange={(event) => {
                        const nextSortBy = event.target.value as DialogSortByOption;
                        setOfficialInvitesSortBy(nextSortBy);
                        setOfficialInvitesSortDirection(nextSortBy === "officialInvites" ? "desc" : "asc");
                      }}
                      className="h-8 min-w-[156px] appearance-none rounded-md border border-foreground/10 bg-foreground/5 pl-2.5 pr-7 text-xs font-semibold text-foreground/80 outline-none transition-colors hover:border-foreground/20 focus:border-foreground/30"
                      aria-label="Sort dialog invite trackers"
                    >
                      <option value="officialInvites">Official Invites</option>
                      <option value="unlockAfter">Days</option>
                    </select>
                    <span className="pointer-events-none material-symbols-rounded absolute right-1.5 top-1/2 -translate-y-1/2 text-sm text-foreground/50">
                      expand_more
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOfficialInvitesSortDirection((current) => current === "asc" ? "desc" : "asc")}
                    className="relative group h-8 w-8 inline-flex items-center justify-center rounded-md border border-foreground/10 bg-foreground/5 text-foreground/70 outline-none transition-colors hover:border-foreground/20 focus-visible:border-foreground/30"
                    aria-label={`Sort ${officialInvitesSortDirection === "asc" ? "ascending" : "descending"}`}
                  >
                    <span className="material-symbols-rounded text-sm">
                      {officialInvitesSortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 translate-y-2 rounded-md border border-foreground/15 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 whitespace-nowrap opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                      Sort: {officialInvitesSortDirection === "asc" ? "Ascending" : "Descending"}
                    </span>
                  </button>
                </div>
              </div>
              {sortedPanelInvites.length > 0 ? (
                <div className="space-y-2.5">
                  {sortedPanelInvites.map((invite) => {
                    const joinRequirementSections = parseRequirementSections(
                      invite.details.reqs || "",
                      `${selectedNodeOfficialData.sourceName}-${invite.tracker}-${officialInvitesTab}`
                    );
                    const inviteCardKey = `${selectedNodeOfficialData.sourceName}:${officialInvitesTab}:${invite.tracker}`;
                    const isInviteCardOpen = expandedOfficialInviteCards[inviteCardKey] ?? true;
                    const unlockAfterParts = Array.from(new Set(
                      joinRequirementSections
                        .map((section) => section.ageText?.trim())
                        .filter((value): value is string => Boolean(value))
                    ));
                    const unlockAfterValue = unlockAfterParts.join(" / ");
                    const unlockAfterText = unlockAfterParts.length > 0 ? `After ${unlockAfterValue}` : null;
                    const joinTargetTracker = officialInvitesTab === "canInviteTo" ? invite.tracker : selectedNodeOfficialData.sourceName;
                    const joinSourceTracker = officialInvitesTab === "canInviteTo" ? selectedNodeOfficialData.sourceName : invite.tracker;
                    const unlockAfterTooltip = unlockAfterParts.length > 0
                      ? `You can join ${joinTargetTracker} from ${joinSourceTracker} after ${unlockAfterValue}.`
                      : null;

                    return (
                    <div key={invite.tracker} className="rounded-lg border border-foreground/10 bg-card p-3">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedOfficialInviteCards((current) => ({
                          ...current,
                          [inviteCardKey]: !(current[inviteCardKey] ?? true),
                        }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setExpandedOfficialInviteCards((current) => ({
                              ...current,
                              [inviteCardKey]: !(current[inviteCardKey] ?? true),
                            }));
                          }
                        }}
                        className="flex flex-wrap items-center justify-between gap-2 cursor-pointer rounded-md -mx-1 px-1 py-0.5"
                        aria-expanded={isInviteCardOpen}
                        aria-label={`${isInviteCardOpen ? "Collapse" : "Expand"} ${invite.tracker} details`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <h4 className="text-sm font-semibold text-foreground">{invite.tracker}</h4>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80 bg-foreground/10 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                            {getAbbr(invite.tracker)}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              const targetNode = data.nodes.find((graphNode) => graphNode.id === invite.tracker);
                              setOfficialInvitesTab("canInviteTo");
                              setOfficialInvitesSortBy("officialInvites");
                              setIsUnlockAccordionOpen(true);
                              setExpandedOfficialInviteCards({});
                              setSelectedNodeId(invite.tracker);
                              setDialogTrackerInUrl(invite.tracker);
                              if (
                                targetNode
                                && typeof targetNode.x === "number"
                                && typeof targetNode.y === "number"
                                && fgRef.current
                              ) {
                                fgRef.current.centerAt(targetNode.x, targetNode.y, 1000);
                                fgRef.current.zoom(2.5, 2000);
                              }
                            }}
                            className="relative group inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                            aria-label={`Open official invites for ${invite.tracker}`}
                          >
                            <span className="material-symbols-rounded text-sm">outbound</span>
                            {invite.officialInvites}
                            <span className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 translate-y-2 rounded-md border border-foreground/15 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 whitespace-nowrap opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                              Official Invites: {invite.officialInvites}
                            </span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          {unlockAfterText && (
                            <div className="relative group inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/75 bg-foreground/10 rounded-md px-1.5 py-1 shrink-0 max-w-full">
                              <span className="material-symbols-rounded text-[13px] shrink-0">schedule</span>
                              <span className="wrap-break-words text-left leading-tight">{unlockAfterText}</span>
                              {unlockAfterTooltip && (
                                <span className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 translate-y-2 rounded-md border border-foreground/15 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 whitespace-nowrap opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                                  {unlockAfterTooltip}
                                </span>
                              )}
                            </div>
                          )}
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${getStatusColor(invite.details.active)}`}>
                            {getStatusLabel(invite.details.active)}
                          </span>
                          <span className={`material-symbols-rounded text-lg text-foreground/60 transition-transform duration-200 ${isInviteCardOpen ? "rotate-180" : ""}`}>
                            keyboard_arrow_down
                          </span>
                        </div>
                      </div>
                      <div
                        className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                          isInviteCardOpen ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0"
                        }`}
                      >
                        <div className="overflow-hidden border-t border-foreground/10 pt-2.5">
                          {joinRequirementSections.length > 0 ? (
                            <div className="space-y-2">
                              {joinRequirementSections.map((section, sectionIndex) => (
                                <div key={section.key}>
                                  {sectionIndex > 0 && (
                                    <div className="flex items-center gap-2 py-1">
                                      <span className="h-px flex-1 bg-foreground/10" />
                                      <span className="text-[10px] font-semibold text-foreground/40 uppercase">or</span>
                                      <span className="h-px flex-1 bg-foreground/10" />
                                    </div>
                                  )}
                                  {section.rank && (
                                    <div className="mb-2">
                                      <h5 className="text-sm font-semibold text-foreground">{section.rank}</h5>
                                    </div>
                                  )}
                                  {section.requirements.length > 0 ? (
                                    <ul className="space-y-1.5">
                                      {section.requirements.map((requirement, requirementIndex) => (
                                        <li key={`${section.key}-join-${requirementIndex}`} className="text-sm text-foreground/80 leading-snug flex items-start gap-2">
                                          <span className="mt-[7px] h-1 w-1 rounded-full bg-foreground/45 shrink-0" />
                                          <span className="wrap-break-words">{renderReqs(requirement)}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-sm text-foreground/80 leading-snug wrap-break-words">
                                      {renderReqs(section.requirementText || "No specific requirements.")}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-foreground/80 leading-snug wrap-break-words">
                              No specific requirements.
                            </p>
                          )}
                          <div className="text-xs text-foreground/50 mt-2">
                            Checked: {invite.details.updated}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-foreground/70">
                  {officialInvitesTab === "canInviteTo"
                    ? "No active official invites were found for this tracker."
                    : "No active invite routes into this tracker were found."}
                </p>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
