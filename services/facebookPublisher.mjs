import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const imageMimeTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);

function graphUrl(config, path) {
  return `https://graph.facebook.com/${config.graphVersion}/${path}`;
}

function normalizeFacebookError(data, fallback) {
  const error = new Error(data?.error?.message || fallback || "Facebook API request failed.");
  if (data?.error?.code) error.code = data.error.code;
  if (data?.error?.fbtrace_id) error.fbtrace_id = data.error.fbtrace_id;
  error.raw = data;
  return error;
}

async function parseFacebookResponse(response, fallback) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw normalizeFacebookError(data, fallback);
  return data;
}

function normalizePublishResult(raw, firstComment) {
  const id = raw.id || raw.post_id || "";
  return {
    provider: "facebook",
    id,
    postId: raw.post_id || raw.id || id,
    raw,
    ...(firstComment ? { firstComment } : {})
  };
}

function localUploadPath(imageUrl, uploadDir) {
  const decoded = decodeURIComponent(imageUrl.replace(/^\/uploads\//, ""));
  const filePath = resolve(uploadDir, decoded);
  if (!filePath.startsWith(resolve(uploadDir))) throw new Error("Local upload path is invalid.");
  return filePath;
}

async function postFirstComment({ config, postId, message }) {
  if (!message || !postId) return null;
  const body = new URLSearchParams();
  body.set("access_token", config.pageAccessToken);
  body.set("message", message);
  const response = await fetch(graphUrl(config, `${postId}/comments`), { method: "POST", body });
  return parseFacebookResponse(response, "Facebook first comment request failed.");
}

export async function publishPost(post, { config, uploadDir }) {
  if (config.dryRun) {
    return {
      provider: "mock",
      id: `mock_${Date.now()}`,
      postId: `mock_${Date.now()}`,
      raw: { message: "Dry run: no Facebook API call was made." }
    };
  }

  const pageId = post.pageId || config.pageId;
  if (!pageId) throw new Error("Missing Facebook Page ID.");
  if (!config.pageAccessToken) throw new Error("Missing Facebook Page access token.");

  let raw;
  if (post.imageUrl) {
    const body = new FormData();
    body.set("access_token", config.pageAccessToken);
    body.set("caption", post.caption);

    if (post.imageUrl.startsWith("/uploads/")) {
      const filePath = localUploadPath(post.imageUrl, uploadDir);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) throw new Error("Local uploaded image was not found.");
      const ext = extname(filePath).toLowerCase();
      const mimeType = imageMimeTypes.get(ext) || "application/octet-stream";
      body.set("source", new Blob([await readFile(filePath)], { type: mimeType }), filePath.split(/[\\/]/).pop());
    } else {
      body.set("url", post.imageUrl);
    }

    const response = await fetch(graphUrl(config, `${pageId}/photos`), { method: "POST", body });
    raw = await parseFacebookResponse(response, "Facebook photo publish failed.");
  } else {
    const body = new URLSearchParams();
    body.set("access_token", config.pageAccessToken);
    body.set("message", post.caption);
    const response = await fetch(graphUrl(config, `${pageId}/feed`), { method: "POST", body });
    raw = await parseFacebookResponse(response, "Facebook text publish failed.");
  }

  const postId = raw.post_id || raw.id;
  const firstComment = await postFirstComment({ config, postId, message: post.firstComment });
  return normalizePublishResult(raw, firstComment);
}

export function publicUploadUrlForFile(filename) {
  return `/uploads/${encodeURIComponent(filename)}`;
}
