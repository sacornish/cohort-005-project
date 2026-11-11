import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraftStatus = "blank" | "saved" | "unsaved";

export type NoteDraft = {
  length: number;
  max: number;
  tooLong: boolean;
  status: NoteDraftStatus;
  canSave: boolean;
};

// The server trims before it stores, so whitespace at the edges is not a change.
export function describeDraft(
  savedBody: string | null,
  draft: string
): NoteDraft {
  const trimmed = draft.trim();
  const tooLong = trimmed.length > MAX_NOTE_LENGTH;
  const changed = trimmed !== (savedBody ?? "");

  let status: NoteDraftStatus = "blank";
  if (changed) status = "unsaved";
  else if (savedBody !== null) status = "saved";

  return {
    length: trimmed.length,
    max: MAX_NOTE_LENGTH,
    tooLong,
    status,
    canSave: changed && trimmed.length > 0 && !tooLong,
  };
}
