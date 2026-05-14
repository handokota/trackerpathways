import type { Metadata } from "next";
import { Suspense } from "react";
import rawData from "@/data/trackers.json";
import { DataStructure } from "@/types";
import { transformDataToGraph } from "@/lib/graphUtils";
import TrackerGraph from "@/components/TrackerGraph";
import FullScreenShell from "@/components/layout/FullScreenShell";
import UiState from "@/components/shared/UiState";

export const metadata: Metadata = {
  title: "Tracker Map - Visual Network",
  description: "Interactive visualization of tracker pathways.",
};

const data = rawData as unknown as DataStructure;

export default function MapPage() {
  const graphData = transformDataToGraph(data);

  return (
    <FullScreenShell>
      <Suspense fallback={<UiState kind="loading" title="Loading page" className="h-full rounded-none border-0 bg-transparent" />}>
        <TrackerGraph data={graphData} rawData={data} />
      </Suspense>
    </FullScreenShell>
  );
}
