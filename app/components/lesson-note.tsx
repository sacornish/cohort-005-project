import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import {
  describeNoteDraft,
  type NoteDraftStatus,
} from "~/modules/lesson-notes";

export type LessonNoteData = { body: string; updatedAt: string } | null;

export function LessonNote({ note }: { note: LessonNoteData }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [draft, setDraft] = useState(note?.body ?? "");
  const saving = fetcher.state !== "idle";
  const state = describeNoteDraft({
    draft,
    savedBody: note?.body ?? null,
    saving,
    error: fetcher.data?.error,
  });

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <NoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            className="resize-y"
          />

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={!state.canSave}>
              {saving ? "Saving..." : "Save note"}
            </Button>
            <NoteStatus status={state.status} updatedAt={note?.updatedAt} />
            <span
              className={cn(
                "ml-auto text-xs",
                state.tooLong ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {state.length} / {state.maxLength}
            </span>
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteHeader() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <NotebookPen className="size-5 text-primary" />
      <h2 className="text-xl font-semibold">Your notes</h2>
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3.5" />
        Only you can see these
      </span>
    </div>
  );
}

function NoteStatus({
  status,
  updatedAt,
}: {
  status: NoteDraftStatus;
  updatedAt: string | undefined;
}) {
  switch (status.kind) {
    case "error":
      return (
        <span role="alert" className="text-sm text-destructive">
          {status.message}
        </span>
      );
    case "unsaved":
      return (
        <span className="text-xs text-muted-foreground">Unsaved changes</span>
      );
    case "saved":
      return (
        <span
          suppressHydrationWarning
          className="text-xs text-muted-foreground"
        >
          Saved
          {updatedAt && ` · last edited ${formatRelativeTime(updatedAt)}`}
        </span>
      );
    default:
      return null;
  }
}
