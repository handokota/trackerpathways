import type { Metadata } from "next";
import { Suspense } from "react";
import TrackerSearchApp from "@/components/TrackerSearchApp";
import PageShell from "@/components/layout/PageShell";
import UiState from "@/components/shared/UiState";

export const metadata: Metadata = {
  title: "Tracker Pathways - Discover the private tracker network",
  description: "Find your way to the trackers worth chasing. Explore detailed pathways, requirements, and invite tiers.",
};

export default function Home() {
  return (
    <PageShell>
      <Suspense fallback={<UiState kind="loading" title="Loading page" className="min-h-[50vh]" />}>
        <TrackerSearchApp />
      </Suspense>
    </PageShell>
  );
}
