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
      className={`relative group inline-flex items-center gap-1 text-xs font-semibold ui-accent-badge px-2 py-0.5 rounded-md transition-colors duration-200 motion-reduce:transition-none cursor-pointer shrink-0 ${className}`}
      aria-label={ariaLabel}
    >
      <span className="material-symbols-rounded text-sm">outbound</span>
      {label ? <span className={labelClassName}>{label}</span> : null}
      <span>{count}</span>
    </button>
  );
}
