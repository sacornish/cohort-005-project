import { describeDraft, type NoteDraft } from "./lib/draft";

export type { NoteDraft, NoteDraftStatus } from "./lib/draft";

/**
 * What the Lesson page's note editor shows for the text in the box: its
 * length against the limit, whether it differs from the saved Note, and
 * whether Save should be enabled.
 */
export function noteDraft(savedBody: string | null, draft: string): NoteDraft {
  return describeDraft(savedBody, draft);
}
