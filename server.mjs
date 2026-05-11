import { createServer } from "node:http";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { loadDotEnv, buildConfig, validateConfig } from "./lib/env.mjs";
import { createSessionManager } from "./lib/auth.mjs";
import { parseCsv, toCsv } from "./lib/csv.mjs";
import { normalizePost, validateImageUrl } from "./lib/validation.mjs";
import { createJsonStore } from "./storage/jsonStore.mjs";
import { publishPost, publicUploadUrlForFile } from "./services/facebookPublisher.mjs";

const ROOT = resolve(".");
await loadDotEnv(join(ROOT, ".env"));

const PUBLIC_DIR = join(ROOT, "public");
const DATA_DIR = join(ROOT, "data");
const UPLOAD_DIR = join(DATA_DIR, "uploads");
const BACKUP_DIR = join(DATA_DIR, "backups");
const POSTS_FILE = join(DATA_DIR, "posts.json");
const config = buildConfig();
const configValidation = validateConfig(config);
const sessions = createSessionManager(config, configValidation);
const STALE_PUBLISHING_MS = 10 * 60 * 1000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const uploadTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

const store = createJsonStore({
  postsFile: POSTS_FILE,
  backupDir: BACKUP_DIR,
  migratePost(post) {
    const warnings = [];
    if (post.status === "published" && post.publishResult?.provider === "mock") {
      post.status = "mock_published";
    }
    if (post.pageId && !/^\d+$/.test(String(post.pageId))) {
      warnings.push("Legacy Page ID is not numeric. Replace Facebook Page URL with numeric Page ID.");
    }
    try {
      if (post.imageUrl) validateImageUrl(String(post.imageUrl));
    } catch (error) {
      warnings.push(error.message);
    }
    if (post.status === "publishing" && Date.now() - Date.parse(post.lockedAt || post.updatedAt || 0) > STALE_PUBLISHING_MS) {
      post.status = "failed";
      post.recoverable = true;
      warnings.push("Server found a stale publishing lock. Review the Facebook Page before retrying manually.");
    }
    if (warnings.length) {
      post.dataWarning = warnings.join(" ");
      if (post.status === "scheduled") {
        post.status = "failed";
        post.recoverable = true;
        post.error = post.dataWarning;
      }
    } else {
      delete post.dataWarning;
    }
    return post;
  }
});

function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

function sendText(res, status, body, contentType) {
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function readRawBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  const raw = await readRawBody(req);
  return raw.length ? JSON.parse(raw.toString("utf8")) : {};
}

function authPayload(req) {
  return {
    authenticated: sessions.isAuthenticated(req),
    adminConfigured: configValidation.adminConfigured,
    localDevAuth: !configValidation.adminConfigured && sessions.isLocalRequest(req),
    warnings: configValidation.warnings
  };
}

function requireAuth(req, res) {
  if (sessions.isAuthenticated(req)) return true;
  sendJson(res, 401, { error: "Admin login is required." });
  return false;
}

function publicConfig(req) {
  return {
    dryRun: config.dryRun,
    graphVersion: config.graphVersion,
    hasPageToken: Boolean(config.pageAccessToken),
    defaultPageId: config.pageId,
    appBaseUrl: config.appBaseUrl,
    schedulerIntervalMs: config.schedulerIntervalMs,
    uploadMaxBytes: config.uploadMaxBytes,
    auth: authPayload(req),
    warnings: configValidation.warnings
  };
}

function normalizeError(error) {
  return {
    message: error.message || "Unknown error.",
    ...(error.code ? { code: error.code } : {}),
    ...(error.fbtrace_id ? { fbtrace_id: error.fbtrace_id } : {})
  };
}

