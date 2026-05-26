import type { SortDirection } from "@/lib/officialInvites";

interface SortDirectionButtonProps {
  direction: SortDirection;
  onToggle: () => void;
  size?: "sm" | "md";
  className?: string;
  showTooltip?: boolean;
}

export default function SortDirectionButton({
  direction,
  onToggle,
  size = "md",
  className = "",
  showTooltip = false,
}: SortDirectionButtonProps) {
  const isSmall = size === "sm";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative group shrink-0 inline-flex items-center justify-center rounded-md text-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
        isSmall ? "h-8 w-8" : "h-9 w-9"
      } ${className}`}
      aria-label={`Sort ${direction === "asc" ? "ascending" : "descending"}`}
    >
      <span className={`material-symbols-rounded ${isSmall ? "text-sm" : "text-base"}`}>
        {direction === "asc" ? "arrow_upward" : "arrow_downward"}
      </span>
      {showTooltip && (
        <span className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 translate-y-2 rounded-md border border-foreground/15 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 whitespace-nowrap opacity-0 transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 hidden md:block">
          Sort: {direction === "asc" ? "Ascending" : "Descending"}
        </span>
      )}
    </button>
  );
}
