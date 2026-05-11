import test from "node:test";
import assert from "node:assert/strict";
import { publishPost } from "../services/facebookPublisher.mjs";

test("facebookPublisher dry-run does not call fetch", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("fetch should not be called in dry-run");
  };
  try {
    const result = await publishPost(
      { caption: "Hello", scheduledAt: new Date().toISOString() },
      { config: { dryRun: true }, uploadDir: "." }
    );
    assert.equal(result.provider, "mock");
    assert.match(result.id, /^mock_/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
