import type { Metadata } from "next";
import { Suspense } from "react";
import DirectoryPageClient from "@/components/DirectoryPageClient";
import PageShell from "@/components/layout/PageShell";
import UiState from "@/components/shared/UiState";

export const metadata: Metadata = {
  title: "Tracker Directory - Abbreviations List",
  description: "Complete directory of private trackers and their abbreviations.",
};

export default function DirectoryPage() {
  return (
    <PageShell className="min-h-screen">
      <Suspense fallback={<UiState kind="loading" title="Loading page" className="min-h-[50vh]" />}>
        <DirectoryPageClient />
      </Suspense>
    </PageShell>
  );
}
