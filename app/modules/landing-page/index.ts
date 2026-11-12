import {
  buildLandingStats,
  formatLessonCount,
  type LandingCounts,
} from "./lib/stats";

export type { LandingStat, LandingStatKey } from "./lib/stats";

export function landingStats(counts: LandingCounts) {
  return buildLandingStats(counts);
}

export function lessonCountLabel(count: number) {
  return formatLessonCount(count);
}
