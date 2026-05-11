const encoder = new TextEncoder();
const SESSION_COOKIE = "ps_session";
const CSRF_COOKIE = "ps_csrf";

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64UrlEncode(data);
}

export function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index === -1) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function constantTimeEqual(a, b) {
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

export async function verifyPasswordHash(password, storedHash) {
  const [scheme, iterationsText, saltText, hashText] = String(storedHash || "").split("$");
  if (scheme !== "pbkdf2-sha256") return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;
  const salt = base64UrlDecode(saltText);
  const expected = base64UrlDecode(hashText);
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    expected.length * 8
  );
  return constantTimeEqual(base64UrlEncode(new Uint8Array(bits)), hashText);
}

export async function createSessionHeaders(env, requestUrl) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60 * 12;
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({
    sub: "admin",
    iat: now,
    exp: expiresAt,
    jti: randomToken(16)
  })));
  const signature = await hmac(env.SESSION_SECRET, payload);
  const csrf = randomToken(24);
  const secure = new URL(requestUrl).protocol === "https:" || env.NODE_ENV === "production" ? "; Secure" : "";
  const sameSite = env.COOKIE_SAMESITE || "Lax";
  return [
    `${SESSION_COOKIE}=${payload}.${signature}; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${60 * 60 * 12}${secure}`,
    `${CSRF_COOKIE}=${csrf}; SameSite=${sameSite}; Path=/; Max-Age=${60 * 60 * 12}${secure}`
  ];
}

export function clearSessionHeaders(env, requestUrl) {
  const secure = new URL(requestUrl).protocol === "https:" || env.NODE_ENV === "production" ? "; Secure" : "";
  const sameSite = env.COOKIE_SAMESITE || "Lax";
  return [
    `${SESSION_COOKIE}=; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=0${secure}`,
    `${CSRF_COOKIE}=; SameSite=${sameSite}; Path=/; Max-Age=0${secure}`
  ];
}

export async function getSession(request, env) {
  const cookies = parseCookies(request.headers.get("cookie") || "");
  const value = cookies[SESSION_COOKIE] || "";
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !env.SESSION_SECRET) return null;
  const expected = await hmac(env.SESSION_SECRET, payload);
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    if (data.sub !== "admin" || Number(data.exp || 0) < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function requireAdmin(request, env) {
  return Boolean(await getSession(request, env));
}

export function verifyCsrf(request) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return true;
  const cookies = parseCookies(request.headers.get("cookie") || "");
  const cookieToken = cookies[CSRF_COOKIE] || "";
  const headerToken = request.headers.get("x-csrf-token") || "";
  return Boolean(cookieToken && headerToken && constantTimeEqual(cookieToken, headerToken));
}

export function securityHeaders(env = {}) {
  const apiOrigin = env.PUBLIC_APP_ORIGIN || env.APP_BASE_URL || "'self'";
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `connect-src 'self' ${apiOrigin}`,
      "img-src 'self' data: https:",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()"
  };
}
