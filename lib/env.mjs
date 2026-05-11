import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function stripQuotes(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export async function loadDotEnv(filePath = resolve(".env")) {
  if (!existsSync(filePath)) return;
  const raw = await readFile(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = stripQuotes(trimmed.slice(index + 1));
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function buildConfig(env = process.env) {
  const dryRun = env.FB_DRY_RUN !== "false";
  const port = Number(env.PORT || 4173);
  const schedulerIntervalMs = Math.max(5_000, Number(env.SCHEDULER_INTERVAL_MS || 30_000));
  const uploadMaxBytes = Math.max(1_000_000, Number(env.UPLOAD_MAX_BYTES || 8 * 1024 * 1024));
  return {
    port,
    appBaseUrl: env.APP_BASE_URL || `http://localhost:${port}`,
    dryRun,
    graphVersion: env.FB_GRAPH_VERSION || "v25.0",
    pageId: env.FB_PAGE_ID || "",
    pageAccessToken: env.FB_PAGE_ACCESS_TOKEN || "",
    adminUsername: env.ADMIN_USERNAME || "",
    adminPassword: env.ADMIN_PASSWORD || "",
    sessionSecret: env.SESSION_SECRET || "",
    schedulerIntervalMs,
    uploadMaxBytes,
    nodeEnv: env.NODE_ENV || "development"
  };
}

export function validateConfig(config) {
  const errors = [];
  const warnings = [];
  const adminConfigured = Boolean(config.adminUsername && config.adminPassword);
  const weakSessionSecret = !config.sessionSecret || config.sessionSecret.length < 24;

  if (!config.dryRun) {
    if (!config.pageId) errors.push("FB_DRY_RUN=false requires FB_PAGE_ID.");
    if (config.pageId && !/^\d+$/.test(config.pageId)) errors.push("FB_PAGE_ID must be numeric.");
    if (!config.pageAccessToken) errors.push("FB_DRY_RUN=false requires FB_PAGE_ACCESS_TOKEN.");
  }

  if (!adminConfigured) {
    warnings.push("ADMIN_USERNAME/ADMIN_PASSWORD are not set. Local development requests are allowed only from localhost.");
  }

  if (weakSessionSecret) {
    const message = "SESSION_SECRET is empty or shorter than 24 characters.";
    if (config.nodeEnv === "production") errors.push(message);
    else warnings.push(message);
  }

  return { errors, warnings, adminConfigured, weakSessionSecret };
}
