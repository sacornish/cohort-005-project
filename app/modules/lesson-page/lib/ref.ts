import { z } from "zod";
import { data } from "react-router";
import {
  type Capability,
  type CourseRef,
} from "~/modules/permissions/course-permissions.server";

/**
 * The course named by this route's slug, through this lesson. A lesson in
 * another course, or a malformed lesson id, counts as not found.
 */
export function lessonRef(params: {
  slug: string;
  lessonId: string;
}): CourseRef {
  return { slug: params.slug, lessonId: params.lessonId };
}

const lessonIdSchema = z.coerce.number().int().positive();

/** The lesson id from the URL, or a 404 when it is not a positive integer. */
export function parseLessonId(params: { lessonId: string }): number {
  const parsed = lessonIdSchema.safeParse(params.lessonId);
  if (!parsed.success) throw data("Lesson not found", { status: 404 });
  return parsed.data;
}

/**
 * What each action intent needs: comments, Bookmarks and Notes need view;
 * progress and quizzes need take. Moderating Discussions (deleting someone
 * else's post) additionally needs manage, checked in the delete intent.
 */
export const INTENT_CAPABILITY: Record<string, Capability | undefined> = {
  "create-comment": "view",
  "edit-comment": "view",
  "delete-comment": "view",
  "toggle-bookmark": "view",
  "save-note": "view",
  "mark-complete": "take",
  "submit-quiz": "take",
};
