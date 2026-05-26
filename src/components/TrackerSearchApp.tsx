"use client";

import { useState, useMemo, useEffect, useDeferredValue, useRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import rawData from "@/data/trackers.json"; 
import { DataStructure, PathResult } from "@/types";
import {
  OfficialInviteEntry,
  OfficialInvitesData,
  SortDirection,
  getActiveInviteCountBySource,
  getInvitedFromForSource,
  getOfficialInvitesForSource,
  getStatusColor,
  getStatusLabel,
  getTrackerAbbr,
  parseRequirementSections,
} from "@/lib/officialInvites";
import OfficialInvitesDialog from "@/components/shared/OfficialInvitesDialog";
import OfficialInvitesBadge from "@/components/shared/OfficialInvitesBadge";
import UiState from "@/components/shared/UiState";

const data = rawData as unknown as DataStructure;
const DEFAULT_ROUTES_PER_PAGE = 10;
const ROUTES_PER_PAGE_OPTIONS = [10, 20, 50] as const;

type SortByOption = "days" | "jumps" | "officialInvites";
const SORT_OPTIONS: Array<{ value: SortByOption; label: string }> = [
  { value: "jumps", label: "Jumps" },
  { value: "days", label: "Days" },
  { value: "officialInvites", label: "Official" },
];

const parsePositiveIntParam = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
};

const parseRoutesPerPageParam = (value: string | null) => {
  if (!value) return DEFAULT_ROUTES_PER_PAGE;
  const parsed = Number.parseInt(value, 10);
  return ROUTES_PER_PAGE_OPTIONS.includes(parsed as (typeof ROUTES_PER_PAGE_OPTIONS)[number])
    ? parsed
    : DEFAULT_ROUTES_PER_PAGE;
};

const parseSourcePagesParam = (value: string | null) => {
  if (!value) return {} as Record<string, number>;

  const sourcePages: Record<string, number> = {};
  for (const entry of value.split("|")) {
    const separatorIndex = entry.lastIndexOf(":");
    if (separatorIndex === -1) continue;

    const encodedSource = entry.slice(0, separatorIndex);
    const pageValue = entry.slice(separatorIndex + 1);
    let sourceName = "";
    try {
      sourceName = decodeURIComponent(encodedSource);
    } catch {
      continue;
    }
    const page = parsePositiveIntParam(pageValue, 1);
    if (!sourceName || page <= 1) continue;

    sourcePages[sourceName] = page;
  }

  return sourcePages;
};

const serializeSourcePagesParam = (sourcePages: Record<string, number>) => {
  return Object.entries(sourcePages)
    .filter(([, page]) => page > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sourceName, page]) => `${encodeURIComponent(sourceName)}:${page}`)
    .join("|");
};

const buildPaginationItems = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis-left" | "ellipsis-right"> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    items.push("ellipsis-left");
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page);
  }

  if (windowEnd < totalPages - 1) {
    items.push("ellipsis-right");
  }

  items.push(totalPages);
  return items;
};

