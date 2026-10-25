import { NextResponse } from "next/server";
import rawData from "@/data/trackers.json";
import { DataStructure, PathResult } from "@/types";

const data = rawData as unknown as DataStructure;
const MAX_API_JUMPS = 8;
const MAX_API_DAYS = 3650;
const MAX_PATHS_LIMIT = 999;
const MAX_QUERY_LENGTH = 256;
const MAX_SOURCE_ITEMS = 16;
const MAX_SOURCE_ITEM_LENGTH = 64;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 6;
const RATE_LIMIT_MAX_BUCKETS = 5000;
const allTrackerKeys = Object.keys(data.routeInfo);
const allTrackers = Array.from(new Set([
  ...allTrackerKeys,
  ...allTrackerKeys.flatMap((key) => Object.keys(data.routeInfo[key] || {})),
]));

interface RouteSearchResult extends PathResult {
  stepDays: Array<number | null>;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

const getAbbr = (name: string) => {
  if (data.trackerInfo[name]) return data.trackerInfo[name].abbr;
  const capitals = name.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) return capitals.join("");
  return name.substring(0, 3).toUpperCase();
};

const strictTrackerIdentifiers = new Set(
  allTrackers.flatMap((trackerName) => [trackerName.toLowerCase(), getAbbr(trackerName).toLowerCase()])
);

const parseAndValidatePositiveInt = (
  rawValue: string | null,
  fallback: number,
  min: number,
  max: number
): number | null => {
  if (!rawValue) {
    return fallback;
  }

  if (!/^\d+$/.test(rawValue)) {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
};

const getClientIdentifier = (request: Request): string => {
  if (process.env.TRUSTED_PROXY_HEADERS === "true") {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      const firstIp = forwardedFor.split(",")[0]?.trim();
      if (firstIp && firstIp.length <= 64) {
        return firstIp;
      }
    }

    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp && realIp.length <= 64) {
      return realIp;
    }

    const connectingIp = request.headers.get("cf-connecting-ip")?.trim();
    if (connectingIp && connectingIp.length <= 64) {
      return connectingIp;
    }
  }

  return "direct-client";
};

const pruneExpiredRateLimitBuckets = (now: number) => {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
};

const consumeRateLimit = (clientKey: string, now: number): RateLimitResult => {
  pruneExpiredRateLimitBuckets(now);

  const existingBucket = rateLimitBuckets.get(clientKey);
  if (!existingBucket || existingBucket.resetAt <= now) {
    if (rateLimitBuckets.size >= RATE_LIMIT_MAX_BUCKETS) {
      const oldestKey = rateLimitBuckets.keys().next().value;
      if (oldestKey) {
        rateLimitBuckets.delete(oldestKey);
      }
    }

    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitBuckets.set(clientKey, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt,
    };
  }

  if (existingBucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existingBucket.resetAt,
    };
  }

  existingBucket.count += 1;
  rateLimitBuckets.set(clientKey, existingBucket);
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - existingBucket.count,
    resetAt: existingBucket.resetAt,
  };
};

const buildRateLimitHeaders = (rateLimit: RateLimitResult) => ({
  "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
  "X-RateLimit-Remaining": rateLimit.remaining.toString(),
  "X-RateLimit-Reset": Math.ceil(rateLimit.resetAt / 1000).toString(),
});

const buildRateLimitExceededHeaders = (rateLimit: RateLimitResult, now: number) => ({
  ...buildRateLimitHeaders(rateLimit),
  "Retry-After": Math.max(1, Math.ceil((rateLimit.resetAt - now) / 1000)).toString(),
});

