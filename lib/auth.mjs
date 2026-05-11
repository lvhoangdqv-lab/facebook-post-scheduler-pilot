import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "ps_session";

export function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index === -1) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function safeCompare(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sign(token, secret) {
  return createHmac("sha256", secret || "development-session-secret").update(token).digest("base64url");
}

export function createSessionManager(config, validation) {
  const sessions = new Map();

  function isLocalRequest(req) {
    const address = req.socket.remoteAddress || "";
    return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
  }

  function getCookieValue(req) {
    return parseCookies(req.headers.cookie || "")[SESSION_COOKIE] || "";
  }

  function isAuthenticated(req) {
    if (!validation.adminConfigured) return isLocalRequest(req);
    const value = getCookieValue(req);
    const [token, signature] = value.split(".");
    if (!token || !signature || sign(token, config.sessionSecret) !== signature) return false;
    return sessions.has(token);
  }

  function createSession(res) {
    const token = randomBytes(32).toString("base64url");
    sessions.set(token, { createdAt: Date.now() });
    const maxAge = 60 * 60 * 24 * 7;
    const secure = config.appBaseUrl.startsWith("https://") ? "; Secure" : "";
    res.setHeader("set-cookie", `${SESSION_COOKIE}=${token}.${sign(token, config.sessionSecret)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`);
  }

  function clearSession(req, res) {
    const [token] = getCookieValue(req).split(".");
    if (token) sessions.delete(token);
    res.setHeader("set-cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  }

  function login(req, res, body) {
    if (!validation.adminConfigured && isLocalRequest(req)) {
      return { authenticated: true, localDevAuth: true };
    }
    if (!validation.adminConfigured) {
      return { authenticated: false, error: "Admin credentials are not configured. Only localhost is allowed in development." };
    }
    const username = String(body.username || "");
    const password = String(body.password || "");
    if (!safeCompare(username, config.adminUsername) || !safeCompare(password, config.adminPassword)) {
      return { authenticated: false, error: "Invalid username or password." };
    }
    createSession(res);
    return { authenticated: true };
  }

  return { isAuthenticated, login, clearSession, isLocalRequest };
}
