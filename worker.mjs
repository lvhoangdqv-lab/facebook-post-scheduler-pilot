import { normalizePost, validateImageUrl } from "./lib/validation.mjs";
import { parseCsv, toCsv } from "./lib/csv.mjs";
import {
  clearSessionHeaders,
  createSessionHeaders,
  getSession,
  requireAdmin,
  securityHeaders,
  verifyCsrf,
  verifyPasswordHash
} from "./lib/edgeSecurity.mjs";
import { createSupabaseStore, uploadToSupabaseStorage } from "./storage/supabaseStore.mjs";
import { publishPost } from "./services/facebookPublisherEdge.mjs";

const STALE_PUBLISHING_MS = 10 * 60 * 1000;
const MAX_JSON_BYTES = 512 * 1024;
const DEFAULT_IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_VIDEO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
const rateBuckets = new Map();

const imageUploadTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

const videoUploadTypes = new Map([
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
  ["video/webm", ".webm"]
]);

function allowedOrigin(request, env) {
  const requestOrigin = new URL(request.url).origin;
  return env.PUBLIC_APP_ORIGIN || env.APP_BASE_URL || requestOrigin;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  const allow = allowedOrigin(request, env);
  if (!origin || origin !== allow) return {};
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "content-type, x-csrf-token, authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
  };
}

function withHeaders(headers, request, env) {
  return {
    ...securityHeaders(env),
    ...corsHeaders(request, env),
    ...headers
  };
}

function json(data, status, request, env, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: withHeaders({ "content-type": "application/json; charset=utf-8", ...headers }, request, env)
  });
}

function text(body, status, contentType, request, env, headers = {}) {
  return new Response(body, {
    status,
    headers: withHeaders({ "content-type": contentType, ...headers }, request, env)
  });
}

function clientError(error) {
  if (error?.code === "SUPABASE_INVALID_API_KEY") {
    return {
      code: "SUPABASE_INVALID_API_KEY",
      error: "Supabase service role key đang sai hoặc bị paste nhầm. Hãy cập nhật lại SUPABASE_SERVICE_ROLE_KEY bằng key service_role/secret của đúng project Supabase rồi deploy lại."
    };
  }
  if (error?.provider === "supabase") {
    return {
      code: "SUPABASE_STORAGE_ERROR",
      error: "Không kết nối được Supabase. Kiểm tra SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY và quyền bảng/storage."
    };
  }
  return { error: error?.message || "Request failed." };
}

function storageHealthFromError(error) {
  if (error?.code === "SUPABASE_INVALID_API_KEY") {
    return {
      ok: false,
      provider: "supabase",
      code: "SUPABASE_INVALID_API_KEY",
      message: "SUPABASE_SERVICE_ROLE_KEY không hợp lệ hoặc không thuộc project này."
    };
  }
  return {
    ok: false,
    provider: "supabase",
    code: error?.code || "SUPABASE_STORAGE_ERROR",
    message: "Không kiểm tra được Supabase. Xem lại SUPABASE_URL, key và schema."
  };
}

function ipOf(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
}

function checkRate(key, limit, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count <= limit;
}

async function readJson(request, limit = MAX_JSON_BYTES) {
  const clone = request.clone();
  const raw = await clone.arrayBuffer();
  if (raw.byteLength > limit) throw new Error("Request body is too large.");
  if (!raw.byteLength) return {};
  return JSON.parse(new TextDecoder().decode(raw));
}

function storeFor(env) {
  if ((env.STORAGE_DRIVER || "supabase") !== "supabase") {
    throw new Error("Cloudflare Worker production requires STORAGE_DRIVER=supabase.");
  }
  return createSupabaseStore(env);
}

function fbConfig(env) {
  return {
    dryRun: env.FB_DRY_RUN !== "false",
    graphVersion: env.FB_GRAPH_VERSION || "v25.0",
    pageId: env.FB_PAGE_ID || "",
    pageAccessToken: env.FB_PAGE_ACCESS_TOKEN || ""
  };
}

