import { describeDraft } from "./lib/draft";

export type {
  NoteDraftInput,
  NoteDraftState,
  NoteDraftStatus,
} from "./lib/draft";

/**
 * What the lesson note editor should show for the text in the box: the
 * character count against the limit, whether Save is allowed, and one status
 * line (saving, error, unsaved changes, saved, or nothing written yet).
 */
export const describeNoteDraft = describeDraft;
