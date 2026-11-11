import type { LessonLoaderData } from "~/components/lesson/types";
import { useState } from "react";
import { useFetcher } from "react-router";
import { noteDraft, type NoteDraft } from "~/modules/lesson-notes";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Lock, NotebookPen } from "lucide-react";
import { cn, formatRelativeTime } from "~/lib/utils";

type SavedNote = Extract<LessonLoaderData, { view: "full" }>["note"];

export function LessonNote({ note }: { note: SavedNote }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [body, setBody] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const error = isSaving ? undefined : fetcher.data?.error;
  const draft = noteDraft(note?.body ?? null, body);

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <NoteHeader />
        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            className="min-h-24"
          />
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !draft.canSave}
            >
              {isSaving ? "Saving..." : "Save note"}
            </Button>
            <NoteStatus draft={draft} note={note} error={error} />
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
      <h2 className="text-xl font-semibold">Your Notes</h2>
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Only you can see these
      </span>
    </div>
  );
}

function NoteStatus({
  draft,
  note,
  error,
}: {
  draft: NoteDraft;
  note: SavedNote;
  error: string | undefined;
}) {
  return (
    <>
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : draft.status === "unsaved" ? (
        <span className="text-xs text-muted-foreground">Unsaved changes</span>
      ) : (
        note &&
        draft.status === "saved" && (
          <span
            suppressHydrationWarning
            className="text-xs text-muted-foreground"
          >
            Saved · edited {formatRelativeTime(note.updatedAt)}
          </span>
        )
      )}
      <span
        className={cn(
          "ml-auto text-xs",
          draft.tooLong ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {draft.length} / {draft.max}
      </span>
    </>
  );
}
