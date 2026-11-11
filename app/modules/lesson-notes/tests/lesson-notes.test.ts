import { describe, expect, it } from "vitest";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { noteDraft } from "../index";

describe("noteDraft", () => {
  it("is blank with Save disabled when there is no note and nothing typed", () => {
    expect(noteDraft(null, "   ")).toMatchObject({
      status: "blank",
      canSave: false,
      length: 0,
    });
  });

  it("is unsaved and saveable once a new note is typed", () => {
    expect(noteDraft(null, "Generics")).toMatchObject({
      status: "unsaved",
      canSave: true,
      length: 8,
    });
  });

  it("is saved when the box matches the stored note, ignoring edge whitespace", () => {
    expect(noteDraft("Generics", "  Generics\n")).toMatchObject({
      status: "saved",
      canSave: false,
    });
  });

  it("is unsaved when the stored note has been edited", () => {
    expect(noteDraft("Generics", "Generics and enums")).toMatchObject({
      status: "unsaved",
      canSave: true,
    });
  });

  it("cannot save a cleared note, because the server rejects an empty one", () => {
    expect(noteDraft("Generics", "")).toMatchObject({
      status: "unsaved",
      canSave: false,
    });
  });

  it("allows exactly the limit and blocks one character over", () => {
    const atLimit = noteDraft(null, "a".repeat(MAX_NOTE_LENGTH));
    expect(atLimit).toMatchObject({ tooLong: false, canSave: true });
    expect(atLimit.max).toBe(MAX_NOTE_LENGTH);

    expect(noteDraft(null, "a".repeat(MAX_NOTE_LENGTH + 1))).toMatchObject({
      tooLong: true,
      canSave: false,
    });
  });
});
