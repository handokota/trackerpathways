"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/shared/Icon";

type ShareButtonProps = {
  title: string;
  className?: string;
};

export default function ShareButton({ title, className = "" }: ShareButtonProps) {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (feedback === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => setFeedback("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const handleShare = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      setFeedback("copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setFeedback("error");
    }
  };

  const label = feedback === "copied"
    ? "Link copied"
    : feedback === "error"
      ? "Unable to share"
      : "Share";

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-foreground/10 bg-foreground/5 px-3 text-sm font-semibold text-foreground/80 transition-colors hover:border-foreground/20 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${className}`}
    >
      <Icon name={feedback === "copied" ? "check_circle" : "share"} className="text-base text-icon-muted" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
