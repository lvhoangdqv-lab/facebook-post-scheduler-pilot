function graphUrl(config, path) {
  return `https://graph.facebook.com/${config.graphVersion || "v25.0"}/${path}`;
}

async function parseFacebookResponse(response, fallback) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || fallback || "Facebook API request failed.");
    if (data?.error?.code) error.code = data.error.code;
    if (data?.error?.fbtrace_id) error.fbtrace_id = data.error.fbtrace_id;
    error.raw = data;
    throw error;
  }
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

function isVideoMediaUrl(value = "") {
  try {
    return [".mp4", ".mov", ".webm"].some((ext) => new URL(value).pathname.toLowerCase().endsWith(ext));
  } catch {
    return false;
  }
}

async function postFirstComment({ config, postId, message }) {
  if (!message || !postId) return null;
  const body = new URLSearchParams();
  body.set("access_token", config.pageAccessToken);
  body.set("message", message);
  const response = await fetch(graphUrl(config, `${postId}/comments`), { method: "POST", body });
  return parseFacebookResponse(response, "Facebook first comment request failed.");
}

export async function publishPost(post, config) {
  if (config.dryRun) {
    return {
      provider: "mock",
      id: `mock_${Date.now()}`,
      postId: `mock_${Date.now()}`,
      raw: { message: "Dry run: no Facebook API call was made." }
    };
  }

  const pageId = post.pageId || config.pageId;
  if (!pageId || !/^\d+$/.test(String(pageId))) throw new Error("Missing or invalid Facebook Page ID.");
  if (!config.pageAccessToken) throw new Error("Missing Facebook Page access token.");

  let raw;
  if (post.imageUrl) {
    if (isVideoMediaUrl(post.imageUrl)) {
      throw new Error("Video/Reels/Stories publishing is not enabled in this pilot. Use dry-run for video drafts or publish text/photo posts.");
    }
    const body = new URLSearchParams();
    body.set("access_token", config.pageAccessToken);
    body.set("url", post.imageUrl);
    body.set("caption", post.caption);
    const response = await fetch(graphUrl(config, `${pageId}/photos`), { method: "POST", body });
    raw = await parseFacebookResponse(response, "Facebook photo publish failed.");
  } else {
    const body = new URLSearchParams();
    body.set("access_token", config.pageAccessToken);
    body.set("message", post.caption);
    const response = await fetch(graphUrl(config, `${pageId}/feed`), { method: "POST", body });
    raw = await parseFacebookResponse(response, "Facebook text publish failed.");
  }

  const firstComment = await postFirstComment({ config, postId: raw.post_id || raw.id, message: post.firstComment });
  return normalizePublishResult(raw, firstComment);
}
