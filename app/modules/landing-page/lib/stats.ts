export type LandingStatKey = "courses" | "categories" | "pace";

export type LandingStat = {
  key: LandingStatKey;
  value: string;
  label: string;
};

function pluralise(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export type LandingCounts = {
  totalCourses: number;
  totalCategories: number;
};

export function buildLandingStats(counts: LandingCounts): LandingStat[] {
  return [
    {
      key: "courses",
      value: String(counts.totalCourses),
      label: pluralise(
        counts.totalCourses,
        "Available course",
        "Available courses"
      ),
    },
    {
      key: "categories",
      value: String(counts.totalCategories),
      label: pluralise(counts.totalCategories, "Category", "Categories"),
    },
    { key: "pace", value: "Self-paced", label: "Learn on your schedule" },
  ];
}

export function formatLessonCount(count: number) {
  return `${count} ${pluralise(count, "lesson", "lessons")}`;
}
