import { describe, it, expect } from "vitest";
import { describeNoteDraft } from "../index";

const MAX = 2000;

function draft(overrides: Partial<Parameters<typeof describeNoteDraft>[0]>) {
  return describeNoteDraft({
    draft: "",
    savedBody: null,
    saving: false,
    ...overrides,
  });
}

describe("describeNoteDraft", () => {
  it("shows nothing written yet and blocks Save for an empty first note", () => {
    const state = draft({});
    expect(state.status).toEqual({ kind: "empty" });
    expect(state.canSave).toBe(false);
    expect(state.length).toBe(0);
    expect(state.maxLength).toBe(MAX);
  });

  it("allows saving new text and flags it as unsaved", () => {
    const state = draft({ draft: "Generics are like function parameters" });
    expect(state.canSave).toBe(true);
    expect(state.status).toEqual({ kind: "unsaved" });
    expect(state.length).toBe(37);
  });

  it("reports saved and blocks Save when the text matches the saved note", () => {
    const state = draft({ draft: "kept", savedBody: "kept" });
    expect(state.status).toEqual({ kind: "saved" });
    expect(state.canSave).toBe(false);
  });

  it("treats an edit to a saved note as unsaved", () => {
    const state = draft({ draft: "kept!", savedBody: "kept" });
    expect(state.status).toEqual({ kind: "unsaved" });
    expect(state.canSave).toBe(true);
  });

  it("blocks Save for whitespace only, which the server would reject", () => {
    expect(draft({ draft: "   \n" }).canSave).toBe(false);
  });

  it("allows exactly the limit and blocks one character over it", () => {
    const atLimit = draft({ draft: "a".repeat(MAX) });
    expect(atLimit.tooLong).toBe(false);
    expect(atLimit.canSave).toBe(true);

    const over = draft({ draft: "a".repeat(MAX + 1) });
    expect(over.tooLong).toBe(true);
    expect(over.canSave).toBe(false);
  });

  it("shows saving, and blocks a second Save, while a save is in flight", () => {
    const state = draft({ draft: "new", savedBody: "old", saving: true });
    expect(state.status).toEqual({ kind: "saving" });
    expect(state.canSave).toBe(false);
  });

  it("shows the server's error once the save has finished", () => {
    const state = draft({ draft: "x", savedBody: "y", error: "Too long" });
    expect(state.status).toEqual({ kind: "error", message: "Too long" });
    expect(state.canSave).toBe(true);
  });

  it("reports saved once the server has stored the trimmed text", () => {
    const state = draft({ draft: "kept\n", savedBody: "kept" });
    expect(state.status).toEqual({ kind: "saved" });
    expect(state.canSave).toBe(false);
  });

  it("does not count surrounding whitespace against the limit", () => {
    const state = draft({ draft: ` ${"a".repeat(MAX)}\n` });
    expect(state.tooLong).toBe(false);
    expect(state.canSave).toBe(true);
  });
});
