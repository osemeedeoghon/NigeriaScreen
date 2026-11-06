import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { indexingAllowed, PRIVATE_PATHS } from "./seo.ts";

describe("search indexing", () => {
  test("is off unless explicitly allowed", () => {
    const previous = process.env.NEXT_PUBLIC_ALLOW_INDEXING;
    delete process.env.NEXT_PUBLIC_ALLOW_INDEXING;
    assert.equal(indexingAllowed(), false);
    process.env.NEXT_PUBLIC_ALLOW_INDEXING = "yes";
    assert.equal(indexingAllowed(), false);
    process.env.NEXT_PUBLIC_ALLOW_INDEXING = "true";
    assert.equal(indexingAllowed(), true);
    if (previous === undefined) delete process.env.NEXT_PUBLIC_ALLOW_INDEXING;
    else process.env.NEXT_PUBLIC_ALLOW_INDEXING = previous;
  });

  test("private areas are always excluded", () => {
    for (const path of ["/account", "/admin", "/filmmaker", "/login", "/signup"]) assert.ok(PRIVATE_PATHS.includes(path), path);
  });
});