function publicConfig(env, session) {
  const config = fbConfig(env);
  const imageMaxBytes = Number(env.IMAGE_UPLOAD_MAX_BYTES || env.UPLOAD_MAX_BYTES || DEFAULT_IMAGE_UPLOAD_MAX_BYTES);
  const videoMaxBytes = Number(env.VIDEO_UPLOAD_MAX_BYTES || DEFAULT_VIDEO_UPLOAD_MAX_BYTES);
  return {
    dryRun: config.dryRun,
    graphVersion: config.graphVersion,
    hasPageToken: Boolean(config.pageAccessToken),
    defaultPageId: config.pageId,
    defaultPageName: env.FB_PAGE_NAME || "",
    uploadMaxBytes: imageMaxBytes,
    mediaLimits: {
      image: { maxBytes: imageMaxBytes, types: ["jpg", "jpeg", "png", "webp"] },
      video: { maxBytes: videoMaxBytes, types: ["mp4", "mov", "webm"] }
    },
    storageDriver: env.STORAGE_DRIVER || "supabase",
    auth: {
      authenticated: Boolean(session),
      adminConfigured: Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD_HASH && env.SESSION_SECRET)
    },
    warnings: [
      ...(!env.ADMIN_PASSWORD_HASH ? ["ADMIN_PASSWORD_HASH is missing."] : []),
      ...(!env.SESSION_SECRET || env.SESSION_SECRET.length < 24 ? ["SESSION_SECRET is empty or weak."] : []),
      ...((env.STORAGE_DRIVER || "supabase") !== "supabase" ? ["Production Worker must use Supabase storage."] : [])
    ]
  };
}

function normalizeFacebookError(error) {
  return {
    message: error.message || "Facebook publish failed.",
    ...(error.code ? { code: error.code } : {}),
    ...(error.fbtrace_id ? { fbtrace_id: error.fbtrace_id } : {})
  };
}

async function runTick(env, request = null) {
  const store = storeFor(env);
  const recovered = await store.recoverStalePublishing(new Date(Date.now() - STALE_PUBLISHING_MS).toISOString());
  const due = await store.listDuePosts(new Date().toISOString());
  const result = { checked: due.length, recovered: recovered.length, published: 0, failed: 0 };

  for (const post of due) {
    const locked = await store.lockScheduledPost(post.id, new Date().toISOString());
    if (!locked) continue;

    try {
      const publishResult = await publishPost(locked, fbConfig(env));
      await store.updatePost(locked.id, {
        status: publishResult.provider === "mock" ? "mock_published" : "published",
        lockedAt: "",
        publishedAt: new Date().toISOString(),
        publishResult,
        publishError: null,
        error: "",
        recoverable: false
      });
      await store.audit("publish_success", { postId: locked.id, provider: publishResult.provider }, request);
      result.published += 1;
    } catch (error) {
      const normalized = normalizeFacebookError(error);
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
      await store.audit("publish_failed", { postId: locked.id, error: normalized }, request);
      result.failed += 1;
    }
  }

  return result;
}

async function requireAdminResponse(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: "Admin login is required." }, 401, request, env);
  if (!verifyCsrf(request)) return json({ error: "Invalid CSRF token." }, 403, request, env);
  return null;
}

function assertWriteRate(request, kind) {
  const ip = ipOf(request);
  if (kind === "upload") return checkRate(`upload:${ip}`, 20, 10 * 60 * 1000);
  return checkRate(`write:${ip}`, 120, 60 * 1000);
}

function uploadRuleForFile(file, routeKind) {
  const lowerName = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  if (imageUploadTypes.has(type)) {
    const validName = [".jpg", ".jpeg", ".png", ".webp"].some((value) => lowerName.endsWith(value));
    if (!validName) throw new Error("Image extension must be jpg, jpeg, png, or webp.");
    return {
      kind: "image",
      ext: imageUploadTypes.get(type),
      maxBytesKey: "IMAGE_UPLOAD_MAX_BYTES",
      fallbackMaxBytes: DEFAULT_IMAGE_UPLOAD_MAX_BYTES,
      envFallbackKey: "UPLOAD_MAX_BYTES"
    };
  }
  if (routeKind !== "image" && videoUploadTypes.has(type)) {
    const validName = [".mp4", ".mov", ".webm"].some((value) => lowerName.endsWith(value));
    if (!validName) throw new Error("Video extension must be mp4, mov, or webm.");
    return {
      kind: "video",
      ext: videoUploadTypes.get(type),
      maxBytesKey: "VIDEO_UPLOAD_MAX_BYTES",
      fallbackMaxBytes: DEFAULT_VIDEO_UPLOAD_MAX_BYTES
    };
  }
  if (routeKind === "image") throw new Error("Only jpg, jpeg, png, and webp images are allowed.");
  throw new Error("Only jpg, jpeg, png, webp, mp4, mov, and webm media files are allowed.");
}

