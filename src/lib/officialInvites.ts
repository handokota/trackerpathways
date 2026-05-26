import type { DataStructure, RouteDetail } from "@/types";

export interface UnlockRequirementSection {
  key: string;
  rank: string;
  requirements: string[];
  requirementText: string;
}

export interface OfficialInviteEntry {
  tracker: string;
  details: RouteDetail;
  officialInvites: number;
}

export interface OfficialInvitesData {
  sourceName: string;
  sections: UnlockRequirementSection[];
  canInviteTo: OfficialInviteEntry[];
  invitedFrom: OfficialInviteEntry[];
}

export type OfficialInvitesTab = "canInviteTo" | "invitedFrom";
export type DialogSortByOption = "officialInvites" | "alphabetical";
export type SortDirection = "asc" | "desc";

type RouteInfo = DataStructure["routeInfo"];
type AbbrList = DataStructure["abbrList"];

export const getTrackerAbbr = (name: string, abbrList: AbbrList) => {
  if (abbrList[name]) {
    return abbrList[name];
  }

  const capitals = name.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) {
    return capitals.join("");
  }

  return name.substring(0, 3).toUpperCase();
};

export const parseRequirementSections = (text: string, keyPrefix: string): UnlockRequirementSection[] => {
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
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
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
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      return {
        key: `${keyPrefix}-${index}`,
        rank,
        requirements: rawRequirements,
        requirementText,
      };
    });
};

export const getActiveInviteCountBySource = (routeInfo: RouteInfo) => {
  const counts: Record<string, number> = {};
  Object.keys(routeInfo).forEach((sourceName) => {
    counts[sourceName] = Object.values(routeInfo[sourceName] || {})
      .filter((route) => route.active.toLowerCase() === "yes")
      .length;
  });
  return counts;
};

export const getOfficialInvitesForSource = (
  routeInfo: RouteInfo,
  sourceName: string,
  activeInviteCountBySource: Record<string, number>
): OfficialInviteEntry[] => {
  return Object.entries(routeInfo[sourceName] || {})
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

export const getInvitedFromForSource = (
  routeInfo: RouteInfo,
  sourceName: string,
  activeInviteCountBySource: Record<string, number>
): OfficialInviteEntry[] => {
  return Object.entries(routeInfo)
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

export const sortOfficialInvites = (
  invites: OfficialInviteEntry[],
  sortBy: DialogSortByOption,
  sortDirection: SortDirection
) => {
  const directionMultiplier = sortDirection === "asc" ? 1 : -1;

  return [...invites].sort((a, b) => {
    if (sortBy === "officialInvites" && a.officialInvites !== b.officialInvites) {
      return (a.officialInvites - b.officialInvites) * directionMultiplier;
    }

    return a.tracker.localeCompare(b.tracker) * (sortBy === "alphabetical" ? directionMultiplier : 1);
  });
};

export const getStatusColor = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === "yes" || normalized === "open") {
    return "ui-status-open";
  }
  if (normalized === "no" || normalized === "closed") {
    return "ui-status-closed";
  }
  return "ui-status-limited";
};

export const getStatusLabel = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === "yes") {
    return "Recruiting";
  }
  if (normalized === "no") {
    return "Closed";
  }
  return status;
};
