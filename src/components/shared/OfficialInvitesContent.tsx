import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  DialogSortByOption,
  OfficialInvitesData,
  OfficialInvitesTab,
  SortDirection,
  getStatusColor,
  getStatusLabel,
  parseRequirementSections,
  sortOfficialInvites,
} from "@/lib/officialInvites";
import SortDirectionButton from "@/components/shared/SortDirectionButton";
import OfficialInvitesBadge from "@/components/shared/OfficialInvitesBadge";

interface OfficialInvitesContentProps {
  data: OfficialInvitesData;
  onOpenTracker: (tracker: string) => void;
  getAbbr: (tracker: string) => string;
  renderReqs: (text: string) => ReactNode;
  layout?: "dialog" | "panel";
}

export default function OfficialInvitesContent({
  data,
  onOpenTracker,
  getAbbr,
  renderReqs,
  layout = "dialog",
}: OfficialInvitesContentProps) {
  const [officialInvitesTab, setOfficialInvitesTab] = useState<OfficialInvitesTab>("canInviteTo");
  const [officialInvitesSortBy, setOfficialInvitesSortBy] = useState<DialogSortByOption>("officialInvites");
  const [officialInvitesSortDirection, setOfficialInvitesSortDirection] = useState<SortDirection>("desc");
  const [isUnlockAccordionOpen, setIsUnlockAccordionOpen] = useState(true);
  const [expandedOfficialInviteCards, setExpandedOfficialInviteCards] = useState<Record<string, boolean>>({});

  const currentInvites = officialInvitesTab === "canInviteTo"
    ? data.canInviteTo
    : data.invitedFrom;

  const sortedInvites = useMemo(
    () => sortOfficialInvites(currentInvites, officialInvitesSortBy, officialInvitesSortDirection),
    [currentInvites, officialInvitesSortBy, officialInvitesSortDirection]
  );

  const isPanel = layout === "panel";
  const tabGroupClass = isPanel
    ? "grid grid-cols-2 gap-2 w-full"
    : "grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto";
  const controlsRowClass = isPanel
    ? "flex items-center justify-between gap-2 w-full pt-3 border-t border-foreground/5"
    : "flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t border-foreground/5 sm:border-0";
  const selectWrapperClass = isPanel ? "relative flex-1" : "relative flex-1 sm:flex-none";
  const selectClass = isPanel
    ? "w-full h-9 appearance-none rounded-md border border-foreground/10 bg-foreground/5 pl-3 pr-8 text-sm font-semibold text-foreground/80 outline-none transition-colors hover:border-foreground/20 focus:border-foreground/30"
    : "w-full sm:w-auto sm:min-w-44 h-9 appearance-none rounded-md border border-foreground/10 bg-foreground/5 pl-3 pr-8 text-sm font-semibold text-foreground/80 outline-none transition-colors hover:border-foreground/20 focus:border-foreground/30";

  return (
    <div className="space-y-2.5">
      <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
        <button
          type="button"
          onClick={() => setIsUnlockAccordionOpen((current) => !current)}
          className="w-full flex items-center justify-between gap-2 text-left text-sm font-semibold text-foreground cursor-pointer"
          aria-expanded={isUnlockAccordionOpen}
        >
          <span>Forum unlock requirements</span>
          <span className={`material-symbols-rounded text-lg text-foreground/60 transition-transform duration-200 ${isUnlockAccordionOpen ? "rotate-180" : ""}`}>
            keyboard_arrow_down
          </span>
        </button>
        <div
          className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
            isUnlockAccordionOpen ? "grid-rows-[1fr] opacity-100 mt-2.5" : "grid-rows-[0fr] opacity-0 mt-0"
          }`}
        >
          <div className="overflow-hidden">
            {data.sections.length > 0 ? (
              <div className="space-y-2.5">
                {data.sections.map((section, sectionIndex) => (
                  <div key={section.key}>
                    {sectionIndex > 0 && (
                      <div className="flex items-center justify-center my-2">
                        <span className="text-xs font-semibold text-foreground/40 uppercase">or</span>
                      </div>
                    )}
                    <div className="rounded-lg border border-foreground/10 bg-card p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        {section.rank ? (
                          <h4 className="text-sm font-semibold text-foreground wrap-break-words">{section.rank}</h4>
                        ) : (
                          <h4 className="text-sm font-semibold text-foreground">Requirements</h4>
                        )}
                      </div>

                      {section.requirements.length > 0 ? (
                        <ul className="space-y-1.5 min-w-0">
                          {section.requirements.map((requirement, requirementIndex) => (
                            <li key={`${section.key}-${requirementIndex}`} className="text-sm text-foreground/80 leading-snug flex items-start gap-2">
                              <span className="mt-[7px] h-1 w-1 rounded-full bg-foreground/45 shrink-0" />
                              <span className="wrap-break-words min-w-0 flex-1">{renderReqs(requirement)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-foreground/80 leading-snug wrap-break-words">
                          {section.requirementText ? renderReqs(section.requirementText) : "No additional requirements."}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground/70">No requirements provided.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
        <div className={`${isPanel ? "flex flex-col gap-3 mb-3" : "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3"}`}>
          <div className={tabGroupClass}>
            <button
              type="button"
              onClick={() => setOfficialInvitesTab("canInviteTo")}
              className={`justify-center sm:justify-start w-full sm:w-auto inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                officialInvitesTab === "canInviteTo"
                  ? "ui-accent-badge"
                  : "bg-foreground/5 text-foreground/70 hover:bg-foreground/10"
              }`}
            >
              <span className="material-symbols-rounded text-sm shrink-0">outbound</span>
              <span className="truncate">Can Invite To ({data.canInviteTo.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setOfficialInvitesTab("invitedFrom")}
              className={`justify-center sm:justify-start w-full sm:w-auto inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                officialInvitesTab === "invitedFrom"
                  ? "ui-accent-badge"
                  : "bg-foreground/5 text-foreground/70 hover:bg-foreground/10"
              }`}
            >
              <span className="material-symbols-rounded text-sm shrink-0">south_west</span>
              <span className="truncate">Invited From ({data.invitedFrom.length})</span>
            </button>
          </div>
          <div className={controlsRowClass}>
            <span className="text-sm font-semibold text-foreground/60 shrink-0">Sort by</span>
            <div className={selectWrapperClass}>
              <select
                value={officialInvitesSortBy}
                onChange={(event) => {
                  const nextSortBy = event.target.value as DialogSortByOption;
                  setOfficialInvitesSortBy(nextSortBy);
                  setOfficialInvitesSortDirection(nextSortBy === "officialInvites" ? "desc" : "asc");
                }}
                className={selectClass}
                aria-label="Sort dialog invite trackers"
              >
                <option value="officialInvites">Official</option>
                <option value="alphabetical">Name</option>
              </select>
              <span className="pointer-events-none material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-sm text-foreground/50">
                expand_more
              </span>
            </div>
            <SortDirectionButton
              direction={officialInvitesSortDirection}
              onToggle={() => setOfficialInvitesSortDirection((current) => current === "asc" ? "desc" : "asc")}
            />
          </div>
        </div>
        {sortedInvites.length > 0 ? (
          <div className="space-y-2.5">
            {sortedInvites.map((invite) => {
              const joinRequirementSections = parseRequirementSections(
                invite.details.reqs || "",
                `${data.sourceName}-${invite.tracker}-${officialInvitesTab}`
              );
              const inviteCardKey = `${data.sourceName}:${officialInvitesTab}:${invite.tracker}`;
              const isInviteCardOpen = expandedOfficialInviteCards[inviteCardKey] ?? true;

              return (
                <div key={invite.tracker} className="rounded-lg border border-foreground/10 bg-card p-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedOfficialInviteCards((current) => ({
                      ...current,
                      [inviteCardKey]: !(current[inviteCardKey] ?? true),
                    }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setExpandedOfficialInviteCards((current) => ({
                          ...current,
                          [inviteCardKey]: !(current[inviteCardKey] ?? true),
                        }));
                      }
                    }}
                    className="flex items-center justify-between gap-3 cursor-pointer rounded-md -mx-1 px-1 py-0.5"
                    aria-expanded={isInviteCardOpen}
                    aria-label={`${isInviteCardOpen ? "Collapse" : "Expand"} ${invite.tracker} details`}
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-foreground truncate max-w-full">{invite.tracker}</h4>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80 bg-foreground/10 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                        {getAbbr(invite.tracker)}
                      </span>
                      <OfficialInvitesBadge
                        count={invite.officialInvites}
                        ariaLabel={`Open official invites for ${invite.tracker}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenTracker(invite.tracker);
                        }}
                      />
                    </div>

                    <div className="flex items-center shrink-0 ml-1">
                      <span className={`material-symbols-rounded text-lg text-foreground/60 transition-transform duration-200 ${isInviteCardOpen ? "rotate-180" : ""}`}>
                        keyboard_arrow_down
                      </span>
                    </div>
                  </div>

                  <div
                    className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                      isInviteCardOpen ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0"
                    }`}
                  >
                    <div className="overflow-hidden pt-1">
                      {joinRequirementSections.length > 0 ? (
                        <div className="space-y-2">
                          {joinRequirementSections.map((section, sectionIndex) => (
                            <div key={section.key}>
                              {sectionIndex > 0 && (
                                <div className="flex items-center gap-2 py-1">
                                  <span className="h-px flex-1 bg-foreground/10" />
                                  <span className="text-[10px] font-semibold text-foreground/40 uppercase">or</span>
                                  <span className="h-px flex-1 bg-foreground/10" />
                                </div>
                              )}
                              {section.rank && (
                                <div className="mb-2">
                                  <h5 className="text-sm font-semibold text-foreground wrap-break-words">{section.rank}</h5>
                                </div>
                              )}
                              {section.requirements.length > 0 ? (
                                <ul className="space-y-1.5 min-w-0">
                                  {section.requirements.map((requirement, requirementIndex) => (
                                    <li key={`${section.key}-join-${requirementIndex}`} className="text-sm text-foreground/80 leading-snug flex items-start gap-2">
                                      <span className="mt-[7px] h-1 w-1 rounded-full bg-foreground/45 shrink-0" />
                                      <span className="wrap-break-words min-w-0 flex-1">{renderReqs(requirement)}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-foreground/80 leading-snug wrap-break-words">
                                  {renderReqs(section.requirementText || "No requirements provided.")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-foreground/80 leading-snug wrap-break-words">
                          No requirements provided.
                        </p>
                      )}

                      <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-foreground/5 border-dashed">
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${getStatusColor(invite.details.active)}`}>
                            {getStatusLabel(invite.details.active)}
                          </span>
                          <div className="flex items-center gap-1 text-foreground/30">
                            <span className="text-xs font-medium">Checked: {invite.details.updated}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-foreground/70 text-center py-4 border border-dashed border-foreground/10 rounded-lg">
            {officialInvitesTab === "canInviteTo"
              ? "No active official invites were found for this tracker."
              : "No active invite routes into this tracker were found."}
          </p>
        )}
      </div>
    </div>
  );
}
