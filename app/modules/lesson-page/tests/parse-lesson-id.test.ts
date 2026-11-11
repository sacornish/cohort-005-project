import { describe, it, expect } from "vitest";
import { parseLessonId } from "../index.server";

function rejectionOf(lessonId: string) {
  try {
    parseLessonId({ lessonId });
  } catch (error) {
    const response = error as { data: unknown; init?: { status?: number } };
    return { status: response.init?.status, body: response.data };
  }
  return undefined;
}

describe("parseLessonId", () => {
  it("reads a positive integer lesson id", () => {
    expect(parseLessonId({ lessonId: "12" })).toBe(12);
  });

  it.each(["", "0", "-3", "1.5", "abc"])(
    "answers 404 for the malformed id %j",
    (lessonId) => {
      expect(rejectionOf(lessonId)).toEqual({
        status: 404,
        body: "Lesson not found",
      });
    }
  );
});
