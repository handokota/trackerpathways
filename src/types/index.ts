export interface RouteDetail {
  days: number;
  reqs: string;
  active: string;
  updated: string;
}

export type UnlockClass = [
  number,
  string
];

export interface DataStructure {
  routeInfo: {
    [sourceTracker: string]: {
      [targetTracker: string]: RouteDetail;
    };
  };
  unlockInviteClass: {
    [trackerName: string]: UnlockClass;
  };
  abbrList: {
    [trackerName: string]: string;
  };
}

export interface PathResult {
  source: string;
  target: string;
  nodes: string[];
  totalDays: number;
  routes: RouteDetail[];
}

// Alias agar kompatibel
export type RouteRequirements = RouteDetail;