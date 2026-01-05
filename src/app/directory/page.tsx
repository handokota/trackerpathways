import type { Metadata } from "next";
import DirectoryPageClient from "@/components/DirectoryPageClient";

export const metadata: Metadata = {
  title: "Tracker Directory - Abbreviations List",
  description: "Complete directory of private trackers and their abbreviations.",
};

export default function DirectoryPage() {
  return <DirectoryPageClient />;
}