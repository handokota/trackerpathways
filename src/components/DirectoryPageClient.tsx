"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import rawData from "@/data/trackers.json";
import { DataStructure, RouteDetail } from "@/types";

const data = rawData as unknown as DataStructure;
const TRACKERS_PAGE_SIZE = 20;

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
type DirectorySortByOption = "alphabetical" | "officialInvites";
type DialogSortByOption = "officialInvites" | "unlockAfter";
type SortDirection = "asc" | "desc";

interface OfficialInvitesDialogState {
  sourceName: string;
  unlockDays: number | null;
  sections: UnlockRequirementSection[];
  canInviteTo: OfficialInviteEntry[];
  invitedFrom: OfficialInviteEntry[];
}

export default function DirectoryPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<DirectorySortByOption>("alphabetical");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [officialInvitesDialog, setOfficialInvitesDialog] = useState<OfficialInvitesDialogState | null>(null);
  const [officialInvitesTab, setOfficialInvitesTab] = useState<OfficialInvitesTab>("canInviteTo");
  const [officialInvitesSortBy, setOfficialInvitesSortBy] = useState<DialogSortByOption>("officialInvites");
  const [officialInvitesSortDirection, setOfficialInvitesSortDirection] = useState<SortDirection>("desc");
  const [isUnlockAccordionOpen, setIsUnlockAccordionOpen] = useState(true);
  const [expandedOfficialInviteCards, setExpandedOfficialInviteCards] = useState<Record<string, boolean>>({});
  const [visibleTrackersCount, setVisibleTrackersCount] = useState(TRACKERS_PAGE_SIZE);
  const directoryLoadMoreRef = useRef<HTMLDivElement | null>(null);

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

  const activeInviteCountBySource = useMemo(() => {
    const counts: { [key: string]: number } = {};
    Object.keys(data.routeInfo).forEach(sourceName => {
      counts[sourceName] = Object.values(data.routeInfo[sourceName] || {})
        .filter(route => route.active.toLowerCase() === "yes")
        .length;
    });
    return counts;
  }, []);

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

  const getOfficialInvitesForSource = (sourceName: string): OfficialInviteEntry[] => {
    return Object.entries(data.routeInfo[sourceName] || {})
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
  };

  const getInvitedFromForSource = (sourceName: string): OfficialInviteEntry[] => {
    return Object.entries(data.routeInfo)
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
  };

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

  const openOfficialInvitesDialog = (sourceName: string, updateUrl = true) => {
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
      canInviteTo: getOfficialInvitesForSource(sourceName),
      invitedFrom: getInvitedFromForSource(sourceName),
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

    if (!data.abbrList[trackerParam]) {
      closeOfficialInvitesDialog(false);
      setDialogTrackerInUrl(null, "replace");
      return;
    }

    if (officialInvitesDialog?.sourceName === trackerParam) {
      return;
    }

    openOfficialInvitesDialog(trackerParam, false);
  }, [searchParams]);

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

  const trackers = useMemo(() => {
    if (!data.abbrList) return [];
    
    return Object.entries(data.abbrList).map(([name, abbr]) => ({
      name, abbr, officialInvites: activeInviteCountBySource[name] || 0
    }));
  }, [activeInviteCountBySource]);

  const filteredTrackers = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    const filtered = search
      ? trackers.filter(t =>
        t.name.toLowerCase().includes(normalizedSearch) ||
          t.abbr.toLowerCase().includes(normalizedSearch)
      )
      : trackers;

    return [...filtered].sort((a, b) => {
      const directionMultiplier = sortDirection === "asc" ? 1 : -1;

      if (sortBy === "officialInvites" && a.officialInvites !== b.officialInvites) {
        return (a.officialInvites - b.officialInvites) * directionMultiplier;
      }

      return a.name.localeCompare(b.name) * directionMultiplier;
    });
  }, [search, sortBy, sortDirection, trackers]);

  const displayedTrackers = useMemo(() => {
    return filteredTrackers.slice(0, visibleTrackersCount);
  }, [filteredTrackers, visibleTrackersCount]);
  const hasMoreTrackers = displayedTrackers.length < filteredTrackers.length;

  useEffect(() => {
    if (!hasMoreTrackers) {
      return;
    }

    const sentinel = directoryLoadMoreRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        observer.unobserve(sentinel);
        setVisibleTrackersCount((current) => Math.min(current + TRACKERS_PAGE_SIZE, filteredTrackers.length));
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [filteredTrackers.length, hasMoreTrackers, visibleTrackersCount]);

  return (
    <main className="w-full px-6 pt-24 md:pt-32 pb-10 min-h-screen">
      <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)_minmax(0,1fr)] md:items-end md:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 text-foreground">Tracker Directory</h1>
          <p className="text-sm text-foreground/60">
            Browse all {trackers.length} trackers and abbreviations.
          </p>
        </div>

        <div className="relative w-full md:w-full md:justify-self-center">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 flex items-center">
            <span className="material-symbols-rounded">search</span>
          </span>
          <input
            type="text"
            placeholder="Search directory..."
            className="w-full bg-foreground/3 border border-foreground/10 rounded-xl py-2.5 pl-11 pr-4 outline-none focus:outline-none focus:ring-2 focus:ring-foreground/10 font-medium text-foreground placeholder:text-foreground/30 text-sm transition-all"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleTrackersCount(TRACKERS_PAGE_SIZE);
            }}
          />
        </div>

        <div className="w-full flex items-center justify-end gap-2">
          <span className="text-sm font-medium text-foreground/60">Sort by</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(event) => {
                const nextSortBy = event.target.value as DirectorySortByOption;
                setSortBy(nextSortBy);
                setSortDirection(nextSortBy === "officialInvites" ? "desc" : "asc");
                setVisibleTrackersCount(TRACKERS_PAGE_SIZE);
              }}
              className="h-9 min-w-[176px] appearance-none rounded-md border border-foreground/10 bg-foreground/5 pl-3 pr-8 text-sm font-semibold text-foreground/80 outline-none transition-colors hover:border-foreground/20 focus:border-foreground/30"
              aria-label="Sort directory results"
            >
              <option value="alphabetical">Alphabetically</option>
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

      {filteredTrackers.length > 0 ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedTrackers.map((t) => (
              <div 
                key={t.name} 
                className="bg-card border border-foreground/10 rounded-xl p-4 flex items-center justify-between"
              >
                <span className="text-sm font-medium truncate text-foreground/80 pr-3" title={t.name}>
                  {t.name}
                </span>
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openOfficialInvitesDialog(t.name)}
                    className="relative group inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 transition-colors hover:bg-blue-200 dark:hover:bg-blue-900/40 cursor-pointer"
                    aria-label={`Official invites for ${t.name}: ${t.officialInvites}`}
                  >
                    <span className="material-symbols-rounded text-sm">outbound</span>
                    <span>{t.officialInvites}</span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 translate-y-2 rounded-md border border-foreground/15 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 whitespace-nowrap opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                      Official Invites: {t.officialInvites}
                    </span>
                  </button>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-foreground/10 text-foreground/80">
                    {t.abbr}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {hasMoreTrackers && (
            <div ref={directoryLoadMoreRef} className="h-10 flex items-center justify-center">
              <div className="inline-flex items-center gap-1.5 text-sm text-foreground/50">
                <span className="material-symbols-rounded text-sm animate-spin">progress_activity</span>
                <span>Loading more trackers...</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-50 border-2 border-dashed border-foreground/10 rounded-xl">
          <span className="material-symbols-rounded text-6xl mb-4 text-foreground/20">search_off</span>
          <p className="text-foreground/50 font-medium">
            No trackers found matching &quot;{search}&quot;
          </p>
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
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80 bg-foreground/10 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                                {data.abbrList[invite.tracker] || invite.tracker.substring(0, 3).toUpperCase()}
                              </span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openOfficialInvitesDialog(invite.tracker);
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
    </main>
  );
}
