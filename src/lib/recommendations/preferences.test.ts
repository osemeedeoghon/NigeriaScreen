import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { validatePreferences } from "./preferences.ts";

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};

describe("discovery preference updates", () => {
  test("accepts catalogue languages and genres in a stable order", () => {
    const result = validatePreferences(
      form([
        ["languages", "ha"],
        ["languages", "yo"],
        ["languages", "ha"],
        ["genres", "crime"],
        ["genres", "drama"],
        ["includeWatched", "on"],
      ]),
    );
    assert.deepEqual(result, { ok: true, data: { languages: ["yo", "ha"], genres: ["drama", "crime"], includeWatched: true } });
  });

  test("an empty form clears preferences and leaves watched films out", () => {
    assert.deepEqual(validatePreferences(form([])), { ok: true, data: { languages: [], genres: [], includeWatched: false } });
  });

  test("rejects languages and genres that aren't in the catalogue", () => {
    const result = validatePreferences(form([["languages", "fr"], ["genres", "western"], ["genres", "<script>"]]));
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(Object.keys(result.errors).sort(), ["genres", "languages"]);
  });

  test("ignores anything that isn't a plain value, such as a user id", () => {
    const data = form([["genres", "drama"], ["userId", "00000000-0000-4000-8000-000000000000"]]);
    data.append("languages", new Blob(["en"]));
    assert.deepEqual(validatePreferences(data), { ok: true, data: { languages: [], genres: ["drama"], includeWatched: false } });
  });
});
