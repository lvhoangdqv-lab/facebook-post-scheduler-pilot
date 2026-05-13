import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseStore } from "../storage/supabaseStore.mjs";

test("supabaseStore classifies invalid API key errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ message: "Invalid API key", hint: "Double check your Supabase `anon` or `service_role` API key." }),
    { status: 401, headers: { "content-type": "application/json" } }
  );

  try {
    const store = createSupabaseStore({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "bad-key"
    });
    await assert.rejects(
      () => store.listPosts(),
      (error) => error.code === "SUPABASE_INVALID_API_KEY" && error.provider === "supabase"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