function uploadMaxBytesForRule(env, rule) {
  return Number(env[rule.maxBytesKey] || (rule.envFallbackKey ? env[rule.envFallbackKey] : "") || rule.fallbackMaxBytes);
}

async function handleUpload(request, env, store, routeKind = "image") {
  if (!assertWriteRate(request, "upload")) return json({ error: "Upload rate limit exceeded." }, 429, request, env);
  const form = await request.formData();
  const file = form.get("media") || form.get("image") || form.get("video");
  if (!(file instanceof File)) throw new Error("Upload field must be named media.");

  const rule = uploadRuleForFile(file, routeKind);
  const maxBytes = uploadMaxBytesForRule(env, rule);
  if (file.size > maxBytes) throw new Error(`${rule.kind === "video" ? "Video" : "Image"} is larger than the upload limit.`);
  if (!file.size) throw new Error("Uploaded file is empty.");

  const path = `${rule.kind}s/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${rule.ext}`;
  const url = await uploadToSupabaseStorage(env, {
    path,
    bytes: await file.arrayBuffer(),
    contentType: file.type
  });
  await store.audit(`upload_${rule.kind}`, { path, size: file.size, type: file.type }, request);
  return json({ url, path, size: file.size, mimeType: file.type, kind: rule.kind, mediaType: rule.kind }, 201, request, env);
}

