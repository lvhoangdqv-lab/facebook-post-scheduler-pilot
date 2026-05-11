export const VALID_STATUSES = new Set(["draft", "scheduled", "publishing", "mock_published", "published", "failed"]);
export const MAX_CAPTION_LENGTH = 5000;

export function validateImageUrl(imageUrl) {
  if (!imageUrl) return;
  if (imageUrl.startsWith("/uploads/")) {
    if (imageUrl.includes("..") || imageUrl.includes("\\")) {
      throw new Error("Local upload URL is invalid.");
    }
    return;
  }

  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error("Image URL must be a valid http(s) URL or a local /uploads/... URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Image URL must use http or https.");
  }
  if (parsed.hostname.includes("drive.google.com") && parsed.pathname.includes("/file/d/")) {
    throw new Error("Google Drive view links are not direct image URLs. Use a direct public image URL or upload an image.");
  }
}

function parseScheduledAt(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("A valid scheduled time is required.");
  const time = Date.parse(raw);
  if (Number.isNaN(time)) throw new Error("A valid scheduled time is required.");
  return new Date(time).toISOString();
}

export function normalizePost(input = {}, existing = {}, options = {}) {
  const status = String(input.status ?? existing.status ?? "scheduled");
  const caption = String(input.caption ?? existing.caption ?? "").trim();
  const scheduledAt = parseScheduledAt(input.scheduledAt ?? existing.scheduledAt);
  const pageId = String(input.pageId ?? existing.pageId ?? options.defaultPageId ?? "").trim();
  const imageUrl = String(input.imageUrl ?? existing.imageUrl ?? "").trim();
  const firstComment = String(input.firstComment ?? existing.firstComment ?? "").trim();
  const format = String(input.format ?? existing.format ?? "post").trim();
  const tags = String(input.tags ?? existing.tags ?? "").trim();
  const scheduleMode = String(input.scheduleMode ?? existing.scheduleMode ?? "Custom Time").trim();
  const scheduledTimezone = String(
    input.scheduledTimezone ??
    existing.scheduledTimezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "local"
  ).trim();

  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Status must be one of: ${[...VALID_STATUSES].join(", ")}`);
  }
  if (status === "scheduled" && !caption) {
    throw new Error("Caption is required for scheduled posts.");
  }
  if (caption.length > MAX_CAPTION_LENGTH) {
    throw new Error(`Caption must be ${MAX_CAPTION_LENGTH} characters or fewer.`);
  }
  if (pageId && !/^\d+$/.test(pageId)) {
    throw new Error("Facebook Page ID must be numeric. Do not paste a Facebook Page URL.");
  }
  validateImageUrl(imageUrl);
  if (options.requireFuture && status === "scheduled" && Date.parse(scheduledAt) <= Date.now()) {
    throw new Error("Scheduled time must be in the future.");
  }

  return {
    ...existing,
    caption,
    scheduledAt,
    scheduledTimezone,
    pageId,
    imageUrl,
    firstComment,
    format,
    tags,
    scheduleMode,
    status,
    updatedAt: new Date().toISOString()
  };
}
