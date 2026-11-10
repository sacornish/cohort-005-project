// PROTOTYPE: throwaway UI for the "Notification bell and inbox UI" wayfinder ticket.
// Three variants of the bell + inbox, switchable via ?variant=A|B|C.
// Mock data comes from layout.app.tsx; read state lives in memory only.
// Never merge to main.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { Popover } from "radix-ui";
import {
  Bell,
  BookOpen,
  CheckCheck,
  Inbox,
  MessageSquare,
  Reply,
  X,
} from "lucide-react";
import { cn, formatRelativeTime } from "~/lib/utils";

export type MockKind = "comment_on_course" | "reply_to_comment" | "new_lesson";

export interface MockNotification {
  id: number;
  kind: MockKind;
  courseId: number;
  courseTitle: string;
  courseSlug: string;
  lessonId: number;
  lessonTitle: string;
  actorName: string | null;
  actorIsInstructor: boolean;
  isReply: boolean;
  excerpt: string | null;
  createdAt: string;
  readAt: string | null;
}

// --- Display model (mirrors the Inbox behaviour decision) -------------------

export interface DisplayRow {
  key: string;
  ids: number[];
  kind: MockKind;
  unread: boolean;
  count: number;
  latest: MockNotification;
  href: string;
}

const PAGE_SIZE = 20;

function hrefFor(n: MockNotification) {
  const base = `/courses/${n.courseSlug}/lessons/${n.lessonId}`;
  return n.kind === "new_lesson" ? base : `${base}#comment-${n.id}`;
}

