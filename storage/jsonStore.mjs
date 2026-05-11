import { mkdir, readFile, rename, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

let writeQueue = Promise.resolve();

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function createJsonStore({ postsFile, backupDir, migratePost = (post) => post }) {
  const dataDir = dirname(postsFile);
  const tmpFile = join(dataDir, "posts.tmp.json");

  async function ensureDataFile() {
    await mkdir(dataDir, { recursive: true });
    await mkdir(backupDir, { recursive: true });
    if (!existsSync(postsFile)) {
      await writeFile(postsFile, "[]\n", "utf8");
    }
  }

  async function backupPostsFile(reason = "manual") {
    await ensureDataFile();
    const backupPath = join(backupDir, `posts-${timestamp()}-${reason}.json`);
    await copyFile(postsFile, backupPath);
    return backupPath;
  }

  async function readRawPosts() {
    await ensureDataFile();
    const raw = await readFile(postsFile, "utf8");
    try {
      return JSON.parse(raw || "[]");
    } catch (error) {
      await backupPostsFile("parse-error");
      throw new Error(`Could not parse data/posts.json. A backup was created. ${error.message}`);
    }
  }

  async function writeRawPosts(posts) {
    await ensureDataFile();
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      try {
        await writeFile(tmpFile, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
        await rename(tmpFile, postsFile);
      } catch (error) {
        await backupPostsFile("write-error");
        throw error;
      }
    });
    await writeQueue;
  }

  async function listPosts() {
    const posts = await readRawPosts();
    let changed = false;
    const migrated = posts.map((post) => {
      const next = migratePost({ ...post });
      if (JSON.stringify(next) !== JSON.stringify(post)) changed = true;
      return next;
    });
    if (changed) {
      await backupPostsFile("migration");
      await writeRawPosts(migrated);
    }
    return migrated;
  }

  async function getPost(id) {
    const posts = await listPosts();
    return posts.find((post) => post.id === id) || null;
  }

  async function createPost(post) {
    const posts = await listPosts();
    const now = new Date().toISOString();
    const created = { id: randomUUID(), createdAt: now, updatedAt: now, ...post };
    posts.push(created);
    await writeRawPosts(posts);
    return created;
  }

  async function bulkCreatePosts(items) {
    const posts = await listPosts();
    const now = new Date().toISOString();
    const created = items.map((post) => ({ id: randomUUID(), createdAt: now, updatedAt: now, ...post }));
    posts.push(...created);
    await writeRawPosts(posts);
    return created;
  }

  async function updatePost(id, patchOrUpdater) {
    const posts = await listPosts();
    const index = posts.findIndex((post) => post.id === id);
    if (index === -1) return null;
    const patch = typeof patchOrUpdater === "function" ? patchOrUpdater({ ...posts[index] }) : patchOrUpdater;
    if (patch === null) return null;
    posts[index] = { ...posts[index], ...patch, updatedAt: new Date().toISOString() };
    await writeRawPosts(posts);
    return posts[index];
  }

  async function deletePost(id) {
    const posts = await listPosts();
    const index = posts.findIndex((post) => post.id === id);
    if (index === -1) return null;
    const [deleted] = posts.splice(index, 1);
    await writeRawPosts(posts);
    return deleted;
  }

  return { listPosts, getPost, createPost, updatePost, deletePost, bulkCreatePosts, backupPostsFile, ensureDataFile };
}
