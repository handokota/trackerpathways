import type { ReactNode } from "react";

type UiStateKind = "loading" | "empty" | "error";
type UiStateLayout = "card" | "inline";

interface UiStateProps {
  kind: UiStateKind;
  title?: string;
  description?: ReactNode;
  layout?: UiStateLayout;
  className?: string;
}

const STATE_CONFIG: Record<UiStateKind, { icon: string; title: string }> = {
  loading: { icon: "progress_activity", title: "Loading content" },
  empty: { icon: "search_off", title: "No results found" },
  error: { icon: "error", title: "Something went wrong" },
};

export default function UiState({
  kind,
  title,
  description,
  layout = "card",
  className = "",
}: UiStateProps) {
  const config = STATE_CONFIG[kind];
  const resolvedTitle = title || config.title;

  if (layout === "inline") {
    const inlineColor = kind === "error" ? "text-red-700 dark:text-red-300" : "text-foreground/60";
    return (
      <div className={`inline-flex items-center gap-1.5 text-sm ${inlineColor} ${className}`.trim()}>
        <span className={`material-symbols-rounded text-[15px] ${kind === "loading" ? "animate-spin" : ""}`}>
          {config.icon}
        </span>
        <span>{resolvedTitle}</span>
      </div>
    );
  }

  const cardClass =
    kind === "error"
      ? "border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
      : "border-2 border-dashed border-foreground/10 bg-foreground/3 text-foreground/60";

  const iconClass = kind === "error" ? "text-red-500/80" : "text-foreground/25";

  return (
    <div className={`w-full flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-16 text-center ${cardClass} ${className}`.trim()}>
      <span className={`material-symbols-rounded text-5xl ${iconClass} ${kind === "loading" ? "animate-spin" : ""}`}>
        {config.icon}
      </span>
      <p className="text-base font-semibold text-current">{resolvedTitle}</p>
      {description ? <p className="text-sm text-current/90 max-w-xl">{description}</p> : null}
    </div>
  );
}
