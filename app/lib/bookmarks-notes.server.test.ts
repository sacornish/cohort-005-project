import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { approveRefundRequest, raiseRefundRequest } from "./refunds.server";
import { fakeNotifications } from "./notifications.fake.server";
import {
  MAX_NOTE_LENGTH,
  getNote,
  isBookmarked,
  listBookmarks,
  listNotes,
  saveNote,
  toggleBookmark,
} from "./bookmarks-notes.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);
const LATER = new Date(2026, 9, 7, 12, 0, 0);

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  lessonIds = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

function addStudent(name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase()}@example.com`,
      role: UserRole.Student,
    })
    .returning()
    .get();
}

describe("Bookmarks", () => {
  it("toggling adds a Bookmark, toggling again removes it", () => {
    expect(toggleBookmark(db, base.user.id, lessonIds[0], NOW)).toBe(true);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(true);

    expect(toggleBookmark(db, base.user.id, lessonIds[0], LATER)).toBe(false);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(false);
  });

  it("never gives a Student two Bookmarks on the same Lesson", () => {
    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    expect(() =>
      db
        .insert(schema.bookmarks)
        .values({ userId: base.user.id, lessonId: lessonIds[0] })
        .run()
    ).toThrow();
    expect(listBookmarks(db, base.user.id)).toHaveLength(1);
  });

  it("lists only the Student's own Bookmarks, newest first, with Lesson and Course", () => {
    const other = addStudent("Other");
    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    toggleBookmark(db, base.user.id, lessonIds[1], LATER);
    toggleBookmark(db, other.id, lessonIds[0], NOW);

    expect(listBookmarks(db, base.user.id)).toMatchObject([
      {
        lessonId: lessonIds[1],
        lessonTitle: "Lesson 2",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
      {
        lessonId: lessonIds[0],
        lessonTitle: "Lesson 1",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
    ]);
  });
});

describe("Notes", () => {
  it("saving creates the Note; saving again replaces its body and moves the last-edited time on", () => {
    expect(getNote(db, base.user.id, lessonIds[0])).toBeNull();

    saveNote(db, base.user.id, lessonIds[0], "  first thought  ", NOW);
    expect(getNote(db, base.user.id, lessonIds[0])).toEqual({
      body: "first thought",
      updatedAt: NOW.toISOString(),
    });

    saveNote(db, base.user.id, lessonIds[0], "second thought", LATER);
    expect(getNote(db, base.user.id, lessonIds[0])).toEqual({
      body: "second thought",
      updatedAt: LATER.toISOString(),
    });
    expect(listNotes(db, base.user.id)).toHaveLength(1);
  });

  it(`accepts a Note of exactly ${MAX_NOTE_LENGTH} characters and refuses one longer`, () => {
    expect(
      saveNote(db, base.user.id, lessonIds[0], "a".repeat(MAX_NOTE_LENGTH), NOW)
        .ok
    ).toBe(true);

    const tooLong = saveNote(
      db,
      base.user.id,
      lessonIds[1],
      "a".repeat(MAX_NOTE_LENGTH + 1),
      NOW
    );
    expect(tooLong.ok).toBe(false);
    expect(getNote(db, base.user.id, lessonIds[1])).toBeNull();
  });

  it("refuses an empty Note", () => {
    expect(saveNote(db, base.user.id, lessonIds[0], "   ", NOW).ok).toBe(false);
    expect(getNote(db, base.user.id, lessonIds[0])).toBeNull();
  });

  it("lists only the Student's own Notes, most recently edited first", () => {
    const other = addStudent("Other");
    saveNote(db, base.user.id, lessonIds[1], "older", NOW);
    saveNote(db, base.user.id, lessonIds[0], "newer", LATER);
    saveNote(db, other.id, lessonIds[0], "not yours", LATER);

    expect(listNotes(db, base.user.id)).toMatchObject([
      { body: "newer", lessonId: lessonIds[0], courseTitle: "Test Course" },
      { body: "older", lessonId: lessonIds[1], courseTitle: "Test Course" },
    ]);
  });
});

describe("approving a Refund Request", () => {
  it("keeps the Student's Bookmarks and Notes", async () => {
    const notifications = fakeNotifications();
    const platformAdmin = db
      .insert(schema.users)
      .values({
        name: "Pat Admin",
        email: "pat@example.com",
        role: UserRole.Admin,
      })
      .returning()
      .get();
    const purchase = db
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        amountPaid: 7900,
        createdAt: NOW.toISOString(),
      })
      .returning()
      .get();
    db.insert(schema.enrollments)
      .values({ userId: base.user.id, courseId: base.course.id })
      .run();

    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    saveNote(db, base.user.id, lessonIds[0], "keep me", NOW);

    const raised = await raiseRefundRequest(
      db,
      purchase.id,
      base.user.id,
      "It was not what I expected.",
      NOW,
      notifications
    );
    if (!raised.ok) throw new Error(raised.error);
    const approved = await approveRefundRequest(
      db,
      raised.refundRequestId,
      platformAdmin.id,
      null,
      NOW,
      notifications
    );
    expect(approved.ok).toBe(true);

    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(true);
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe("keep me");
  });
});
