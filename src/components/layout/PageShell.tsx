import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

const PAGE_SHELL_BASE_CLASS = "w-full px-6 pt-24 md:pt-32 pb-10";

export default function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <main className={`${PAGE_SHELL_BASE_CLASS} ${className}`.trim()}>
      {children}
    </main>
  );
}