async function handleApi(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: withHeaders({}, request, env) });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const session = await getSession(request, env);

  if (path === "/api/config" && request.method === "GET") {
    return json(publicConfig(env, session), 200, request, env);
  }

  if (path === "/api/session" && request.method === "GET") {
    return json({ authenticated: Boolean(session) }, 200, request, env);
  }

  if (path === "/api/login" && request.method === "POST") {
    const ip = ipOf(request);
    const store = storeFor(env);
    if (!checkRate(`login:${ip}`, 10, 10 * 60 * 1000)) {
      await store.audit("login_rate_limited", { ip }, request);
      return json({ error: "Too many login attempts." }, 429, request, env);
    }
    const body = await readJson(request, 10 * 1024);
    const ok = env.ADMIN_USERNAME &&
      env.ADMIN_PASSWORD_HASH &&
      body.username === env.ADMIN_USERNAME &&
      await verifyPasswordHash(String(body.password || ""), env.ADMIN_PASSWORD_HASH);
    await store.audit(ok ? "login_success" : "login_failed", { username: body.username || "" }, request);
    if (!ok) return json({ error: "Invalid username or password." }, 401, request, env);
    const headers = new Headers(withHeaders({ "content-type": "application/json; charset=utf-8" }, request, env));
    for (const cookie of await createSessionHeaders(env, request.url)) headers.append("set-cookie", cookie);
    return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers });
  }

  if (path === "/api/logout" && request.method === "POST") {
    if (!(await requireAdmin(request, env)) || !verifyCsrf(request)) {
      return json({ error: "Invalid session or CSRF token." }, 403, request, env);
    }
    const headers = new Headers(withHeaders({ "content-type": "application/json; charset=utf-8" }, request, env));
    for (const cookie of clearSessionHeaders(env, request.url)) headers.append("set-cookie", cookie);
    return new Response(JSON.stringify({ authenticated: false }), { status: 200, headers });
  }

  if (path === "/api/cron/tick" && request.method === "POST") {
    const expected = `Bearer ${env.CRON_SECRET || ""}`;
    if (!env.CRON_SECRET || request.headers.get("authorization") !== expected) {
      return json({ error: "Unauthorized cron request." }, 401, request, env);
    }
    return json(await runTick(env, request), 200, request, env);
  }

  const authError = await requireAdminResponse(request, env);
  if (authError) return authError;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !assertWriteRate(request, "write")) {
    return json({ error: "API write rate limit exceeded." }, 429, request, env);
  }

  const store = storeFor(env);

  if (path === "/api/health" && request.method === "GET") {
    try {
      const posts = await store.listPosts();
      const counts = posts.reduce((acc, post) => {
        acc[post.status] = (acc[post.status] || 0) + 1;
        return acc;
      }, {});
      return json({ ok: true, dryRun: fbConfig(env).dryRun, storage: { ok: true, provider: "supabase" }, counts }, 200, request, env);
    } catch (error) {
      return json({ ok: false, dryRun: fbConfig(env).dryRun, storage: storageHealthFromError(error), counts: {} }, 200, request, env);
    }
  }

  if (path === "/api/scheduler/tick" && request.method === "POST") {
    return json(await runTick(env, request), 200, request, env);
  }

  if (path === "/api/uploads/image" && request.method === "POST") {
    return handleUpload(request, env, store, "image");
  }

  if (path === "/api/uploads/media" && request.method === "POST") {
    return handleUpload(request, env, store, "media");
  }

  if (path === "/api/export/posts.json" && request.method === "GET") {
    return text(JSON.stringify(await store.listPosts(), null, 2) + "\n", 200, "application/json; charset=utf-8", request, env);
  }

  if (path === "/api/export/posts.csv" && request.method === "GET") {
    return text(toCsv(await store.listPosts()), 200, "text/csv; charset=utf-8", request, env);
  }

  if (path === "/api/posts" && request.method === "GET") {
    return json(await store.listPosts(), 200, request, env);
  }

  if (path === "/api/posts" && request.method === "POST") {
    const post = normalizePost(await readJson(request), {}, { defaultPageId: env.FB_PAGE_ID || "", requireFuture: true });
    const created = await store.createPost(post);
    await store.audit("post_create", { postId: created.id }, request);
    return json(created, 201, request, env);
  }

  if (path === "/api/import" && request.method === "POST") {
    const body = await readJson(request);
    const incoming = Array.isArray(body.posts) ? body.posts : parseCsv(String(body.csv || ""));
    const valid = [];
    const errors = [];
    incoming.forEach((item, index) => {
      try {
        valid.push(normalizePost(item, {}, { defaultPageId: env.FB_PAGE_ID || "", requireFuture: true }));
      } catch (error) {
        errors.push({ line: index + 2, error: error.message, row: item });
      }
    });
    const created = valid.length ? await store.bulkCreatePosts(valid) : [];
    await store.audit("post_import", { count: created.length, errorCount: errors.length }, request);
    return json({ count: created.length, posts: created, errors }, errors.length ? 207 : 201, request, env);
  }

  const retryMatch = path.match(/^\/api\/posts\/([^/]+)\/retry$/);
  if (retryMatch && request.method === "POST") {
    const current = await store.getPost(retryMatch[1]);
    if (!current) return json({ error: "Post not found." }, 404, request, env);
    const updated = await store.updatePost(current.id, {
      ...current,
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 30_000).toISOString(),
      lockedAt: "",
      error: "",
      publishError: null,
      recoverable: false,
      retryCount: Number(current.retryCount || 0) + 1
    });
    await store.audit("post_retry", { postId: updated.id }, request);
    return json(updated, 200, request, env);
  }

  const postMatch = path.match(/^\/api\/posts\/([^/]+)$/);
  if (postMatch) {
    const current = await store.getPost(postMatch[1]);
    if (!current) return json({ error: "Post not found." }, 404, request, env);

    if (request.method === "PUT") {
      const updated = await store.updatePost(current.id, normalizePost(await readJson(request), current, { defaultPageId: env.FB_PAGE_ID || "" }));
      await store.audit("post_update", { postId: updated.id }, request);
      return json(updated, 200, request, env);
    }

    if (request.method === "DELETE") {
      const deleted = await store.deletePost(current.id);
      await store.audit("post_delete", { postId: current.id }, request);
      return json(deleted, 200, request, env);
    }
  }

  return json({ error: "Not found." }, 404, request, env);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      if (env.ASSETS) {
        const response = await env.ASSETS.fetch(request);
        const headers = new Headers(response.headers);
        for (const [key, value] of Object.entries(securityHeaders(env))) headers.set(key, value);
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      }
      return text("Static assets are not bound. Deploy with Cloudflare Workers assets or Cloudflare Pages.", 404, "text/plain; charset=utf-8", request, env);
    } catch (error) {
      return json(clientError(error), 400, request, env);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runTick(env));
  }
};
