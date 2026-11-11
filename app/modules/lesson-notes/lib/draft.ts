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

export function describeDraft({
  draft,
  savedBody,
  saving,
  error,
}: NoteDraftInput): NoteDraftState {
  const length = draft.length;
  const tooLong = length > MAX_NOTE_LENGTH;
  const blank = draft.trim().length === 0;
  const changed = draft !== (savedBody ?? "");

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
