function required(env, key) {
  if (!env[key]) throw new Error(`Missing ${key}`);
  return env[key].replace(/\/$/, "");
}

function dbHeaders(env, prefer = "") {
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json"
  };
  if (prefer) headers.prefer = prefer;
  return headers;
}

function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    caption: row.caption || "",
    scheduledAt: row.scheduled_at,
    pageId: row.page_id || "",
    imageUrl: row.image_url || "",
    firstComment: row.first_comment || "",
    format: row.format || "post",
    tags: row.tags || "",
    scheduleMode: row.schedule_mode || "Custom Time",
    status: row.status,
    lockedAt: row.locked_at || "",
    publishedAt: row.published_at || "",
    publishResult: row.publish_result || null,
    publishError: row.publish_error || null,
    error: row.error || "",
    recoverable: Boolean(row.recoverable),
    retryCount: Number(row.retry_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toSnake(post) {
  const row = {};
  if ("caption" in post) row.caption = post.caption ?? "";
  if ("scheduledAt" in post) row.scheduled_at = post.scheduledAt;
  if ("pageId" in post) row.page_id = post.pageId || null;
  if ("imageUrl" in post) row.image_url = post.imageUrl || null;
  if ("firstComment" in post) row.first_comment = post.firstComment || null;
  if ("format" in post) row.format = post.format || "post";
  if ("tags" in post) row.tags = post.tags || null;
  if ("scheduleMode" in post) row.schedule_mode = post.scheduleMode || "Custom Time";
  if ("status" in post) row.status = post.status;
  if ("lockedAt" in post) row.locked_at = post.lockedAt || null;
  if ("publishedAt" in post) row.published_at = post.publishedAt || null;
  if ("publishResult" in post) row.publish_result = post.publishResult || null;
  if ("publishError" in post) row.publish_error = post.publishError || null;
  if ("error" in post) row.error = post.error || null;
  if ("recoverable" in post) row.recoverable = Boolean(post.recoverable);
  if ("retryCount" in post) row.retry_count = Number(post.retryCount || 0);
  return row;
}

async function supabaseFetch(env, path, init = {}) {
  const base = required(env, "SUPABASE_URL");
  required(env, "SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Supabase request failed (${response.status}).`);
    error.provider = "supabase";
    error.status = response.status;
    error.detail = text.slice(0, 300);
    if (response.status === 401 && /Invalid API key/i.test(text)) {
      error.code = "SUPABASE_INVALID_API_KEY";
      error.message = "Supabase API key is invalid.";
    }
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

export function createSupabaseStore(env) {
  return {
    async listPosts() {
      const rows = await supabaseFetch(env, "/rest/v1/posts?select=*&order=scheduled_at.asc", {
        headers: dbHeaders(env)
      });
      return rows.map(toCamel);
    },

    async listDuePosts(nowIso) {
      const rows = await supabaseFetch(
        env,
        `/rest/v1/posts?select=*&status=eq.scheduled&scheduled_at=lte.${encodeURIComponent(nowIso)}&order=scheduled_at.asc&limit=25`,
        { headers: dbHeaders(env) }
      );
      return rows.map(toCamel);
    },

    async getPost(id) {
      const rows = await supabaseFetch(env, `/rest/v1/posts?select=*&id=eq.${encodeURIComponent(id)}&limit=1`, {
        headers: dbHeaders(env)
      });
      return toCamel(rows[0]);
    },

    async createPost(post) {
      const rows = await supabaseFetch(env, "/rest/v1/posts", {
        method: "POST",
        headers: dbHeaders(env, "return=representation"),
        body: JSON.stringify(toSnake(post))
      });
      return toCamel(rows[0]);
    },

    async bulkCreatePosts(posts) {
      const rows = await supabaseFetch(env, "/rest/v1/posts", {
        method: "POST",
        headers: dbHeaders(env, "return=representation"),
        body: JSON.stringify(posts.map(toSnake))
      });
      return rows.map(toCamel);
    },

    async updatePost(id, patch) {
      const rows = await supabaseFetch(env, `/rest/v1/posts?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: dbHeaders(env, "return=representation"),
        body: JSON.stringify(toSnake(patch))
      });
      return toCamel(rows[0]);
    },

    async lockScheduledPost(id, lockedAt) {
      const rows = await supabaseFetch(env, `/rest/v1/posts?id=eq.${encodeURIComponent(id)}&status=eq.scheduled`, {
        method: "PATCH",
        headers: dbHeaders(env, "return=representation"),
        body: JSON.stringify({ status: "publishing", locked_at: lockedAt, error: null, recoverable: false })
      });
      return toCamel(rows[0]);
    },

    async recoverStalePublishing(beforeIso) {
      const rows = await supabaseFetch(env, `/rest/v1/posts?status=eq.publishing&locked_at=lt.${encodeURIComponent(beforeIso)}`, {
        method: "PATCH",
        headers: dbHeaders(env, "return=representation"),
        body: JSON.stringify({
          status: "failed",
          locked_at: null,
          recoverable: true,
          error: "Publishing lock expired after 10 minutes. Check the Facebook Page, then retry manually if needed."
        })
      });
      return rows.map(toCamel);
    },

    async deletePost(id) {
      const rows = await supabaseFetch(env, `/rest/v1/posts?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: dbHeaders(env, "return=representation")
      });
      return toCamel(rows[0]);
    },

    async audit(action, metadata = {}, request = null) {
      try {
        await supabaseFetch(env, "/rest/v1/audit_logs", {
          method: "POST",
          headers: dbHeaders(env),
          body: JSON.stringify({
            action,
            actor: "admin",
            ip: request?.headers.get("cf-connecting-ip") || request?.headers.get("x-forwarded-for") || null,
            user_agent: request?.headers.get("user-agent") || null,
            metadata
          })
        });
      } catch {
        // Audit logging must never leak implementation errors or block admin flows.
      }
    }
  };
}

export async function uploadToSupabaseStorage(env, { path, bytes, contentType }) {
  const base = required(env, "SUPABASE_URL");
  required(env, "SUPABASE_SERVICE_ROLE_KEY");
  const bucket = env.SUPABASE_STORAGE_BUCKET || "post-images";
  const response = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": contentType,
      "x-upsert": "false"
    },
    body: bytes
  });
  if (!response.ok) throw new Error(`Image upload failed (${response.status}).`);

  if (env.SUPABASE_STORAGE_SIGNED_SECONDS) {
    const signed = await fetch(`${base}/storage/v1/object/sign/${bucket}/${path}`, {
      method: "POST",
      headers: dbHeaders(env),
      body: JSON.stringify({ expiresIn: Number(env.SUPABASE_STORAGE_SIGNED_SECONDS) })
    });
    if (!signed.ok) throw new Error("Could not create signed image URL.");
    const data = await signed.json();
    return `${base}/storage/v1${data.signedURL}`;
  }

  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
