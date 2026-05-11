import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createJsonStore } from "../storage/jsonStore.mjs";

test("jsonStore creates, updates, bulk creates, and deletes posts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "post-store-"));
  const store = createJsonStore({
    postsFile: join(dir, "posts.json"),
    backupDir: join(dir, "backups")
  });

  const created = await store.createPost({ caption: "One", status: "draft", scheduledAt: new Date().toISOString() });
  assert.equal((await store.listPosts()).length, 1);

  const updated = await store.updatePost(created.id, { caption: "Two" });
  assert.equal(updated.caption, "Two");

  const bulk = await store.bulkCreatePosts([{ caption: "Three" }, { caption: "Four" }]);
  assert.equal(bulk.length, 2);
  assert.equal((await store.listPosts()).length, 3);

  const deleted = await store.deletePost(created.id);
  assert.equal(deleted.id, created.id);
  assert.equal((await store.listPosts()).length, 2);
});
