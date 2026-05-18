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
      <Suspense
        fallback={(
          <div className="min-h-[50vh] flex items-center justify-center">
            <UiState kind="loading" title="Loading page" layout="inline" />
          </div>
        )}
      >
        <DirectoryPageClient />
      </Suspense>
    </PageShell>
  );
}
