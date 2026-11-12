import { describe, it, expect } from "vitest";
import { landingStats, lessonCountLabel } from "../index";

describe("landingStats", () => {
  it("reports course and category counts in the plural", () => {
    expect(landingStats({ totalCourses: 4, totalCategories: 5 })).toEqual([
      { key: "courses", value: "4", label: "Available courses" },
      { key: "categories", value: "5", label: "Categories" },
      { key: "pace", value: "Self-paced", label: "Learn on your schedule" },
    ]);
  });

  it("uses the singular for a count of one", () => {
    const [courses, categories] = landingStats({
      totalCourses: 1,
      totalCategories: 1,
    });
    expect(courses.label).toBe("Available course");
    expect(categories.label).toBe("Category");
  });

  it("uses the plural for a count of zero", () => {
    const [courses, categories] = landingStats({
      totalCourses: 0,
      totalCategories: 0,
    });
    expect(courses).toMatchObject({ value: "0", label: "Available courses" });
    expect(categories.label).toBe("Categories");
  });
});

describe("lessonCountLabel", () => {
  it("says lesson for one and lessons otherwise", () => {
    expect(lessonCountLabel(1)).toBe("1 lesson");
    expect(lessonCountLabel(0)).toBe("0 lessons");
    expect(lessonCountLabel(6)).toBe("6 lessons");
  });
});
