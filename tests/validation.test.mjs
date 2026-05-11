import test from "node:test";
import assert from "node:assert/strict";
import { normalizePost, validateImageUrl } from "../lib/validation.mjs";

test("validateImageUrl allows local uploads and direct http urls", () => {
  assert.doesNotThrow(() => validateImageUrl("/uploads/photo.jpg"));
  assert.doesNotThrow(() => validateImageUrl("https://example.com/photo.jpg"));
});

test("validateImageUrl rejects Google Drive view URLs", () => {
  assert.throws(
    () => validateImageUrl("https://drive.google.com/file/d/example/view"),
    /Google Drive/
  );
});

test("normalizePost stores scheduledAt as ISO and allows empty draft caption", () => {
  const post = normalizePost({
    status: "draft",
    caption: "",
    scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    pageId: "123456789"
  });
  assert.equal(post.status, "draft");
  assert.equal(post.caption, "");
  assert.match(post.scheduledAt, /T/);
});

test("normalizePost requires scheduled caption and numeric Page ID", () => {
  assert.throws(
    () => normalizePost({ status: "scheduled", caption: "", scheduledAt: new Date(Date.now() + 60_000).toISOString() }),
    /Caption/
  );
  assert.throws(
    () => normalizePost({ status: "scheduled", caption: "Hello", scheduledAt: new Date(Date.now() + 60_000).toISOString(), pageId: "https://facebook.com/page" }),
    /numeric/
  );
});
