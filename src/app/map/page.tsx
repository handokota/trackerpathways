import type { Metadata } from "next";
import { Suspense } from "react";
import rawData from "@/data/trackers.json";
import { DataStructure } from "@/types";
import { transformDataToGraph } from "@/lib/graphUtils";
import TrackerGraph from "@/components/TrackerGraph";
import FullScreenShell from "@/components/layout/FullScreenShell";

export const metadata: Metadata = {
  title: "Tracker Map - Visual Network",
  description: "Interactive visualization of tracker pathways.",
};

const data = rawData as unknown as DataStructure;

export default function MapPage() {
  const graphData = transformDataToGraph(data);

  return (
    <FullScreenShell>
      <Suspense fallback={<div className="w-full h-full" />}>
        <TrackerGraph data={graphData} rawData={data} />
      </Suspense>
    </FullScreenShell>
  );
}