export default function TrackerSearchApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTrackerParam = searchParams.get("tracker");
  const routesPerPageFromQuery = parseRoutesPerPageParam(searchParams.get("perPage"));
  const sourcePagesParamRaw = searchParams.get("sourcePages");
  const sourcePagesFromQuery = useMemo(
    () => parseSourcePagesParam(sourcePagesParamRaw),
    [sourcePagesParamRaw]
  );

  const [sourceSearch, setSourceSearch] = useState(searchParams.get("source") || "");
  const [targetSearch, setTargetSearch] = useState(searchParams.get("target") || "");
    
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
    return "asc";
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showCollectionManager, setShowCollectionManager] = useState(false);
  const [showViewControls, setShowViewControls] = useState(false);

  const [showSourceSug, setShowSourceSug] = useState(false);
  const [showTargetSug, setShowTargetSug] = useState(false);
  const [showCollectionSug, setShowCollectionSug] = useState(false);
    
  const [sourceActiveIndex, setSourceActiveIndex] = useState(-1);
  const [targetActiveIndex, setTargetActiveIndex] = useState(-1);
  const [collectionActiveIndex, setCollectionActiveIndex] = useState(-1);

  const sourceWrapperRef = useRef<HTMLDivElement>(null);
  const targetWrapperRef = useRef<HTMLDivElement>(null);
  const collectionWrapperRef = useRef<HTMLDivElement>(null);
  const viewControlsRef = useRef<HTMLDivElement>(null);
    
  const sourceListRef = useRef<HTMLDivElement>(null);
  const targetListRef = useRef<HTMLDivElement>(null);
  const collectionListRef = useRef<HTMLDivElement>(null);

  const deferredSource = useDeferredValue(sourceSearch);
  const deferredTarget = useDeferredValue(targetSearch);
  const isStale = sourceSearch !== deferredSource || targetSearch !== deferredTarget;

  const [mounted, setMounted] = useState(false);

  const [foundPaths, setFoundPaths] = useState<PathResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  
  const [myTrackers, setMyTrackers] = useState<string[]>([]);
  const [collectionInput, setCollectionInput] = useState("");

  const isUsingCollection = myTrackers.length > 0 && sourceSearch === myTrackers.join(", ");
  const [, setVisiblePathsBySource] = useState<Record<string, number>>({});
  const latestRequestIdRef = useRef(0);

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
    
    if (deferredSource || deferredTarget) {
      if (maxJumps !== 5) params.set("jumps", maxJumps.toString());
      if (maxDays !== null) params.set("days", maxDays.toString());
      if (sortBy !== 'jumps') params.set("sort", sortBy);
      if (sortDirection !== 'asc') {
        params.set("order", sortDirection);
      }
      if (routesPerPageFromQuery !== DEFAULT_ROUTES_PER_PAGE) {
        params.set("perPage", routesPerPageFromQuery.toString());
      }
      const serializedSourcePages = serializeSourcePagesParam(sourcePagesFromQuery);
      if (serializedSourcePages) {
        params.set("sourcePages", serializedSourcePages);
      }
    }

    const trackerParam = searchParams.get("tracker");
    if (trackerParam) params.set("tracker", trackerParam);

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [deferredSource, deferredTarget, maxJumps, maxDays, sortBy, sortDirection, mounted, pathname, router, searchParams, routesPerPageFromQuery, sourcePagesFromQuery]);

  useEffect(() => {
    if (!deferredSource && !deferredTarget) {
      setFoundPaths([]);
      setSearchError(null);
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams();
        if (deferredSource) params.append("source", deferredSource);
        if (deferredTarget) params.append("target", deferredTarget);
        params.append("jumps", maxJumps.toString());
        if (maxDays !== null) params.append("days", maxDays.toString());

        const res = await fetch(`/api/routes?${params.toString()}`, { signal: controller.signal });
        const payload: unknown = await res.json();

        if (!res.ok) {
          const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Search request failed. Please try again.";
          throw new Error(message);
        }

        if (!Array.isArray(payload)) {
          throw new Error("Unexpected response format from the server.");
        }

        if (requestId === latestRequestIdRef.current) {
          setFoundPaths(payload as PathResult[]);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch routes", error);
        setFoundPaths([]);
        setSearchError(error instanceof Error ? error.message : "Failed to fetch routes.");
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [deferredSource, deferredTarget, maxJumps, maxDays]);

  useEffect(() => {
     if (!searchParams.get("source") && !searchParams.get("target")) {
        setSourceSearch("");
        setTargetSearch("");
        setFoundPaths([]);
        setSearchError(null);
        setVisiblePathsBySource({});
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
      if (viewControlsRef.current && !viewControlsRef.current.contains(event.target as Node)) {
        setShowViewControls(false);
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

  const getAbbr = useCallback((name: string) => getTrackerAbbr(name, data.abbrList), []);

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

  const getSuggestions = useCallback((query: string) => {
    if (!query) return [];
    const terms = query.split(",");
    const lastTerm = terms[terms.length - 1].trim().toLowerCase();
    if (!lastTerm) return [];

    return allTrackers.filter(t => {
      const abbr = getAbbr(t).toLowerCase();
      return t.toLowerCase().includes(lastTerm) || abbr.includes(lastTerm);
    }).slice(0, 8);
  }, [allTrackers, getAbbr]);

  const sourceSuggestions = useMemo(() => getSuggestions(sourceSearch), [sourceSearch, getSuggestions]);
  const targetSuggestions = useMemo(() => getSuggestions(targetSearch), [targetSearch, getSuggestions]);
  const collectionSuggestions = useMemo(() => getSuggestions(collectionInput), [collectionInput, getSuggestions]);

  const handleSourceSelect = (selectedItem: string) => {
    const terms = sourceSearch.split(",");
    terms.pop(); 
    terms.push(selectedItem); 
    setSourceSearch(terms.join(", ")); 
    setVisiblePathsBySource({});
    setShowSourceSug(false);
    setSourceActiveIndex(-1);
  };

  const handleTargetSelect = (selectedItem: string) => {
    setTargetSearch(selectedItem);
    setVisiblePathsBySource({});
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
    const suggestions = sourceSuggestions;
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
    const suggestions = targetSuggestions;
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
    const suggestions = collectionSuggestions;
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
    setVisiblePathsBySource({});
    setShowSourceSug(false);
    setSourceActiveIndex(-1);
  };

  const toggleSourceAccordion = (source: string) => {
    setExpandedSources(prev => ({
      ...prev,
      [source]: !prev[source]
    }));
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
            className="text-blue-500 hover:underline break-all sm:wrap-break-words"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const activeInviteCountBySource = useMemo(() => getActiveInviteCountBySource(data.routeInfo), []);

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

  const groupedResults = useMemo(() => {
    const groups: { [key: string]: PathResult[] } = {};
    sortedPaths.forEach(path => {
      if (!groups[path.source]) groups[path.source] = [];
      groups[path.source].push(path);
    });
    return groups;
  }, [sortedPaths]);

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

  useEffect(() => {
    if (sortedSourceNames.length > 0) {
      setExpandedSources({ [sortedSourceNames[0]]: true });
    } else {
      setExpandedSources({});
    }
  }, [deferredSource, deferredTarget, sortedSourceNames]);

  const getUnlockRequirementSections = useCallback((sourceName: string) => {
    const unlockInfo = data.unlockInviteClass[sourceName];
    if (!unlockInfo) {
      return [];
    }

    return parseRequirementSections(unlockInfo[1], sourceName);
  }, []);

  const trackerCanInviteTo = useMemo(() => {
    const invitesByTracker: { [key: string]: OfficialInviteEntry[] } = {};

    Object.keys(data.routeInfo).forEach(sourceName => {
      invitesByTracker[sourceName] = getOfficialInvitesForSource(
        data.routeInfo,
        sourceName,
        activeInviteCountBySource
      );
    });

    return invitesByTracker;
  }, [activeInviteCountBySource]);

  const trackerInvitedFrom = useMemo(() => {
    const invitesByTracker: { [key: string]: OfficialInviteEntry[] } = {};

    Object.keys(data.routeInfo).forEach(sourceName => {
      invitesByTracker[sourceName] = getInvitedFromForSource(
        data.routeInfo,
        sourceName,
        activeInviteCountBySource
      );
    });

    return invitesByTracker;
  }, [activeInviteCountBySource]);

  const setDialogTrackerInUrl = useCallback((trackerName: string | null, method: "push" | "replace" = "push") => {
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
  }, [pathname, router, searchParams]);

  const setRoutePageForSourceInUrl = useCallback((
    sourceName: string,
    page: number,
    pageSize: number,
    method: "push" | "replace" = "push"
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    const sourcePages = parseSourcePagesParam(params.get("sourcePages"));

    if (page > 1) sourcePages[sourceName] = page;
    else delete sourcePages[sourceName];

    const serializedSourcePages = serializeSourcePagesParam(sourcePages);
    if (serializedSourcePages) params.set("sourcePages", serializedSourcePages);
    else params.delete("sourcePages");

    if (pageSize !== DEFAULT_ROUTES_PER_PAGE) {
      params.set("perPage", pageSize.toString());
    } else {
      params.delete("perPage");
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    if (method === "replace") {
      router.replace(nextUrl, { scroll: false });
      return;
    }

    router.push(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  const setRoutesPerPageInUrl = useCallback((pageSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (pageSize !== DEFAULT_ROUTES_PER_PAGE) {
      params.set("perPage", pageSize.toString());
    } else {
      params.delete("perPage");
    }

    params.delete("sourcePages");
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.push(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  const openOfficialInvitesDialog = useCallback((sourceName: string, updateUrl = true) => {
    if (updateUrl) {
      setDialogTrackerInUrl(sourceName);
    }
  }, [setDialogTrackerInUrl]);

  const closeOfficialInvitesDialog = useCallback((updateUrl = true) => {
    if (updateUrl) {
      setDialogTrackerInUrl(null);
    }
  }, [setDialogTrackerInUrl]);

  useEffect(() => {
    if (!activeTrackerParam) {
      return;
    }

    if (!allTrackers.includes(activeTrackerParam)) {
      setDialogTrackerInUrl(null, "replace");
    }
  }, [activeTrackerParam, allTrackers, setDialogTrackerInUrl]);

  useEffect(() => {
    if (!deferredSource && !deferredTarget) {
      return;
    }

    const sanitizedSourcePages: Record<string, number> = {};
    for (const sourceName of sortedSourceNames) {
      const totalPages = Math.max(1, Math.ceil((groupedResults[sourceName]?.length ?? 0) / routesPerPageFromQuery));
      const requestedPage = sourcePagesFromQuery[sourceName] ?? 1;
      const clampedPage = Math.min(requestedPage, totalPages);
      if (clampedPage > 1) {
        sanitizedSourcePages[sourceName] = clampedPage;
      }
    }

    const currentSerialized = serializeSourcePagesParam(sourcePagesFromQuery);
    const nextSerialized = serializeSourcePagesParam(sanitizedSourcePages);
    if (currentSerialized === nextSerialized) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (nextSerialized) params.set("sourcePages", nextSerialized);
    else params.delete("sourcePages");

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [deferredSource, deferredTarget, groupedResults, pathname, router, routesPerPageFromQuery, searchParams, sortedSourceNames, sourcePagesFromQuery]);

  const officialInvitesDialog = useMemo<OfficialInvitesData | null>(() => {
    if (!activeTrackerParam || !allTrackers.includes(activeTrackerParam)) {
      return null;
    }

    return {
      sourceName: activeTrackerParam,
      sections: getUnlockRequirementSections(activeTrackerParam),
      canInviteTo: trackerCanInviteTo[activeTrackerParam] || [],
      invitedFrom: trackerInvitedFrom[activeTrackerParam] || [],
    };
  }, [activeTrackerParam, allTrackers, getUnlockRequirementSections, trackerCanInviteTo, trackerInvitedFrom]);


  if (!mounted) return <div className="w-full" />;

  const badgeClass = "flex items-center gap-1.5 text-xs font-semibold text-foreground/80 bg-foreground/10 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap";
  const infoBadgeClass = "flex items-center gap-1.5 px-2 py-1 bg-foreground/8 rounded-md text-xs md:text-sm font-medium text-foreground/70";

  return (
    <>
      <div className={`w-full relative z-40 transition-all duration-500 ease-out ${sourceSearch || targetSearch ? 'translate-y-0' : 'translate-y-4 md:translate-y-16'}`}>
        {!sourceSearch && !targetSearch && (
          <div className="text-center mb-10 space-y-4 motion-safe:animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-5xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              Discover the private tracker network.
            </h1>
            <p className="text-lg text-foreground/60 font-medium mx-auto leading-relaxed">
              Find your way to the trackers worth chasing. Explore detailed pathways, requirements, and invite tiers.
            </p>
          </div>
        )}

        <div className="w-full max-w-2xl mx-auto bg-foreground/3 border border-foreground/10 rounded-xl p-2 motion-safe:animate-in fade-in zoom-in-95 duration-200 relative z-30">
          <div className="flex flex-col relative">
              
            <div className="absolute left-4 top-4 bottom-14 flex flex-col items-center gap-1 z-0 pointer-events-none">
              <div className="w-2.5 h-2.5 rounded-full border-[3px] border-foreground/10 bg-background"></div>
              <div className="w-px flex-1 bg-foreground/10"></div>
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
                      setVisiblePathsBySource({});
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
                {!isUsingCollection && showSourceSug && sourceSuggestions.length > 0 && (
                  <div className="absolute top-full -left-8 w-[calc(100%+2rem)] mt-2 bg-card rounded-xl overflow-hidden z-50 motion-safe:animate-in fade-in zoom-in-95 duration-200 border border-foreground/10">
                    <div className="max-h-60 overflow-y-auto p-1" ref={sourceListRef}>
                      {sourceSuggestions.map((item, i) => (
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
                    setVisiblePathsBySource({});
                    setShowTargetSug(true);
                    setTargetActiveIndex(-1);
                  }}
                  onKeyDown={handleTargetKeyDown}
                />
                {showTargetSug && targetSuggestions.length > 0 && (
                  <div className="absolute top-full -left-8 w-[calc(100%+2rem)] mt-2 bg-card rounded-xl overflow-hidden z-50 motion-safe:animate-in fade-in zoom-in-95 duration-200 border border-foreground/10">
                    <div className="max-h-60 overflow-y-auto p-1" ref={targetListRef}>
                      {targetSuggestions.map((item, i) => (
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

            </div>

          </div>
        </div>

        {showFilters && (
          <div className="max-w-2xl mx-auto mt-2 p-6 bg-foreground/3 border border-foreground/10 rounded-xl motion-safe:animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="text-sm font-medium text-foreground/50 mb-2 block">Max jumps</label>
                <div className="flex rounded-lg bg-foreground/5 p-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setMaxJumps(val);
                        setVisiblePathsBySource({});
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
                        setVisiblePathsBySource({});
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
          <div className={`max-w-2xl mx-auto mt-2 p-6 bg-foreground/3 border border-foreground/10 rounded-xl motion-safe:animate-in fade-in slide-in-from-top-2 duration-200 relative z-20 transition-all ${showCollectionSug ? 'mb-40' : ''}`}>
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
                {showCollectionSug && collectionSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-card rounded-xl overflow-hidden z-50 motion-safe:animate-in fade-in zoom-in-95 duration-200 border border-foreground/10">
                    <div className="max-h-60 overflow-y-auto p-1" ref={collectionListRef}>
                      {collectionSuggestions.map((item, i) => (
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
        <div className="mt-12 motion-safe:animate-in fade-in slide-in-from-bottom-8 duration-200">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-foreground/3 border border-foreground/10 rounded-xl p-4 mb-6">
            <div className="flex flex-col gap-1 min-w-0">
              <h2 className="text-base md:text-lg font-bold text-foreground tracking-tight">Search Results</h2>
              {isLoading || isStale ? (
                <UiState kind="loading" title="Loading results" layout="inline" />
              ) : (
                <p className="text-sm font-medium text-foreground/60 truncate">
                  Found <span className="text-foreground/80 font-semibold">{sortedSourceNames.length}</span> source{sortedSourceNames.length === 1 ? '' : 's'} and <span className="text-foreground/80 font-semibold">{foundPaths.length}</span> route{foundPaths.length === 1 ? '' : 's'}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end w-full md:w-auto pt-3 md:pt-0 border-t border-foreground/5 md:border-0 shrink-0">
              <div className="relative" ref={viewControlsRef}>
                <button
                  type="button"
                  onClick={() => setShowViewControls((current) => !current)}
                  aria-expanded={showViewControls}
                  aria-haspopup="dialog"
                  className="h-9 rounded-md border border-foreground/10 bg-foreground/5 px-3 text-sm font-semibold text-foreground/80 transition-colors hover:border-foreground/20 hover:bg-foreground/10"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-rounded text-base">tune</span>
                    View
                  </span>
                </button>

                {showViewControls && (
                  <div className="absolute right-0 mt-2 w-fit max-w-[calc(100vw-2rem)] rounded-xl border border-foreground/10 bg-card p-3 z-20 shadow-lg motion-safe:animate-in fade-in zoom-in-95 duration-200">
                    <div className="grid grid-cols-[max-content_auto_max-content] gap-3 items-stretch">
                      <div className="w-40">
                        <span className="text-sm font-semibold text-foreground/60 mb-1 block">Sort by</span>
                        <div className="h-px bg-foreground/10 mb-2" />
                        <div className="flex flex-col gap-1">
                          {SORT_OPTIONS.map((option) => {
                            const isActive = sortBy === option.value;
                            const optionDirection = isActive ? sortDirection : "asc";
                            return (
                              <div
                                key={option.value}
                                className={`h-8 rounded-md px-2 text-sm font-normal transition-colors grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-1 ${
                                  isActive
                                    ? "bg-foreground/10 text-foreground"
                                    : "text-foreground/60 hover:text-foreground"
                                }`}
                              >
                                {isActive ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSortDirection((current) => current === "asc" ? "desc" : "asc");
                                      setVisiblePathsBySource({});
                                    }}
                                    className="h-5 w-5 inline-flex items-center justify-center text-foreground transition-colors hover:text-foreground/80"
                                    aria-label={`${option.label} sort ${optionDirection === "asc" ? "ascending" : "descending"}`}
                                  >
                                    <span className="material-symbols-rounded text-sm">
                                      {optionDirection === "asc" ? "arrow_upward" : "arrow_downward"}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="h-5 w-5" aria-hidden="true" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSortBy(option.value);
                                    if (!isActive) {
                                      setSortDirection("asc");
                                    }
                                    setVisiblePathsBySource({});
                                  }}
                                  className="text-left min-w-0"
                                >
                                  {option.label}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="w-px bg-foreground/10 rounded-full" />

                      <div className="w-40">
                        <span className="text-sm font-semibold text-foreground/60 mb-1 block">Per page</span>
                        <div className="h-px bg-foreground/10 mb-2" />
                        <div className="flex flex-col gap-1">
                          {ROUTES_PER_PAGE_OPTIONS.map((size) => {
                            const isActive = routesPerPageFromQuery === size;
                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() => setRoutesPerPageInUrl(size)}
                                className={`h-8 w-full rounded-md px-2 text-sm font-normal transition-colors flex items-center justify-start gap-1 ${
                                  isActive
                                    ? "bg-foreground/10 text-foreground"
                                    : "text-foreground/60 hover:text-foreground"
                                }`}
                              >
                                <span className={`material-symbols-rounded w-4 text-sm ${isActive ? "text-foreground opacity-100" : "opacity-0"}`}>
                                  radio_button_checked
                                </span>
                                <span className="leading-none">{size}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 pb-10">
            {sortedSourceNames.map((sourceName) => {
              const paths = groupedResults[sourceName];
              const sourceAbbr = getAbbr(sourceName);
              const officialInvites = trackerCanInviteTo[sourceName] || [];
              const sourceFoundCount = foundCountBySource[sourceName] || 0;
              const sourceTotalPages = Math.max(1, Math.ceil(paths.length / routesPerPageFromQuery));
              const sourceRoutePage = Math.min(sourcePagesFromQuery[sourceName] ?? 1, sourceTotalPages);
              const sourceRouteStart = (sourceRoutePage - 1) * routesPerPageFromQuery;
              const displayedSourcePaths = paths.slice(sourceRouteStart, sourceRouteStart + routesPerPageFromQuery);
              const sourcePageItems = buildPaginationItems(sourceRoutePage, sourceTotalPages);
              
              const bestHops = paths.length > 0 ? Math.min(...paths.map(p => p.routes.length)) : 0;
              const validDays = paths.filter(p => p.totalDays !== null).map(p => p.totalDays as number);
              const bestDays = validDays.length > 0 ? Math.min(...validDays) : null;
              const isExpanded = expandedSources[sourceName] ?? false;

              return (
                <div key={sourceName} className="flex flex-col bg-card border border-foreground/10 rounded-xl overflow-hidden transition-colors hover:border-foreground/20 motion-safe:animate-in fade-in duration-200">
                  
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSourceAccordion(sourceName)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSourceAccordion(sourceName);
                      }
                    }}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 p-4 md:px-5 md:py-4 cursor-pointer bg-foreground/3 hover:bg-foreground/5 transition-colors select-none"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                      <h3 className="text-lg font-bold text-foreground tracking-tight truncate">{sourceName}</h3>
                      <span className={badgeClass}>
                        {sourceAbbr}
                      </span>
                      <OfficialInvitesBadge
                        count={officialInvites.length}
                        ariaLabel={`Official invites for ${sourceName}: ${officialInvites.length}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openOfficialInvitesDialog(sourceName);
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:gap-3 shrink-0">
                      <div className={infoBadgeClass}>
                        <span className="material-symbols-rounded text-[14px] opacity-70">route</span>
                        <span>{sourceFoundCount} route{sourceFoundCount !== 1 && 's'}</span>
                      </div>
                      <div className={infoBadgeClass}>
                        <span className="material-symbols-rounded text-[14px] opacity-70">linear_scale</span>
                        <span>Best: {bestHops} hop{bestHops !== 1 && 's'}</span>
                      </div>
                      <div className={infoBadgeClass}>
                        <span className="material-symbols-rounded text-[14px] opacity-70">schedule</span>
                        <span>{bestDays !== null ? `${bestDays}d` : 'Unk'}</span>
                      </div>
                      <div className="flex items-center justify-center w-7 h-7 rounded-full transition-colors ml-1">
                        <span className={`material-symbols-rounded text-xl text-foreground/60 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                          keyboard_arrow_down
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <div className="p-4 md:p-5 border-t border-foreground/10 bg-background/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {displayedSourcePaths.map((path) => {
                            const targetAbbr = getAbbr(path.target);
                            const targetOfficialInvites = trackerCanInviteTo[path.target] || [];
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
                                        <OfficialInvitesBadge
                                          count={targetOfficialInvites.length}
                                          ariaLabel={`Official invites for ${path.target}: ${targetOfficialInvites.length}`}
                                          onClick={() => openOfficialInvitesDialog(path.target)}
                                        />
                                      </div>
                                    </div>
                                    
                                    {isBestPath && (
                                      <div className="mt-1.5 mb-1">
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-md">
                                          <span className="material-symbols-rounded text-sm">workspace_premium</span>
                                          {sortBy === 'days'
                                            ? sortDirection === "asc" ? "Fastest route overall" : "Slowest route overall"
                                            : sortBy === "officialInvites"
                                              ? sortDirection === "asc" ? "Fewest official invites" : "Most official invites"
                                              : sortDirection === "asc" ? "Fewest hops overall" : "Most hops overall"}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <span className={`text-sm font-medium bg-foreground/8 px-2 py-1 rounded-md whitespace-nowrap shrink-0 ${path.totalDays === null ? 'text-foreground/40' : 'text-foreground/70'}`}>
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
                                        
                                        <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-foreground/5">
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

                        {!isStale && !isLoading && paths.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-foreground/10 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="text-xs font-medium text-foreground/50">
                              Showing {sourceRouteStart + 1}-{Math.min(sourceRouteStart + routesPerPageFromQuery, paths.length)} of {paths.length} routes (page {sourceRoutePage}/{sourceTotalPages})
                            </div>
                            {sourceTotalPages > 1 && (
                              <div className="flex flex-wrap items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setRoutePageForSourceInUrl(sourceName, Math.max(1, sourceRoutePage - 1), routesPerPageFromQuery)}
                                  disabled={sourceRoutePage === 1}
                                  className="h-8 rounded-md border border-foreground/10 bg-foreground/5 px-2.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Prev
                                </button>
                                {sourcePageItems.map((item, index) => {
                                  if (item === "ellipsis-left" || item === "ellipsis-right") {
                                    return (
                                      <span key={`${sourceName}-${item}-${index}`} className="px-1 text-foreground/40">
                                        …
                                      </span>
                                    );
                                  }

                                  const isActive = item === sourceRoutePage;
                                  return (
                                    <button
                                      key={`${sourceName}-${item}`}
                                      type="button"
                                      onClick={() => setRoutePageForSourceInUrl(sourceName, item, routesPerPageFromQuery)}
                                      aria-current={isActive ? "page" : undefined}
                                      className={`h-8 min-w-8 rounded-md border px-2 text-xs font-semibold transition-colors ${
                                        isActive
                                          ? "border-foreground/20 bg-foreground/10 text-foreground"
                                          : "border-foreground/10 bg-foreground/5 text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
                                      }`}
                                    >
                                      {item}
                                    </button>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => setRoutePageForSourceInUrl(sourceName, Math.min(sourceTotalPages, sourceRoutePage + 1), routesPerPageFromQuery)}
                                  disabled={sourceRoutePage === sourceTotalPages}
                                  className="h-8 rounded-md border border-foreground/10 bg-foreground/5 px-2.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Next
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
            
            {!searchError && !isStale && !isLoading && foundPaths.length === 0 && (sourceSearch || targetSearch) && (
              <UiState
                kind="empty"
                title="No routes found"
                description="Try a different source, target, or filter."
                className="py-20"
              />
            )}

            {searchError && (
              <UiState kind="error" title="Could not load routes" description={searchError} />
            )}
          </div>
        </div>
      )}

      {officialInvitesDialog && (
        <OfficialInvitesDialog
          data={officialInvitesDialog}
          onClose={() => closeOfficialInvitesDialog()}
          onOpenTracker={(tracker) => openOfficialInvitesDialog(tracker)}
          getAbbr={getAbbr}
          renderReqs={renderReqs}
        />
      )}
    </>
  );
}
