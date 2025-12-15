import type { Metadata } from "next";
import rawData from "@/data/trackers.json";
import { DataStructure } from "@/types";
import { transformDataToGraph } from "@/lib/graphUtils";
import TrackerGraph from "@/components/TrackerGraph";

export const metadata: Metadata = {
  title: "Tracker Map - Visual Network",
  description: "Interactive visualization of tracker pathways.",
};

const data = rawData as unknown as DataStructure;

export default function MapPage() {
  const graphData = transformDataToGraph(data);

  return (
    <main className="fixed inset-0 top-16 w-full overflow-hidden bg-background">
      <TrackerGraph data={graphData} rawData={data} />
    </main>
  );
}