async function parseMultipartImage(req) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Expected multipart/form-data upload.");
  const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
  const raw = await readRawBody(req, config.uploadMaxBytes + 100_000);
  const parts = raw.toString("binary").split(boundary).slice(1, -1);

  for (const part of parts) {
    const index = part.indexOf("\r\n\r\n");
    if (index === -1) continue;
    const headerText = part.slice(0, index);
    const disposition = headerText.match(/content-disposition:[^\r\n]*name="image"[^\r\n]*filename="([^"]*)"/i);
    if (!disposition) continue;
    const typeMatch = headerText.match(/content-type:\s*([^\r\n]+)/i);
    const mimeType = (typeMatch?.[1] || "").trim().toLowerCase();
    const ext = uploadTypes.get(mimeType) || extname(disposition[1]).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext) || !uploadTypes.has(mimeType)) {
      throw new Error("Only jpg, jpeg, png, and webp images are allowed.");
    }
    let bodyBinary = part.slice(index + 4);
    if (bodyBinary.endsWith("\r\n")) bodyBinary = bodyBinary.slice(0, -2);
    const buffer = Buffer.from(bodyBinary, "binary");
    if (buffer.length > config.uploadMaxBytes) throw new Error("Image is larger than the upload limit.");
    if (!buffer.length) throw new Error("Uploaded image is empty.");
    const filename = `${Date.now()}-${randomUUID()}${ext === ".jpeg" ? ".jpg" : ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, filename), buffer);
    return {
      url: publicUploadUrlForFile(filename),
      filename,
      mimeType,
      size: buffer.length
    };
  }

  throw new Error("Upload field must be named image.");
}

async function recoverPublishingOnStartup() {
  const posts = await store.listPosts();
  const publishing = posts.filter((post) => post.status === "publishing");
  for (const post of publishing) {
    await store.updatePost(post.id, {
      status: "failed",
      recoverable: true,
      lockedAt: "",
      error: "Server restarted while this post was publishing. Check the Facebook Page, then retry manually if needed."
    });
  }
}

let schedulerRunning = false;

async function recoverStalePublishing() {
  const posts = await store.listPosts();
  const now = Date.now();
  let recovered = 0;
  for (const post of posts) {
    if (post.status !== "publishing") continue;
    if (now - Date.parse(post.lockedAt || post.updatedAt || 0) <= STALE_PUBLISHING_MS) continue;
    await store.updatePost(post.id, {
      status: "failed",
      recoverable: true,
      lockedAt: "",
      error: "Publishing lock expired after 10 minutes. Check the Facebook Page, then retry manually if needed."
    });
    recovered += 1;
  }
  return recovered;
}

async function runSchedulerTick() {
  if (schedulerRunning) return { skipped: true, reason: "Scheduler tick is already running." };
  schedulerRunning = true;
  const result = { checked: 0, published: 0, failed: 0, recovered: 0 };
  try {
    result.recovered = await recoverStalePublishing();
    const posts = await store.listPosts();
    const now = Date.now();

    for (const post of posts) {
      if (post.status !== "scheduled") continue;
      if (Date.parse(post.scheduledAt) > now) continue;
      result.checked += 1;

      const locked = await store.updatePost(post.id, (current) => {
        if (current.status !== "scheduled") return null;
        if (Date.parse(current.scheduledAt) > Date.now()) return null;
        return {
          status: "publishing",
          lockedAt: new Date().toISOString(),
          error: "",
          recoverable: false
        };
      });
      if (!locked) continue;

      try {
        const publishResult = await publishPost(locked, { config, uploadDir: UPLOAD_DIR });
        await store.updatePost(locked.id, {
          status: publishResult.provider === "mock" ? "mock_published" : "published",
          lockedAt: "",
          publishedAt: new Date().toISOString(),
          publishResult,
          error: "",
          recoverable: false
        });
        result.published += 1;
      } catch (error) {
        const normalized = normalizeError(error);
        await store.updatePost(locked.id, {
          status: "failed",
          lockedAt: "",
          error: [
            normalized.message,
            normalized.code ? `code=${normalized.code}` : "",
            normalized.fbtrace_id ? `fbtrace_id=${normalized.fbtrace_id}` : ""
          ].filter(Boolean).join(" "),
          publishError: normalized,
          recoverable: true
        });
        result.failed += 1;
      }
    }
    return result;
  } finally {
    schedulerRunning = false;
  }
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/config" && req.method === "GET") {
    return sendJson(res, 200, publicConfig(req));
  }

  if (url.pathname === "/api/session" && req.method === "GET") {
    return sendJson(res, 200, authPayload(req));
  }

  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = await readJsonBody(req);
    const result = sessions.login(req, res, body);
    if (!result.authenticated) return sendJson(res, 401, { error: result.error });
    return sendJson(res, 200, { ...authPayload(req), authenticated: true, localDevAuth: Boolean(result.localDevAuth) });
  }

  if (url.pathname === "/api/logout" && req.method === "POST") {
    sessions.clearSession(req, res);
    return sendJson(res, 200, { authenticated: false });
  }

  if (!requireAuth(req, res)) return;

  if (url.pathname === "/api/health" && req.method === "GET") {
    const posts = await store.listPosts();
    const counts = posts.reduce((acc, post) => {
      acc[post.status] = (acc[post.status] || 0) + 1;
      return acc;
    }, {});
    return sendJson(res, 200, {
      ok: true,
      dryRun: config.dryRun,
      scheduler: {
        running: schedulerRunning,
        intervalMs: config.schedulerIntervalMs
      },
      storage: {
        provider: "json",
        postsFile: "data/posts.json"
      },
      counts
    });
  }

  if (url.pathname === "/api/scheduler/tick" && req.method === "POST") {
    return sendJson(res, 200, await runSchedulerTick());
  }

  if (url.pathname === "/api/export/posts.json" && req.method === "GET") {
    const body = JSON.stringify(await store.listPosts(), null, 2) + "\n";
    return sendText(res, 200, body, "application/json; charset=utf-8");
  }

  if (url.pathname === "/api/export/posts.csv" && req.method === "GET") {
    return sendText(res, 200, toCsv(await store.listPosts()), "text/csv; charset=utf-8");
  }

  if (url.pathname === "/api/uploads/image" && req.method === "POST") {
    return sendJson(res, 201, await parseMultipartImage(req));
  }

  if (url.pathname === "/api/posts" && req.method === "GET") {
    const posts = await store.listPosts();
    posts.sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    return sendJson(res, 200, posts);
  }

  if (url.pathname === "/api/posts" && req.method === "POST") {
    const body = await readJsonBody(req);
    const post = await store.createPost(normalizePost(body, {}, { defaultPageId: config.pageId, requireFuture: true }));
    return sendJson(res, 201, post);
  }

  if (url.pathname === "/api/import" && req.method === "POST") {
    const body = await readJsonBody(req);
    const incoming = Array.isArray(body.posts) ? body.posts : parseCsv(String(body.csv || ""));
    const valid = [];
    const errors = [];
    incoming.forEach((item, index) => {
      try {
        valid.push(normalizePost(item, {}, { defaultPageId: config.pageId, requireFuture: true }));
      } catch (error) {
        errors.push({ line: index + 2, error: error.message, row: item });
      }
    });
    const created = valid.length ? await store.bulkCreatePosts(valid) : [];
    return sendJson(errors.length ? 207 : 201, { count: created.length, posts: created, errors });
  }

  const retryMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/retry$/);
  if (retryMatch && req.method === "POST") {
    const post = await store.updatePost(retryMatch[1], (current) => {
      if (current.status === "publishing") {
        return {
          status: "failed",
          error: "Post is currently publishing. Wait for lock recovery before retrying.",
          recoverable: true
        };
      }
      return {
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 30_000).toISOString(),
        lockedAt: "",
        error: "",
        publishError: null,
        retryCount: Number(current.retryCount || 0) + 1,
        recoverable: false
      };
    });
    if (!post) return sendJson(res, 404, { error: "Post not found." });
    return sendJson(res, 200, post);
  }

  const match = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (match) {
    const id = match[1];
    const existing = await store.getPost(id);
    if (!existing) return sendJson(res, 404, { error: "Post not found." });

    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      const updated = await store.updatePost(id, normalizePost(body, existing, { defaultPageId: config.pageId }));
      return sendJson(res, 200, updated);
    }

    if (req.method === "DELETE") {
      const deleted = await store.deletePost(id);
      return sendJson(res, 200, deleted);
    }
  }

  return sendJson(res, 404, { error: "Not found." });
}

async function serveStaticFile(res, filePath, contentType) {
  try {
    const file = await stat(filePath);
    if (!file.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
  } catch {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Could not read file");
    } else {
      res.destroy();
    }
  });
  res.writeHead(200, { "content-type": contentType || mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream" });
  stream.pipe(res);
}

async function serveStatic(req, res, url) {
  if (url.pathname.startsWith("/uploads/")) {
    const requested = decodeURIComponent(url.pathname.replace(/^\/uploads\//, ""));
    const filePath = resolve(UPLOAD_DIR, requested);
    if (!filePath.startsWith(resolve(UPLOAD_DIR))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    await serveStaticFile(res, filePath);
    return;
  }

  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = resolve(PUBLIC_DIR, `.${decodeURIComponent(requested)}`);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  await serveStaticFile(res, filePath);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Request failed." });
  }
});

if (configValidation.errors.length) {
  console.error("Configuration errors:");
  for (const error of configValidation.errors) console.error(`- ${error}`);
  process.exit(1);
}
for (const warning of configValidation.warnings) console.warn(`Config warning: ${warning}`);

await mkdir(UPLOAD_DIR, { recursive: true });
await store.ensureDataFile();
await recoverPublishingOnStartup();

setInterval(() => {
  runSchedulerTick().catch((error) => console.error("Scheduler error:", error));
}, config.schedulerIntervalMs);
runSchedulerTick().catch((error) => console.error("Scheduler error:", error));

server.listen(config.port, () => {
  console.log(`Facebook Post Scheduler running at http://localhost:${config.port}`);
  console.log(`Mode: ${config.dryRun ? "dry run/mock publish" : "Facebook Graph API"}`);
});
