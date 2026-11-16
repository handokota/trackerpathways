"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/shared/Icon";

type ShareButtonProps = {
  title: string;
  className?: string;
  iconOnly?: boolean;
  accessibleLabel?: string;
};

export default function ShareButton({
  title,
  className = "",
  iconOnly = false,
  accessibleLabel,
}: ShareButtonProps) {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (feedback === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => setFeedback("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const copyUrl = async (url: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = url;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();

    try {
      if (!document.execCommand("copy")) {
        throw new Error("Copy command was rejected.");
      }
    } finally {
      textArea.remove();
    }
  };

  const handleShare = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        }
      }

      await copyUrl(url);
      setFeedback("copied");
    } catch (error) {
      console.error("Failed to share or copy URL", error);
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
      aria-label={accessibleLabel ?? label}
      title={label}
      className={`inline-flex items-center justify-center gap-1.5 border border-foreground/10 bg-foreground/5 text-sm font-semibold text-foreground/80 transition-colors hover:border-foreground/20 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
        iconOnly ? "h-8 w-8 rounded-md p-0" : "h-10 rounded-xl px-3"
      } ${className}`}
    >
      <Icon name={feedback === "copied" ? "check_circle" : "share"} className="text-base text-icon-muted" />
      {!iconOnly && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