export async function GET(request: Request) {
  const now = Date.now();
  const rateLimit = consumeRateLimit(getClientIdentifier(request), now);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429, headers: buildRateLimitExceededHeaders(rateLimit, now) }
    );
  }

  const { searchParams } = new URL(request.url);
  const sourceRaw = searchParams.get("source") || "";
  const targetRaw = searchParams.get("target") || "";
  const maxJumpsRaw = searchParams.get("jumps");
  const maxJumps = parseAndValidatePositiveInt(maxJumpsRaw, 1, 1, MAX_API_JUMPS);
  const maxDaysStr = searchParams.get("days");
  const maxDays = maxDaysStr
    ? parseAndValidatePositiveInt(maxDaysStr, 1, 1, MAX_API_DAYS)
    : null;

  if (sourceRaw.length > MAX_QUERY_LENGTH || targetRaw.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `source and target must be at most ${MAX_QUERY_LENGTH} characters.` },
      { status: 400, headers: buildRateLimitHeaders(rateLimit) }
    );
  }

  if (maxJumps === null) {
    return NextResponse.json(
      { error: `Invalid jumps value. Use an integer between 1 and ${MAX_API_JUMPS}.` },
      { status: 400, headers: buildRateLimitHeaders(rateLimit) }
    );
  }

  if (maxDaysStr && maxDays === null) {
    return NextResponse.json(
      { error: `Invalid days value. Use an integer between 1 and ${MAX_API_DAYS}.` },
      { status: 400, headers: buildRateLimitHeaders(rateLimit) }
    );
  }

  const sQueryRaw = sourceRaw.toLowerCase().trim();
  const sourceInputs = sQueryRaw
    ? Array.from(new Set(sQueryRaw.split(",").map((source) => source.trim()).filter(Boolean)))
    : [];
  const tQuery = targetRaw.toLowerCase().trim();

  if (
    sourceInputs.length > MAX_SOURCE_ITEMS ||
    sourceInputs.some((source) => source.length > MAX_SOURCE_ITEM_LENGTH) ||
    tQuery.length > MAX_SOURCE_ITEM_LENGTH
  ) {
    return NextResponse.json(
      { error: `Search terms must contain at most ${MAX_SOURCE_ITEMS} sources and ${MAX_SOURCE_ITEM_LENGTH} characters per term.` },
      { status: 400, headers: buildRateLimitHeaders(rateLimit) }
    );
  }

  if (!sQueryRaw && !tQuery) {
    return NextResponse.json([], { headers: buildRateLimitHeaders(rateLimit) });
  }

  const isStrictTarget = strictTrackerIdentifiers.has(tQuery);

  let startNodes: string[] = [];

  if (sourceInputs.length > 0) {
    startNodes = allTrackerKeys.filter((trackerName) => {
      const trackerLower = trackerName.toLowerCase();
      const trackerAbbr = getAbbr(trackerName).toLowerCase();
      return sourceInputs.some((input) => {
        const isStrictInput = strictTrackerIdentifiers.has(input);
        if (isStrictInput) {
          return trackerLower === input || trackerAbbr === input;
        }
        return trackerLower.includes(input) || trackerAbbr === input;
      });
    });
  } else if (tQuery) {
    startNodes = allTrackerKeys;
  }

  const startNodeSet = new Set(startNodes);
  const results: RouteSearchResult[] = [];
  const queue: RouteSearchResult[] = startNodes.map((start) => ({
      source: start,
      target: start,
      nodes: [start],
      totalDays: 0,
      stepDays: [],
      routes: []
    }));

  let pathsFound = 0;

  for (let queueIndex = 0; queueIndex < queue.length && pathsFound < MAX_PATHS_LIMIT; queueIndex += 1) {
    const currentPath = queue[queueIndex];

    const currentNode = currentPath.nodes[currentPath.nodes.length - 1];
    if (!currentNode) continue;

    if (currentPath.nodes.length > 1) {
      let isTargetMatch = true;
      if (tQuery) {
        const cName = currentNode.toLowerCase();
        const cAbbr = getAbbr(currentNode).toLowerCase();
        if (isStrictTarget) {
          isTargetMatch = cName === tQuery || cAbbr === tQuery;
        } else {
          isTargetMatch = cName.includes(tQuery) || cAbbr.includes(tQuery);
        }
      }

      if (isTargetMatch) {
        if (maxDays === null || (currentPath.totalDays !== null && currentPath.totalDays <= maxDays)) {
          results.push(currentPath);
          pathsFound++;
        }
      }
    }

    if (currentPath.routes.length >= maxJumps) continue;

    const neighbors = data.routeInfo[currentNode];
    if (neighbors) {
      for (const [nextTracker, details] of Object.entries(neighbors)) {
        if (startNodeSet.has(nextTracker) && nextTracker.toLowerCase() !== tQuery) {
          continue;
        }

        if (!currentPath.nodes.includes(nextTracker)) {
          const edgeDays = details.days;
          const forumReq = data.unlockInviteClass[currentNode];
          const forumDays = forumReq?.[0] ?? 0;
          let stepDays: number | null = null;

          if (edgeDays !== null) {
            stepDays = Math.max(edgeDays, forumDays);
          }

          const nextTotalDays = (currentPath.totalDays === null || stepDays === null) ? null : currentPath.totalDays + stepDays;

          if (maxDays !== null && nextTotalDays !== null && nextTotalDays > maxDays) continue;

          queue.push({
            source: currentPath.source,
            target: nextTracker,
            nodes: [...currentPath.nodes, nextTracker],
            totalDays: nextTotalDays,
            stepDays: [...currentPath.stepDays, stepDays],
            routes: [...currentPath.routes, details]
          });
        }
      }
    }
  }

  results.sort((a, b) => {
    if (a.routes.length !== b.routes.length) return a.routes.length - b.routes.length;
    const aDays = a.totalDays ?? Number.POSITIVE_INFINITY;
    const bDays = b.totalDays ?? Number.POSITIVE_INFINITY;
    if (aDays !== bDays) return aDays - bDays;
    return a.target.localeCompare(b.target);
  });

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "private, no-store",
      ...buildRateLimitHeaders(rateLimit),
    },
  });
}
