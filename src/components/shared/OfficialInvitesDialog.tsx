import type { ReactNode } from "react";
import type { OfficialInvitesData } from "@/lib/officialInvites";
import OfficialInvitesContent from "@/components/shared/OfficialInvitesContent";

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center bg-black/55 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200 overscroll-none touch-none"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="official-invites-dialog-title"
        className="w-full md:max-w-2xl max-h-[85dvh] rounded-t-2xl md:rounded-xl border border-foreground/15 bg-card flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 md:slide-in-from-bottom-0 duration-300 pointer-events-auto touch-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <span className="h-1.5 w-12 rounded-full bg-foreground/20" />
        </div>
        <div className="flex items-start justify-between gap-4 px-4 pb-4 md:pt-4 border-b border-foreground/10 shrink-0">
          <div>
            <h2 id="official-invites-dialog-title" className="text-lg font-bold text-foreground">
              {data.sourceName}
            </h2>
            <p className="text-sm text-foreground/70 mt-0.5">
              Official invite forum and official invites
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
