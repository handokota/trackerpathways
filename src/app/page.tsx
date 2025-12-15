import type { Metadata } from "next";
import { Suspense } from "react";
import TrackerSearchApp from "@/components/TrackerSearchApp";

export const metadata: Metadata = {
  title: "Tracker Pathways - Discover the private tracker network",
  description: "Find your way to the trackers worth chasing.",
};

export default function Home() {
  return (
    <main className="w-full px-6 pt-24 md:pt-32 pb-10">
      <Suspense fallback={<div className="w-full min-h-[50vh]" />}>
        <TrackerSearchApp />
      </Suspense>
    </main>
  );
}