function toDisplayRows(all: MockNotification[]): DisplayRow[] {
  const groups = new Map<string, MockNotification[]>();
  for (const n of all) {
    const key =
      n.kind === "new_lesson" && !n.readAt ? `course:${n.courseId}` : `n:${n.id}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  return [...groups.entries()]
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      const earliestLesson = [...items].sort((a, b) => a.lessonId - b.lessonId)[0];
      return {
        key,
        ids: items.map((i) => i.id),
        kind: sorted[0].kind,
        unread: !sorted[0].readAt,
        count: items.length,
        latest: sorted[0],
        href: hrefFor(items.length > 1 ? earliestLesson : sorted[0]),
      };
    })
    .sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt));
}

function formatCount(n: number) {
  return n > 9 ? "9+" : String(n);
}

export function useMockInbox(initial: MockNotification[], userKey: unknown) {
  const [items, setItems] = useState(initial);
  const [pages, setPages] = useState(1);
  useEffect(() => {
    setItems(initial);
    setPages(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);
  const navigate = useNavigate();

  const allRows = useMemo(() => toDisplayRows(items), [items]);
  const rows = allRows.slice(0, pages * PAGE_SIZE);
  const unreadCount = allRows.filter((r) => r.unread).length;

  function markRead(ids: number[]) {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (ids.includes(n.id) && !n.readAt ? { ...n, readAt: now } : n))
    );
  }

  return {
    rows,
    unreadCount,
    countLabel: formatCount(unreadCount),
    hasMore: allRows.length > rows.length,
    loadMore: () => setPages((p) => p + 1),
    open(row: DisplayRow, after?: () => void) {
      markRead(row.ids);
      after?.();
      navigate(row.href);
    },
    markAllRead: () => markRead(items.map((n) => n.id)),
    simulateArrival() {
      const template = items[Math.floor(Math.random() * items.length)];
      if (!template) return;
      const id = Math.max(...items.map((n) => n.id)) + 1;
      setItems((prev) => [
        { ...template, id, createdAt: new Date().toISOString(), readAt: null },
        ...prev,
      ]);
    },
    resetAllUnread: () =>
      setItems((prev) => prev.map((n) => ({ ...n, readAt: null }))),
  };
}

export type MockInbox = ReturnType<typeof useMockInbox>;

// --- Shared copy ------------------------------------------------------------

function InstructorBadge() {
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      Instructor
    </span>
  );
}

function Headline({ row }: { row: DisplayRow }) {
  const n = row.latest;
  if (n.kind === "new_lesson") {
    return row.count > 1 ? (
      <>
        <b>{row.count} new lessons</b> in <b>{n.courseTitle}</b>
      </>
    ) : (
      <>
        New lesson in <b>{n.courseTitle}</b>: {n.lessonTitle}
      </>
    );
  }
  const verb =
    n.kind === "reply_to_comment"
      ? "replied to your comment on"
      : n.isReply
        ? "replied in a thread on"
        : "commented on";
  return (
    <>
      <b>{n.actorName}</b> {n.actorIsInstructor && <InstructorBadge />} {verb}{" "}
      <b>{n.lessonTitle}</b>
    </>
  );
}

function KindIcon({ row, className }: { row: DisplayRow; className?: string }) {
  const Icon =
    row.kind === "new_lesson"
      ? BookOpen
      : row.kind === "reply_to_comment" || row.latest.isReply
        ? Reply
        : MessageSquare;
  return <Icon className={cn("size-4", className)} />;
}

function Time({ iso }: { iso: string }) {
  return (
    <span className="text-xs text-muted-foreground" suppressHydrationWarning>
      {formatRelativeTime(iso)}
    </span>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
      <Inbox className="size-8 opacity-40" />
      You're all caught up.
    </div>
  );
}

// --- Variant A: sidebar nav item + flyout to the right of the sidebar -------

export function VariantASidebarItem({ inbox }: { inbox: MockInbox }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            open
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Bell className="size-4" />
          Notifications
          {inbox.unreadCount > 0 && (
            <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {inbox.countLabel}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={16}
          collisionPadding={12}
          className="z-50 flex max-h-[80vh] w-96 flex-col rounded-lg border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Notifications</h2>
            <button
              onClick={inbox.markAllRead}
              disabled={inbox.unreadCount === 0}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {inbox.rows.length === 0 && <Empty />}
            {inbox.rows.map((row) => (
              <button
                key={row.key}
                onClick={() => inbox.open(row, () => setOpen(false))}
                className={cn(
                  "flex w-full gap-3 border-b px-4 py-3 text-left text-sm transition-colors hover:bg-accent",
                  row.unread && "bg-primary/5"
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    row.unread ? "bg-primary" : "bg-transparent"
                  )}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className={cn(!row.unread && "text-muted-foreground")}>
                    <Headline row={row} />
                  </div>
                  {row.latest.excerpt && (
                    <div className="line-clamp-2 text-xs text-muted-foreground">
                      “{row.latest.excerpt}”
                    </div>
                  )}
                  <Time iso={row.latest.createdAt} />
                </div>
              </button>
            ))}
            {inbox.hasMore && (
              <button
                onClick={inbox.loadMore}
                className="w-full py-3 text-sm font-medium text-primary hover:bg-accent"
              >
                Load more
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// --- Variant B: slim top bar with a bell in the top-right corner -------------

export function VariantBTopBar({ inbox }: { inbox: MockInbox }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-end border-b bg-background/95 px-6 backdrop-blur">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            aria-label={`Notifications, ${inbox.unreadCount} unread`}
            className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent"
          >
            <Bell className="size-5" />
            {inbox.unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-background">
                {inbox.countLabel}
              </span>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            className="z-50 flex max-h-[70vh] w-[400px] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <h2 className="text-sm font-semibold">Notifications</h2>
              <button
                onClick={inbox.markAllRead}
                disabled={inbox.unreadCount === 0}
                title="Mark all as read"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <CheckCheck className="size-3.5" /> Mark all as read
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {inbox.rows.length === 0 && <Empty />}
              {inbox.rows.map((row) => (
                <button
                  key={row.key}
                  onClick={() => inbox.open(row, () => setOpen(false))}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-[13px] leading-snug transition-colors hover:bg-accent"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      row.unread
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <KindIcon row={row} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "line-clamp-2",
                        !row.unread && "text-muted-foreground"
                      )}
                    >
                      <Headline row={row} />
                    </div>
                    <Time iso={row.latest.createdAt} />
                  </div>
                  {row.unread && (
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-red-600" />
                  )}
                </button>
              ))}
              {inbox.hasMore && (
                <button
                  onClick={inbox.loadMore}
                  className="mt-1 w-full rounded-lg py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
                >
                  Load more
                </button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

// --- Variant C: sidebar item that opens a full inbox page in the main area ---

export function VariantCSidebarItem({ inbox }: { inbox: MockInbox }) {
  const [searchParams] = useSearchParams();
  const active = searchParams.get("inbox") === "1";
  const params = new URLSearchParams(searchParams);
  params.set("inbox", "1");
  return (
    <Link
      to={`?${params}`}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Inbox className="size-4" />
      Inbox
      {inbox.unreadCount > 0 && (
        <span className="ml-auto text-xs font-semibold text-primary">
          {inbox.countLabel}
        </span>
      )}
    </Link>
  );
}

function dayBucket(iso: string) {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return "Today";
  if (days < 7) return "This week";
  return "Earlier";
}

export function VariantCInboxPage({ inbox }: { inbox: MockInbox }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const rows =
    filter === "unread" ? inbox.rows.filter((r) => r.unread) : inbox.rows;
  const buckets = ["Today", "This week", "Earlier"].map((label) => ({
    label,
    rows: rows.filter((r) => dayBucket(r.latest.createdAt) === label),
  }));

  function close() {
    const p = new URLSearchParams(searchParams);
    p.delete("inbox");
    setSearchParams(p);
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {inbox.unreadCount === 0
              ? "Nothing unread."
              : `${inbox.unreadCount} unread`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5 text-sm">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded px-3 py-1 capitalize",
                  filter === f ? "bg-accent font-medium" : "text-muted-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={inbox.markAllRead}
            disabled={inbox.unreadCount === 0}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-40"
          >
            Mark all as read
          </button>
          <button
            onClick={close}
            title="Close inbox (prototype only)"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {rows.length === 0 && <Empty />}
      {buckets
        .filter((b) => b.rows.length > 0)
        .map((b) => (
          <section key={b.label} className="mb-8">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {b.label}
            </h2>
            <div className="divide-y rounded-lg border">
              {b.rows.map((row) => (
                <button
                  key={row.key}
                  onClick={() => inbox.open(row)}
                  className={cn(
                    "grid w-full grid-cols-[auto_1fr_auto] items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-accent",
                    row.unread && "border-l-4 border-l-primary bg-primary/5 pl-4"
                  )}
                >
                  <KindIcon
                    row={row}
                    className={cn(
                      "mt-0.5",
                      row.unread ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <div className="min-w-0 space-y-1">
                    <div className={cn(!row.unread && "text-muted-foreground")}>
                      <Headline row={row} />
                    </div>
                    {row.latest.excerpt && (
                      <p className="text-sm text-muted-foreground">
                        {row.latest.excerpt}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {row.latest.courseTitle}
                    </div>
                  </div>
                  <Time iso={row.latest.createdAt} />
                </button>
              ))}
            </div>
          </section>
        ))}
      {inbox.hasMore && filter === "all" && (
        <button
          onClick={inbox.loadMore}
          className="w-full rounded-lg border py-2.5 text-sm font-medium hover:bg-accent"
        >
          Load more
        </button>
      )}
    </div>
  );
}

export const PROTOTYPE_VARIANTS = [
  { key: "A", name: "Sidebar flyout" },
  { key: "B", name: "Top-bar dropdown" },
  { key: "C", name: "Inbox page" },
];
