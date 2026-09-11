export interface RouteDetail {
  days: number | null;
  reqs: string;
  active: string;
  updated: string;
}

export type UnlockClass = [
  number | null,
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
  trackerInfo: {
    [trackerName: string]: TrackerDetail;
  };
}

export interface TrackerDetail {
  abbr: string,
  type: string,
  country: string,
  birthdate: string | number,
  description: string
}

export interface PathResult {
  source: string;
  target: string;
  nodes: string[];
  totalDays: number | null;
  stepDays?: Array<number | null>;
  routes: RouteDetail[];
}

export type RouteRequirements = RouteDetail;
