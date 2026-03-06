"use client";

import { useState, useMemo, useEffect, useDeferredValue, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import rawData from "@/data/trackers.json"; 
import { DataStructure, PathResult, RouteDetail } from "@/types"; 

const data = rawData as unknown as DataStructure;
const PATHS_PAGE_SIZE = 12;

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
type SortByOption = "days" | "jumps" | "officialInvites";
type DialogSortByOption = "officialInvites" | "unlockAfter";
type SortDirection = "asc" | "desc";

interface OfficialInvitesDialogState {
  sourceName: string;
  unlockDays: number | null;
  sections: UnlockRequirementSection[];
  canInviteTo: OfficialInviteEntry[];
  invitedFrom: OfficialInviteEntry[];
}

export default function TrackerSearchApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sourceSearch, setSourceSearch] = useState(searchParams.get("source") || "");
  const [targetSearch, setTargetSearch] = useState(searchParams.get("target") || "");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>((searchParams.get("view") as 'grid' | 'list') || 'grid');
    
  const [maxJumps, setMaxJumps] = useState<number>(
    searchParams.get("jumps") ? Number.parseInt(searchParams.get("jumps")!, 10) : 5
  );
  const [maxDays, setMaxDays] = useState<number | null>(
    searchParams.get("days") ? Number.parseInt(searchParams.get("days")!, 10) : null
  );
  const [sortBy, setSortBy] = useState<SortByOption>(() => {
    const sortParam = searchParams.get("sort");
    if (sortParam === "days" || sortParam === "jumps" || sortParam === "officialInvites") {
      return sortParam;
    }
    return "jumps";
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const orderParam = searchParams.get("order");
    if (orderParam === "asc" || orderParam === "desc") {
      return orderParam;
    }

    return searchParams.get("sort") === "officialInvites" ? "desc" : "asc";
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showCollectionManager, setShowCollectionManager] = useState(false);

  const [showSourceSug, setShowSourceSug] = useState(false);
  const [showTargetSug, setShowTargetSug] = useState(false);
  const [showCollectionSug, setShowCollectionSug] = useState(false);
    
  const [sourceActiveIndex, setSourceActiveIndex] = useState(-1);
  const [targetActiveIndex, setTargetActiveIndex] = useState(-1);
  const [collectionActiveIndex, setCollectionActiveIndex] = useState(-1);

  const sourceWrapperRef = useRef<HTMLDivElement>(null);
  const targetWrapperRef = useRef<HTMLDivElement>(null);
  const collectionWrapperRef = useRef<HTMLDivElement>(null);
    
  const sourceListRef = useRef<HTMLDivElement>(null);
  const targetListRef = useRef<HTMLDivElement>(null);
  const collectionListRef = useRef<HTMLDivElement>(null);

  const deferredSource = useDeferredValue(sourceSearch);
  const deferredTarget = useDeferredValue(targetSearch);
  const isStale = sourceSearch !== deferredSource || targetSearch !== deferredTarget;

  const [mounted, setMounted] = useState(false);

  const [foundPaths, setFoundPaths] = useState<PathResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [officialInvitesDialog, setOfficialInvitesDialog] = useState<OfficialInvitesDialogState | null>(null);
  const [officialInvitesTab, setOfficialInvitesTab] = useState<OfficialInvitesTab>("canInviteTo");
  const [officialInvitesSortBy, setOfficialInvitesSortBy] = useState<DialogSortByOption>("officialInvites");
  const [officialInvitesSortDirection, setOfficialInvitesSortDirection] = useState<SortDirection>("desc");
  const [isUnlockAccordionOpen, setIsUnlockAccordionOpen] = useState(true);
  const [expandedOfficialInviteCards, setExpandedOfficialInviteCards] = useState<Record<string, boolean>>({});
  
  const [myTrackers, setMyTrackers] = useState<string[]>([]);
  const [collectionInput, setCollectionInput] = useState("");

  const isUsingCollection = myTrackers.length > 0 && sourceSearch === myTrackers.join(", ");
  const [visiblePathsCount, setVisiblePathsCount] = useState(PATHS_PAGE_SIZE);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    try {
      const savedCollection = localStorage.getItem("tracker-collection") || "";
      const trackers = savedCollection
        .split(",")
        .map((tracker) => tracker.trim())
        .filter(Boolean);

      setMyTrackers(trackers);
    } catch (error) {
      console.error("Failed to read tracker collection", error);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const params = new URLSearchParams();
    if (deferredSource) params.set("source", deferredSource);
    if (deferredTarget) params.set("target", deferredTarget);
    if (viewMode !== 'grid') params.set("view", viewMode);
    if (maxJumps !== 5) params.set("jumps", maxJumps.toString());
    if (maxDays !== null) params.set("days", maxDays.toString());
    if (sortBy !== 'jumps') params.set("sort", sortBy);
    params.set("order", sortDirection);
    const trackerParam = searchParams.get("tracker");
    if (trackerParam) params.set("tracker", trackerParam);

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [deferredSource, deferredTarget, viewMode, maxJumps, maxDays, sortBy, sortDirection, mounted, pathname, router]);

  useEffect(() => {
    const fetchPaths = async () => {
      if (!deferredSource && !deferredTarget) {
        setFoundPaths([]);
        return;
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (deferredSource) params.append("source", deferredSource);
        if (deferredTarget) params.append("target", deferredTarget);
        params.append("jumps", maxJumps.toString());
        if (maxDays) params.append("days", maxDays.toString());

        const res = await fetch(`/api/routes?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setFoundPaths(data);
        }
      } catch (error) {
        console.error("Failed to fetch routes", error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
        fetchPaths();
    }, 300); 

    return () => clearTimeout(timeoutId);

  }, [deferredSource, deferredTarget, maxJumps, maxDays]);

  useEffect(() => {
     if (!searchParams.get("source") && !searchParams.get("target")) {
        setSourceSearch("");
        setTargetSearch("");
        setFoundPaths([]);
        setVisiblePathsCount(PATHS_PAGE_SIZE);
      }
  }, [searchParams]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sourceWrapperRef.current && !sourceWrapperRef.current.contains(event.target as Node)) {
        setShowSourceSug(false);
        setSourceActiveIndex(-1);
      }
      if (targetWrapperRef.current && !targetWrapperRef.current.contains(event.target as Node)) {
        setShowTargetSug(false);
        setTargetActiveIndex(-1);
      }
      if (collectionWrapperRef.current && !collectionWrapperRef.current.contains(event.target as Node)) {
        setShowCollectionSug(false);
        setCollectionActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (sourceActiveIndex >= 0 && sourceListRef.current) {
      const list = sourceListRef.current;
      const activeElement = list.children[sourceActiveIndex] as HTMLElement;
      if (activeElement) {
        if (sourceActiveIndex === 0) {
           list.scrollTop = 0;
        } else if (sourceActiveIndex === list.children.length - 1) {
           list.scrollTop = list.scrollHeight;
        } else {
           activeElement.scrollIntoView({ block: "nearest" });
        }
      }
    }
  }, [sourceActiveIndex]);

  useEffect(() => {
    if (targetActiveIndex >= 0 && targetListRef.current) {
      const list = targetListRef.current;
      const activeElement = list.children[targetActiveIndex] as HTMLElement;
      if (activeElement) {
        if (targetActiveIndex === 0) {
           list.scrollTop = 0;
        } else if (targetActiveIndex === list.children.length - 1) {
           list.scrollTop = list.scrollHeight;
        } else {
           activeElement.scrollIntoView({ block: "nearest" });
        }
      }
    }
  }, [targetActiveIndex]);

  useEffect(() => {
    if (collectionActiveIndex >= 0 && collectionListRef.current) {
      const list = collectionListRef.current;
      const activeElement = list.children[collectionActiveIndex] as HTMLElement;
      if (activeElement) {
        if (collectionActiveIndex === 0) {
           list.scrollTop = 0;
        } else if (collectionActiveIndex === list.children.length - 1) {
           list.scrollTop = list.scrollHeight;
        } else {
           activeElement.scrollIntoView({ block: "nearest" });
        }
      }
    }
  }, [collectionActiveIndex]);

  useEffect(() => {
    if (!officialInvitesDialog) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOfficialInvitesDialog(null);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("tracker");
        const nextQuery = params.toString();
        router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [officialInvitesDialog, pathname, router, searchParams]);

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
    setVisiblePathsCount(PATHS_PAGE_SIZE);
    setShowSourceSug(false);
    setSourceActiveIndex(-1);
  };

  const handleTargetSelect = (selectedItem: string) => {
    setTargetSearch(selectedItem);
    setVisiblePathsCount(PATHS_PAGE_SIZE);
    setShowTargetSug(false);
    setTargetActiveIndex(-1);
  };

  const handleCollectionSelect = (selectedItem: string) => {
    if (!myTrackers.includes(selectedItem)) {
      const updated = [...myTrackers, selectedItem];
      setMyTrackers(updated);
      localStorage.setItem("tracker-collection", updated.join(", "));
    }
    setCollectionInput("");
    setShowCollectionSug(false);
    setCollectionActiveIndex(-1);
  };

  const removeCollectionItem = (itemToRemove: string) => {
    const updated = myTrackers.filter((item) => item !== itemToRemove);
    setMyTrackers(updated);
    localStorage.setItem("tracker-collection", updated.join(", "));
  };

  const handleSourceKeyDown = (e: React.KeyboardEvent) => {
    if (!showSourceSug) return;
    const suggestions = getSuggestions(sourceSearch);
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSourceActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSourceActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && sourceActiveIndex >= 0 && suggestions[sourceActiveIndex]) {
      e.preventDefault();
      handleSourceSelect(suggestions[sourceActiveIndex]);
    } else if (e.key === "Escape") {
      setShowSourceSug(false);
    }
  };

  const handleTargetKeyDown = (e: React.KeyboardEvent) => {
    if (!showTargetSug) return;
    const suggestions = getSuggestions(targetSearch);
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setTargetActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setTargetActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && targetActiveIndex >= 0 && suggestions[targetActiveIndex]) {
      e.preventDefault();
      handleTargetSelect(suggestions[targetActiveIndex]);
    } else if (e.key === "Escape") {
      setShowTargetSug(false);
    }
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

  const toggleMyTrackers = () => {
    if (myTrackers.length === 0) return;
    if (isUsingCollection) {
      setSourceSearch("");
    } else {
      setSourceSearch(myTrackers.join(", "));
    }
    setVisiblePathsCount(PATHS_PAGE_SIZE);
    setShowSourceSug(false);
    setSourceActiveIndex(-1);
  };

  const getPathId = (path: PathResult) => `${path.source}>${path.nodes.join(">")}`;

  const getStepDays = (path: PathResult, routeIndex: number) => {
    const stepDayFromApi = path.stepDays?.[routeIndex];
    if (stepDayFromApi !== undefined) {
      return stepDayFromApi;
    }

    const route = path.routes[routeIndex];
    if (!route || route.days === null) {
      return null;
    }

    const sourceNode = path.nodes[routeIndex];
    const unlockDays = data.unlockInviteClass[sourceNode]?.[0] ?? 0;
    return Math.max(route.days, unlockDays);
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'yes' || s === 'open') return 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30';
    if (s === 'no' || s === 'closed') return 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30';
    return 'text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30';
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
            className="text-blue-500 hover:underline wrap-break-words"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const activeInviteCountBySource = useMemo(() => {
    const counts: { [key: string]: number } = {};
    Object.keys(data.routeInfo).forEach(sourceName => {
      counts[sourceName] = Object.values(data.routeInfo[sourceName] || {})
        .filter(route => route.active.toLowerCase() === "yes")
        .length;
    });
    return counts;
  }, []);

  const sortedPaths = useMemo(() => {
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;
    return [...foundPaths].sort((a, b) => {
      const aTotalDays = a.totalDays ?? Number.POSITIVE_INFINITY;
      const bTotalDays = b.totalDays ?? Number.POSITIVE_INFINITY;
      const aOfficialInvites = activeInviteCountBySource[a.target] || 0;
      const bOfficialInvites = activeInviteCountBySource[b.target] || 0;

      if (sortBy === "officialInvites") {
        if (aOfficialInvites !== bOfficialInvites) {
          return (aOfficialInvites - bOfficialInvites) * directionMultiplier;
        }
        if (a.routes.length !== b.routes.length) {
          return a.routes.length - b.routes.length;
        }
        if (aTotalDays !== bTotalDays) {
          return aTotalDays - bTotalDays;
        }
        return a.target.localeCompare(b.target);
      }

      if (sortBy === 'days') {
        if (aTotalDays !== bTotalDays) {
          return (aTotalDays - bTotalDays) * directionMultiplier;
        }
        if (a.routes.length !== b.routes.length) {
          return a.routes.length - b.routes.length;
        }
      } else {
        if (a.routes.length !== b.routes.length) {
          return (a.routes.length - b.routes.length) * directionMultiplier;
        }
        if (aTotalDays !== bTotalDays) {
          return aTotalDays - bTotalDays;
        }
      }
        
      return a.target.localeCompare(b.target);
    });
  }, [activeInviteCountBySource, foundPaths, sortBy, sortDirection]);

  const bestPathId = (deferredTarget && sortedPaths.length > 0) ? getPathId(sortedPaths[0]) : null;
  const displayedPaths = useMemo(() => {
    return sortedPaths.slice(0, visiblePathsCount);
  }, [sortedPaths, visiblePathsCount]);

  const groupedResults = useMemo(() => {
    const groups: { [key: string]: PathResult[] } = {};
    displayedPaths.forEach(path => {
      if (!groups[path.source]) groups[path.source] = [];
      groups[path.source].push(path);
    });
    return groups;
  }, [displayedPaths]);

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
    const unlockInfo = data.unlockInviteClass[sourceName];
    if (!unlockInfo) {
      return [];
    }

    return parseRequirementSections(unlockInfo[1], sourceName);
  };

  const trackerCanInviteTo = useMemo(() => {
    const invitesByTracker: { [key: string]: OfficialInviteEntry[] } = {};

    Object.keys(data.routeInfo).forEach(sourceName => {
      invitesByTracker[sourceName] = Object.entries(data.routeInfo[sourceName] || {})
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
    });

    return invitesByTracker;
  }, [activeInviteCountBySource]);

  const trackerInvitedFrom = useMemo(() => {
    const invitesByTracker: { [key: string]: OfficialInviteEntry[] } = {};

    Object.keys(data.routeInfo).forEach(sourceName => {
      invitesByTracker[sourceName] = Object.entries(data.routeInfo)
        .filter(([, routes]) => routes[sourceName]?.active.toLowerCase() === "yes")
        .map(([tracker, routes]) => ({
          tracker,
          details: routes[sourceName] as RouteDetail,
          officialInvites: activeInviteCountBySource[tracker] || 0,
        }))
        .sort((a, b) => {
          if (a.officialInvites !== b.officialInvites) {
            return b.officialInvites - a.officialInvites;
          }
          return a.tracker.localeCompare(b.tracker);
        });
    });

    return invitesByTracker;
  }, [activeInviteCountBySource]);

  const sortedDialogInvites = useMemo(() => {
    if (!officialInvitesDialog) {
      return [];
    }

    const directionMultiplier = officialInvitesSortDirection === "asc" ? 1 : -1;
    const currentInvites = officialInvitesTab === "canInviteTo"
      ? officialInvitesDialog.canInviteTo
      : officialInvitesDialog.invitedFrom;
    const unlockAfterCache: { [key: string]: number | null } = {};
    const getCachedUnlockAfterDays = (invite: OfficialInviteEntry) => {
      if (invite.tracker in unlockAfterCache) {
        return unlockAfterCache[invite.tracker];
      }

      const unlockAfterDays = getInviteUnlockAfterDays(
        invite,
        `${officialInvitesDialog.sourceName}-${invite.tracker}-${officialInvitesTab}-sort`
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
          return (aUnlockAfterDays - bUnlockAfterDays) * directionMultiplier;
        }
      }

      if (a.officialInvites !== b.officialInvites) {
        return (a.officialInvites - b.officialInvites) * directionMultiplier;
      }

      return a.tracker.localeCompare(b.tracker);
    });
  }, [officialInvitesDialog, officialInvitesSortBy, officialInvitesSortDirection, officialInvitesTab]);

  const sortedSourceNames = useMemo(() => {
    return Object.keys(groupedResults);
  }, [groupedResults]);

  const foundCountBySource = useMemo(() => {
    const counts: { [key: string]: number } = {};
    sortedPaths.forEach(path => {
      counts[path.source] = (counts[path.source] || 0) + 1;
    });
    return counts;
  }, [sortedPaths]);

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

  const openOfficialInvitesDialog = (
    sourceName: string,
    canInviteTo: OfficialInviteEntry[],
    invitedFrom: OfficialInviteEntry[],
    updateUrl = true
  ) => {
    const unlockInfo = data.unlockInviteClass[sourceName];
    setOfficialInvitesTab("canInviteTo");
    setOfficialInvitesSortBy("officialInvites");
    setOfficialInvitesSortDirection("desc");
    setIsUnlockAccordionOpen(true);
    setExpandedOfficialInviteCards({});
    setOfficialInvitesDialog({
      sourceName,
      unlockDays: unlockInfo?.[0] ?? null,
      sections: getUnlockRequirementSections(sourceName),
      canInviteTo,
      invitedFrom,
    });

    if (updateUrl) {
      setDialogTrackerInUrl(sourceName);
    }
  };

  const closeOfficialInvitesDialog = (updateUrl = true) => {
    setOfficialInvitesDialog(null);
    if (updateUrl) {
      setDialogTrackerInUrl(null);
    }
  };

  useEffect(() => {
    const trackerParam = searchParams.get("tracker");
    if (!trackerParam) {
      if (officialInvitesDialog) {
        closeOfficialInvitesDialog(false);
      }
      return;
    }

    if (!allTrackers.includes(trackerParam)) {
      closeOfficialInvitesDialog(false);
      setDialogTrackerInUrl(null, "replace");
      return;
    }

    if (officialInvitesDialog?.sourceName === trackerParam) {
      return;
    }

    openOfficialInvitesDialog(
      trackerParam,
      trackerCanInviteTo[trackerParam] || [],
      trackerInvitedFrom[trackerParam] || [],
      false
    );
  }, [allTrackers, searchParams, trackerCanInviteTo, trackerInvitedFrom]);


  if (!mounted) return <div className="w-full" />;

  const badgeClass = "flex items-center gap-1.5 text-xs font-semibold text-foreground/80 bg-foreground/10 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap";

  return (
    <>
      <div className={`w-full relative z-40 transition-all duration-500 ease-out ${sourceSearch || targetSearch ? 'translate-y-0' : 'translate-y-4 md:translate-y-16'}`}>
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

        <div className="w-full max-w-2xl mx-auto bg-foreground/3 border border-foreground/10 rounded-xl p-2 animate-in fade-in zoom-in-95 duration-500 relative z-30">
          <div className="flex flex-col relative">
              
            <div className="absolute left-4 top-4 bottom-14 flex flex-col items-center gap-1 z-0 pointer-events-none">
              <div className="w-2.5 h-2.5 rounded-full border-[3px] border-foreground/10 bg-background"></div>
              <div className="w-px flex-1 bg-linear-to-b from-foreground/10 to-foreground/10"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-foreground/10"></div>
            </div>

            <div className="flex flex-col gap-1 pl-9 pr-2 py-2">
              
              <div className="relative" ref={sourceWrapperRef}>
                <div className="relative flex items-center w-full">
                  <input 
                    aria-label="Source tracker"
                    type="text"
                    disabled={isUsingCollection}
                    placeholder={isUsingCollection ? "Using My Trackers" : "Source tracker(s)"}
                    className={`w-full h-10 bg-transparent border-none outline-none font-medium text-sm pr-10 sm:pr-[150px] ${
                      isUsingCollection ? "text-foreground/50 cursor-not-allowed" : "text-foreground placeholder:text-foreground/30"
                    }`}
                    value={sourceSearch}
                    onFocus={() => {
                      if (!isUsingCollection) setShowSourceSug(true);
                    }}
                    onChange={(e) => {
                      if (isUsingCollection) return;
                      setSourceSearch(e.target.value);
                      setVisiblePathsCount(PATHS_PAGE_SIZE);
                      setShowSourceSug(true);
                      setSourceActiveIndex(-1);
                    }}
                    onKeyDown={handleSourceKeyDown}
                  />
                  <div className="absolute right-0 flex items-center pr-1">
                    <button
                      onClick={toggleMyTrackers}
                      disabled={myTrackers.length === 0}
                      className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-md transition-colors border ${
                        myTrackers.length === 0
                          ? "text-foreground/30 cursor-not-allowed bg-transparent border-transparent"
                          : isUsingCollection
                            ? "bg-green-500/15 text-green-600 dark:text-green-300 border-green-500/40"
                            : "text-foreground/70 bg-foreground/5 hover:bg-foreground/10 hover:text-foreground border-transparent"
                      }`}
                    >
                      <span className="material-symbols-rounded text-[14px]">bookmarks</span>
                      <span className="hidden sm:inline">Use My Trackers</span>
                    </button>
                  </div>
                </div>
                {!isUsingCollection && showSourceSug && getSuggestions(sourceSearch).length > 0 && (
                  <div className="absolute top-full -left-8 w-[calc(100%+2rem)] mt-2 bg-card rounded-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 border border-foreground/10">
                    <div className="max-h-60 overflow-y-auto p-1" ref={sourceListRef}>
                      {getSuggestions(sourceSearch).map((item, i) => (
                        <div 
                          key={i}
                          className={`px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors text-foreground/90 font-medium flex items-center justify-between ${
                            i === sourceActiveIndex 
                              ? 'bg-foreground/10' 
                              : 'hover:bg-foreground/5'
                          }`}
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
                    setVisiblePathsCount(PATHS_PAGE_SIZE);
                    setShowTargetSug(true);
                    setTargetActiveIndex(-1);
                  }}
                  onKeyDown={handleTargetKeyDown}
                />
                {showTargetSug && getSuggestions(targetSearch).length > 0 && (
                  <div className="absolute top-full -left-8 w-[calc(100%+2rem)] mt-2 bg-card rounded-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 border border-foreground/10">
                    <div className="max-h-60 overflow-y-auto p-1" ref={targetListRef}>
                      {getSuggestions(targetSearch).map((item, i) => (
                        <div 
                          key={i}
                          className={`px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors text-foreground/90 font-medium flex items-center justify-between ${
                            i === targetActiveIndex 
                              ? 'bg-foreground/10' 
                              : 'hover:bg-foreground/5'
                          }`}
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
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowFilters(!showFilters);
                    if (showCollectionManager) setShowCollectionManager(false);
                  }}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all text-sm font-medium bg-foreground/5 ${
                    showFilters 
                      ? 'text-foreground' 
                      : 'text-foreground/50 hover:text-foreground' 
                  }`}
                >
                  <span className="material-symbols-rounded text-lg">tune</span>
                  <span className="hidden sm:inline">Options</span>
                </button>
                
                <button
                  onClick={() => {
                    setShowCollectionManager(!showCollectionManager);
                    if (showFilters) setShowFilters(false);
                  }}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all text-sm font-medium bg-foreground/5 ${
                    showCollectionManager 
                      ? 'text-foreground' 
                      : 'text-foreground/50 hover:text-foreground' 
                  }`}
                >
                  <span className="material-symbols-rounded text-lg">collections_bookmark</span>
                  <span className="hidden sm:inline">My Trackers</span>
                </button>
              </div>

              <div className="hidden md:flex items-center bg-foreground/5 rounded-md p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-sm flex items-center justify-center transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-foreground/10 text-foreground' 
                      : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  <span className="material-symbols-rounded text-lg">grid_view</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-sm flex items-center justify-center transition-all ${
                    viewMode === 'list' 
                      ? 'bg-foreground/10 text-foreground' 
                      : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  <span className="material-symbols-rounded text-lg">view_list</span>
                </button>
              </div>

            </div>

          </div>
        </div>

        {showFilters && (
          <div className="max-w-2xl mx-auto mt-2 p-6 bg-foreground/3 border border-foreground/10 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="text-sm font-medium text-foreground/50 mb-2 block">Max jumps</label>
                <div className="flex rounded-lg bg-foreground/5 p-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setMaxJumps(val);
                        setVisiblePathsCount(PATHS_PAGE_SIZE);
                      }}
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
                <div className="flex rounded-lg bg-foreground/5 p-1">
                  {[
                    { l: 'Any', v: null },
                    { l: '90d', v: 90 },
                    { l: '6m', v: 180 },
                    { l: '1y', v: 365 },
                    { l: '2y', v: 730 }
                  ].map((opt) => (
                    <button
                      key={opt.l}
                      onClick={() => {
                        setMaxDays(opt.v);
                        setVisiblePathsCount(PATHS_PAGE_SIZE);
                      }}
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

            </div>
          </div>
        )}

        {showCollectionManager && (
          <div className={`max-w-2xl mx-auto mt-2 p-6 bg-foreground/3 border border-foreground/10 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200 relative z-20 transition-all ${showCollectionSug ? 'mb-40' : ''}`}>
            <div className="flex flex-col gap-4">
              <div className="relative" ref={collectionWrapperRef}>
                <label className="text-sm font-medium text-foreground/50 mb-2 block">Add to My Trackers</label>
                <input 
                  type="text"
                  placeholder="Search tracker to add..."
                  className="w-full h-10 bg-foreground/5 border border-foreground/10 rounded-md text-sm p-2.5 outline-none focus:border-purple-500/50 transition-colors"
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
                  <div className="absolute top-full left-0 w-full mt-2 bg-card rounded-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 border border-foreground/10">
                    <div className="max-h-60 overflow-y-auto p-1" ref={collectionListRef}>
                      {getSuggestions(collectionInput).map((item, i) => (
                        <div 
                          key={i}
                          className={`px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors text-foreground/90 font-medium flex items-center justify-between ${
                            i === collectionActiveIndex 
                              ? 'bg-foreground/10' 
                              : 'hover:bg-foreground/5'
                          }`}
                          onClick={() => handleCollectionSelect(item)}
                        >
                          <span>{item}</span>
                          <span className="text-xs text-foreground/40 font-semibold">{getAbbr(item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {myTrackers.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {myTrackers.map(t => (
                    <button
                      key={t}
                      onClick={() => removeCollectionItem(t)}
                      className="px-2.5 py-1 rounded-md text-sm font-medium bg-purple-500/10 hover:bg-red-500/10 text-purple-600 dark:text-purple-400 hover:text-red-600 dark:hover:text-red-400 border border-purple-500/20 hover:border-red-500/20 transition-colors cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-foreground/40 mt-1">
                  Your collection is empty. Add trackers you are already in to easily use them as a source.
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {(sourceSearch || targetSearch) && (
        <div className="mt-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="flex flex-col gap-10 pb-10">
            {sortedSourceNames.map((sourceName) => {
              const paths = groupedResults[sourceName];
              const sourceAbbr = getAbbr(sourceName);
              const officialInvites = trackerCanInviteTo[sourceName] || [];
              const invitedFrom = trackerInvitedFrom[sourceName] || [];
              const sourceFoundCount = foundCountBySource[sourceName] || 0;

              return (
                <div key={sourceName} className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  <div className="flex flex-col gap-2 px-1 pb-2 mb-1">
                    <div className="flex items-end justify-between gap-3">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-foreground tracking-tight mr-1">{sourceName}</h3>
                          
                          {sourceAbbr && (
                            <span className={badgeClass}>
                              {sourceAbbr}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => openOfficialInvitesDialog(sourceName, officialInvites, invitedFrom)}
                            className="relative group inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 transition-colors hover:bg-blue-200 dark:hover:bg-blue-900/40 cursor-pointer"
                            aria-label={`Official invites for ${sourceName}: ${officialInvites.length}`}
                          >
                            <span className="material-symbols-rounded text-sm">outbound</span>
                            <span>Official Invites {officialInvites.length}</span>
                            <span className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 translate-y-2 rounded-md border border-foreground/15 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 whitespace-nowrap opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                              Official Invites: {officialInvites.length}
                            </span>
                          </button>
                        </div>
                        {isLoading || isStale ? (
                          <div className="flex items-center gap-2 text-sm text-foreground/50">
                            <span className="material-symbols-rounded text-sm animate-spin">progress_activity</span>
                            <span>Updating search results</span>
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-foreground/50">
                            Search results {sourceFoundCount} found
                          </p>
                        )}
                      </div>
                        <div className="shrink-0 self-end flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground/60">Sort by</span>
                        <div className="relative">
                          <select
                            value={sortBy}
                            onChange={(event) => {
                              const nextSortBy = event.target.value as SortByOption;
                              setSortBy(nextSortBy);
                              setSortDirection(nextSortBy === "officialInvites" ? "desc" : "asc");
                              setVisiblePathsCount(PATHS_PAGE_SIZE);
                            }}
                            className="h-9 min-w-[176px] appearance-none rounded-md border border-foreground/10 bg-foreground/5 pl-3 pr-8 text-sm font-semibold text-foreground/80 outline-none transition-colors hover:border-foreground/20 focus:border-foreground/30"
                            aria-label="Sort search results"
                          >
                            <option value="jumps">Jumps</option>
                            <option value="days">Days</option>
                            <option value="officialInvites">Official Invites</option>
                          </select>
                          <span className="pointer-events-none material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-base text-foreground/50">
                            expand_more
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")}
                          className="relative group h-9 w-9 inline-flex items-center justify-center rounded-md border border-foreground/10 bg-foreground/5 text-foreground/70 outline-none transition-colors hover:border-foreground/20 focus-visible:border-foreground/30"
                          aria-label={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
                        >
                          <span className="material-symbols-rounded text-base">
                            {sortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
                          </span>
                          <span className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 translate-y-2 rounded-md border border-foreground/15 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 whitespace-nowrap opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                            Sort: {sortDirection === "asc" ? "Ascending" : "Descending"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={
                    viewMode === 'grid' 
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                      : "grid grid-cols-1 gap-3"
                  }>
                    {paths.map((path) => {
                      const targetAbbr = getAbbr(path.target);
                      const targetOfficialInvites = trackerCanInviteTo[path.target] || [];
                      const targetInvitedFrom = trackerInvitedFrom[path.target] || [];
                      const isDirect = path.routes.length === 1;
                      const pathId = getPathId(path);
                      const isBestPath = pathId === bestPathId;

                      return (
                        <div
                          key={pathId}
                          className={`flex flex-col p-5 rounded-xl border transition-colors duration-200 h-full ${
                            isBestPath
                              ? "border-green-500/40 bg-green-500/5"
                              : "bg-card border-foreground/10"
                          }`}
                        >
                          
                          <div className="flex justify-between items-start mb-3 gap-4"> 
                            <div className="min-w-0">
                              
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                                <div className="font-bold text-foreground text-lg wrap-break-word">{path.target}</div>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={badgeClass}>
                                    {targetAbbr}
                                  </span>
                                  {!isDirect && <span className={badgeClass}>{path.routes.length} hop</span>}
                                  <button
                                    type="button"
                                    onClick={() => openOfficialInvitesDialog(path.target, targetOfficialInvites, targetInvitedFrom)}
                                    className="relative group inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 transition-colors hover:bg-blue-200 dark:hover:bg-blue-900/40 cursor-pointer"
                                    aria-label={`Official invites for ${path.target}: ${targetOfficialInvites.length}`}
                                  >
                                    <span className="material-symbols-rounded text-sm">outbound</span>
                                    <span>{targetOfficialInvites.length}</span>
                                    <span className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 translate-y-2 rounded-md border border-foreground/15 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 whitespace-nowrap opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                                      Official Invites: {targetOfficialInvites.length}
                                    </span>
                                  </button>
                                </div>
                              </div>
                              
                              <div className="flex flex-col gap-1.5 items-start">
                                <div className="text-sm font-medium text-foreground/50 tracking-wide flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                  <span>From</span>
                                  <span className="text-foreground/80 font-medium">{sourceName}</span>
                                  <span className={badgeClass}>
                                    {sourceAbbr}
                                  </span>
                                </div>

                                {isBestPath && (
                                  <div className="mt-1.5">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-md">
                                      <span className="material-symbols-rounded text-sm">workspace_premium</span>
                                      {sortBy === 'days'
                                        ? sortDirection === "asc" ? "Fastest route" : "Slowest route"
                                        : sortBy === "officialInvites"
                                          ? sortDirection === "asc" ? "Fewest official invites" : "Most official invites"
                                          : sortDirection === "asc" ? "Fewest hops" : "Most hops"}
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                            </div>
                            
                            <span className={`text-sm font-medium bg-transparent border border-foreground/10 px-2 py-1 rounded-md whitespace-nowrap shrink-0 ${path.totalDays === null ? 'text-foreground/40' : 'text-foreground/70'}`}>
                              {path.totalDays === null ? 'Unknown' : `${path.totalDays} days`}
                            </span>
                          </div>
                          
                          <div className="space-y-3 mt-auto flex-1">
                            {path.routes.map((req, rIdx) => {
                              const fromNode = path.nodes[rIdx];
                              const toNode = path.nodes[rIdx + 1];
                              const stepDays = getStepDays(path, rIdx);
                              
                              return (
                                <div key={rIdx} className="text-sm pl-3 relative border-l-2 border-foreground/10">
                                  {!isDirect && (
                                    <div className="text-sm font-bold text-foreground/70 mb-1 flex items-center gap-1">
                                      <span>{fromNode}</span><span className="material-symbols-rounded text-base">arrow_right_alt</span><span>{toNode}</span>
                                    </div>
                                  )}
                                  <div className={`text-xs font-medium mb-1 ${stepDays === null ? "text-foreground/40" : "text-foreground/70"}`}>
                                    Step time: {stepDays === null ? "Unknown" : `${stepDays} days`}
                                  </div>
                                  <p className="text-foreground/70 leading-relaxed font-normal text-sm">{renderReqs(req.reqs)}</p>
                                  
                                  <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-foreground/5 border-dashed">
                                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${getStatusColor(req.active)}`}>
                                        {getStatusLabel(req.active)}
                                      </span>
                                      <div className="flex items-center gap-1 text-foreground/30">
                                        <span className="text-xs font-medium">Checked: {req.updated}</span>
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

            {!isStale && !isLoading && sortedPaths.length > visiblePathsCount && (
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setVisiblePathsCount(current => current + PATHS_PAGE_SIZE)}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-foreground/10 text-foreground/80 hover:bg-foreground/15 transition-colors"
                >
                  Load more ({Math.min(PATHS_PAGE_SIZE, sortedPaths.length - visiblePathsCount)} more)
                </button>
              </div>
            )}
            
            {!isStale && !isLoading && foundPaths.length === 0 && (sourceSearch || targetSearch) && (
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

      {officialInvitesDialog && (
        <div
          className="fixed inset-0 z-50 h-dvh w-screen bg-black/55 backdrop-blur-sm p-0 md:p-4 flex items-end md:items-center justify-center animate-in fade-in duration-200"
          onClick={() => closeOfficialInvitesDialog()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="official-invites-dialog-title"
            className="w-full md:max-w-2xl max-h-[82dvh] md:max-h-[85dvh] rounded-t-2xl md:rounded-xl border border-foreground/15 bg-card shadow-2xl overflow-hidden mt-auto md:mt-0 flex flex-col overscroll-none animate-in zoom-in-95 slide-in-from-bottom-4 md:slide-in-from-bottom-0 duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-center pt-2 md:hidden shrink-0">
              <span className="h-1 w-10 rounded-full bg-foreground/20" />
            </div>
            <div className="flex items-start justify-between gap-4 p-4 border-b border-foreground/10 shrink-0">
              <div>
                <h2 id="official-invites-dialog-title" className="text-lg font-bold text-foreground">
                  {officialInvitesDialog.sourceName}
                </h2>
                <p className="text-sm text-foreground/70 mt-1">
                  Official invite forum and official invites
                </p>
              </div>
              <button
                type="button"
                onClick={() => closeOfficialInvitesDialog()}
                className="p-1.5 rounded-md text-foreground/70 transition-colors"
                aria-label="Close dialog"
              >
                <span className="material-symbols-rounded text-lg">close</span>
              </button>
            </div>

            <div className="p-4 pb-6 overflow-y-auto overscroll-contain space-y-3 custom-scrollbar flex-1 min-h-0">
              <div className="space-y-2.5">
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
                    <div className="overflow-hidden">
                      {officialInvitesDialog.sections.length > 0 ? (
                        <div className="space-y-2.5">
                          {officialInvitesDialog.sections.map((section, sectionIndex) => (
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
                                        You can join the official invite forum from {officialInvitesDialog.sourceName} after {section.ageText.trim()}.
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
                        <span>Can Invite To ({officialInvitesDialog.canInviteTo.length})</span>
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
                        <span>Invited From ({officialInvitesDialog.invitedFrom.length})</span>
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
                  {sortedDialogInvites.length > 0 ? (
                    <div className="space-y-2.5">
                      {sortedDialogInvites.map((invite) => {
                        const joinRequirementSections = parseRequirementSections(
                          invite.details.reqs || "",
                          `${officialInvitesDialog.sourceName}-${invite.tracker}-${officialInvitesTab}`
                        );
                        const inviteCardKey = `${officialInvitesDialog.sourceName}:${officialInvitesTab}:${invite.tracker}`;
                        const isInviteCardOpen = expandedOfficialInviteCards[inviteCardKey] ?? true;
                        const unlockAfterParts = Array.from(new Set(
                          joinRequirementSections
                            .map((section) => section.ageText?.trim())
                            .filter((value): value is string => Boolean(value))
                        ));
                        const unlockAfterValue = unlockAfterParts.join(" / ");
                        const unlockAfterText = unlockAfterParts.length > 0 ? `After ${unlockAfterValue}` : null;
                        const joinTargetTracker = officialInvitesTab === "canInviteTo" ? invite.tracker : officialInvitesDialog.sourceName;
                        const joinSourceTracker = officialInvitesTab === "canInviteTo" ? officialInvitesDialog.sourceName : invite.tracker;
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
                              <span className={badgeClass}>
                                {getAbbr(invite.tracker)}
                              </span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openOfficialInvitesDialog(
                                    invite.tracker,
                                    trackerCanInviteTo[invite.tracker] || [],
                                    trackerInvitedFrom[invite.tracker] || []
                                  );
                                }}
                                className="relative group inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                                aria-label={`Open official invites for ${invite.tracker}`}
                              >
                                <span className="material-symbols-rounded text-sm">outbound</span>
                                <span>{invite.officialInvites}</span>
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
