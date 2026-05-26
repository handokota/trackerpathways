"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import rawData from "@/data/trackers.json";
import { DataStructure } from "@/types";
import {
  OfficialInvitesData,
  SortDirection,
  getActiveInviteCountBySource,
  getInvitedFromForSource,
  getOfficialInvitesForSource,
  getTrackerAbbr,
  parseRequirementSections,
} from "@/lib/officialInvites";
import OfficialInvitesDialog from "@/components/shared/OfficialInvitesDialog";
import OfficialInvitesBadge from "@/components/shared/OfficialInvitesBadge";
import UiState from "@/components/shared/UiState";

const data = rawData as unknown as DataStructure;
const TRACKERS_PAGE_SIZE = 20;

type DirectorySortByOption = "alphabetical" | "officialInvites";

const DIRECTORY_SORT_OPTIONS: Array<{ value: DirectorySortByOption; label: string }> = [
  { value: "alphabetical", label: "Name" },
  { value: "officialInvites", label: "Official" },
];

export default function DirectoryPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTrackerParam = searchParams.get("tracker");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<DirectorySortByOption>("alphabetical");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showViewControls, setShowViewControls] = useState(false);
  const [visibleTrackersCount, setVisibleTrackersCount] = useState(TRACKERS_PAGE_SIZE);
  const directoryLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const viewControlsRef = useRef<HTMLDivElement | null>(null);

  const activeInviteCountBySource = useMemo(() => getActiveInviteCountBySource(data.routeInfo), []);

  const getUnlockRequirementSections = useCallback((sourceName: string) => {
    const unlockInfo = data.unlockInviteClass[sourceName];
    if (!unlockInfo) {
      return [];
    }

    return parseRequirementSections(unlockInfo[1], sourceName);
  }, []);

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

    if (!data.abbrList[activeTrackerParam]) {
      setDialogTrackerInUrl(null, "replace");
    }
  }, [activeTrackerParam, setDialogTrackerInUrl]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewControlsRef.current && !viewControlsRef.current.contains(event.target as Node)) {
        setShowViewControls(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const officialInvitesDialog = useMemo<OfficialInvitesData | null>(() => {
    if (!activeTrackerParam || !data.abbrList[activeTrackerParam]) {
      return null;
    }

    return {
      sourceName: activeTrackerParam,
      sections: getUnlockRequirementSections(activeTrackerParam),
      canInviteTo: getOfficialInvitesForSource(data.routeInfo, activeTrackerParam, activeInviteCountBySource),
      invitedFrom: getInvitedFromForSource(data.routeInfo, activeTrackerParam, activeInviteCountBySource),
    };
  }, [activeInviteCountBySource, activeTrackerParam, getUnlockRequirementSections]);

  const getAbbr = (name: string) => getTrackerAbbr(name, data.abbrList);

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
    <section className="w-full">
      <div className="mb-8 md:mb-12 flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)_minmax(0,1fr)] items-start md:items-end gap-4 md:gap-6">
        <div className="w-full">
          <h1 className="text-2xl font-bold tracking-tight mb-1 text-foreground">Tracker Directory</h1>
          <p className="text-sm text-foreground/60">
            Browse all {trackers.length} trackers and abbreviations.
          </p>
        </div>

        <div className="w-full flex items-center gap-2 md:contents">
          <div className="relative flex-1 md:justify-self-center shrink-0">
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

          <div className="flex items-center justify-end shrink-0">
            <div className="relative" ref={viewControlsRef}>
              <button
                type="button"
                onClick={() => setShowViewControls((current) => !current)}
                aria-expanded={showViewControls}
                aria-haspopup="dialog"
                className="h-10 rounded-xl border border-foreground/10 bg-foreground/5 px-3 text-sm font-semibold text-foreground/80 transition-colors hover:border-foreground/20 hover:bg-foreground/10"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-base">tune</span>
                  View
                </span>
              </button>

              {showViewControls && (
                <div className="absolute right-0 mt-2 w-fit max-w-[calc(100vw-2rem)] rounded-xl border border-foreground/10 bg-card p-3 z-20 shadow-lg motion-safe:animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-32">
                    <span className="text-sm font-semibold text-foreground/60 mb-1 block">Sort by</span>
                    <div className="h-px bg-foreground/10 mb-2" />
                    <div className="flex flex-col gap-1">
                      {DIRECTORY_SORT_OPTIONS.map((option) => {
                        const isActive = sortBy === option.value;
                        const optionDirection = isActive
                          ? sortDirection
                          : option.value === "officialInvites"
                            ? "desc"
                            : "asc";
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
                                setSortDirection(option.value === "officialInvites" ? "desc" : "asc");
                                setVisibleTrackersCount(TRACKERS_PAGE_SIZE);
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
                </div>
              )}
            </div>
          </div>
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
                  <OfficialInvitesBadge
                    count={t.officialInvites}
                    ariaLabel={`Official invites for ${t.name}: ${t.officialInvites}`}
                    onClick={() => openOfficialInvitesDialog(t.name)}
                  />
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-foreground/10 text-foreground/80">
                    {t.abbr}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {hasMoreTrackers && (
            <div ref={directoryLoadMoreRef} className="h-10 flex items-center justify-center">
              <UiState kind="loading" title="Loading results" layout="inline" />
            </div>
          )}
        </div>
      ) : (
        <UiState
          kind="empty"
          title="No trackers found"
          description={`No match for "${search}". Try another tracker name or abbreviation.`}
          className="py-20"
        />
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
    </section>
  );
}
