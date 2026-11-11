import { buildLandingStats, formatLessonCount } from "./lib/stats";

export type { LandingStat, LandingStatKey } from "./lib/stats";

/** What the stats band on `/` says, worded for each count. */
export function landingStats(counts: {
  totalCourses: number;
  totalCategories: number;
}) {
  return buildLandingStats(counts);
}

/** "1 lesson", "6 lessons": the lesson count on a course card. */
export function lessonCountLabel(count: number) {
  return formatLessonCount(count);
}
