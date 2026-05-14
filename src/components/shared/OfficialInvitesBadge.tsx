import type { MouseEvent } from "react";

interface OfficialInvitesBadgeProps {
  count: number;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  ariaLabel: string;
  label?: string;
  labelClassName?: string;
  className?: string;
}

export default function OfficialInvitesBadge({
  count,
  onClick,
  ariaLabel,
  label,
  labelClassName = "",
  className = "",
}: OfficialInvitesBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative group inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 transition-colors hover:bg-blue-200 dark:hover:bg-blue-900/40 cursor-pointer shrink-0 ${className}`}
      aria-label={ariaLabel}
    >
      <span className="material-symbols-rounded text-sm">outbound</span>
      {label ? <span className={labelClassName}>{label}</span> : null}
      <span>{count}</span>
    </button>
  );
}
