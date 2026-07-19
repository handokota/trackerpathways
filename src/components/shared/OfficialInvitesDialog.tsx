"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { OfficialInvitesData } from "@/lib/officialInvites";
import OfficialInvitesContent from "@/components/shared/OfficialInvitesContent";
import useFocusTrap from "@/hooks/useFocusTrap";

interface OfficialInvitesDialogProps {
  data: OfficialInvitesData;
  onClose: () => void;
  onOpenTracker: (tracker: string) => void;
  getAbbr: (tracker: string) => string;
  renderReqs: (text: string) => ReactNode;
}

export default function OfficialInvitesDialog({
  data,
  onClose,
  onOpenTracker,
  getAbbr,
  renderReqs,
}: OfficialInvitesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useFocusTrap({
    active: true,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onEscape: onClose,
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 motion-safe:animate-in fade-in duration-200 overscroll-none touch-none"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="official-invites-dialog-title"
        tabIndex={-1}
        ref={dialogRef}
        className="w-full max-w-2xl max-h-[85dvh] rounded-xl border border-foreground/15 bg-card flex flex-col overflow-hidden motion-safe:animate-in zoom-in-95 duration-200 pointer-events-auto touch-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-4 pb-4 pt-4 border-b border-foreground/10 shrink-0">
          <div>
            <h2 id="official-invites-dialog-title" className="text-lg font-bold text-foreground">
              {data.sourceName}
            </h2>
            <p className="text-sm text-foreground/70 mt-0.5">
              Official invites
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            ref={closeButtonRef}
            className="p-1.5 rounded-md text-foreground/70 transition-colors hover:text-foreground"
            aria-label="Close dialog"
          >
            <span className="material-symbols-rounded text-lg">close</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto overflow-x-hidden overscroll-contain space-y-4 custom-scrollbar flex-1 min-h-0">
          <OfficialInvitesContent
            key={data.sourceName}
            data={data}
            onOpenTracker={onOpenTracker}
            getAbbr={getAbbr}
            renderReqs={renderReqs}
            layout="dialog"
          />
        </div>
      </div>
    </div>
  );
}
