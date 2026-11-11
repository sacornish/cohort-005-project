import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraftStatus =
  | { kind: "error"; message: string }
  | { kind: "saving" }
  | { kind: "unsaved" }
  | { kind: "saved" }
  | { kind: "empty" };

export type NoteDraftInput = {
  draft: string;
  savedBody: string | null;
  saving: boolean;
  error?: string;
};

export type NoteDraftState = {
  length: number;
  maxLength: number;
  tooLong: boolean;
  canSave: boolean;
  status: NoteDraftStatus;
};

/**
 * What the lesson note editor should show for the text in the box: the
 * character count against the limit, whether Save is allowed, and one status
 * line (saving, error, unsaved changes, saved, or nothing written yet).
 */
export function describeNoteDraft({
  draft,
  savedBody,
  saving,
  error,
}: NoteDraftInput): NoteDraftState {
  // The server trims before checking the limit and storing, so compare what
  // it would keep, not the raw box.
  const kept = draft.trim();
  const length = kept.length;
  const tooLong = length > MAX_NOTE_LENGTH;
  const blank = length === 0;
  const changed = kept !== (savedBody ?? "");

  return {
    length,
    maxLength: MAX_NOTE_LENGTH,
    tooLong,
    canSave: changed && !blank && !tooLong && !saving,
    status: statusOf({ saving, error, changed, hasSaved: savedBody !== null }),
  };
}

function statusOf({
  saving,
  error,
  changed,
  hasSaved,
}: {
  saving: boolean;
  error?: string;
  changed: boolean;
  hasSaved: boolean;
}): NoteDraftStatus {
  if (saving) return { kind: "saving" };
  if (error) return { kind: "error", message: error };
  if (changed) return { kind: "unsaved" };
  return hasSaved ? { kind: "saved" } : { kind: "empty" };
}
