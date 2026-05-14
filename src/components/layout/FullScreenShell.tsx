import type { ReactNode } from "react";

interface FullScreenShellProps {
  children: ReactNode;
  className?: string;
}

const FULL_SCREEN_SHELL_BASE_CLASS = "fixed inset-x-0 bottom-0 top-16 w-full overflow-hidden bg-background";

export default function FullScreenShell({ children, className = "" }: FullScreenShellProps) {
  return (
    <main className={`${FULL_SCREEN_SHELL_BASE_CLASS} ${className}`.trim()}>
      {children}
    </main>
  );
}
