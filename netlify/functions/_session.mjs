// Cookie-based session helpers. A session is a tiny JSON payload
// {uid, exp} signed with HMAC-SHA256 using SESSION_SECRET. No JWT
// library — just base64url(payload) + "." + base64url(signature).

import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'ft_session';
const STATE_COOKIE = 'ft_oauth_state';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64url');
}
function b64urlDecode(str) {
  return Buffer.from(str, 'base64url');
}

function sign(payload, secret) {
  const data = b64urlEncode(JSON.stringify(payload));
  const sig = b64urlEncode(createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

function verify(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = createHmac('sha256', secret).update(data).digest();
  const got = b64urlDecode(sig);
  if (expected.length !== got.length) return null;
  if (!timingSafeEqual(expected, got)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(data).toString('utf8'));
    if (typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signSession(uid, secret) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  return sign({ uid, exp }, secret);
}

export function verifySession(cookieHeader, secret) {
  const token = readCookie(cookieHeader, COOKIE_NAME);
  return verify(token, secret);
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function stateCookie(state) {
  // Short-lived, used only across the OAuth redirect round-trip.
  return `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

export function clearStateCookie() {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readStateCookie(cookieHeader) {
  return readCookie(cookieHeader, STATE_COOKIE);
}

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    if (k === name) return p.slice(idx + 1).trim();
  }
  return null;
}
