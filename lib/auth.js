import crypto from 'node:crypto';

export const COOKIE_NAME = 'mst_session';
export const MAX_AGE = 60 * 60 * 8;

function secretKey() {
  return process.env.STUDIO_SECRET || process.env.STUDIO_PASSWORD || '';
}

export function hasPassword() {
  return !!process.env.STUDIO_PASSWORD;
}

export function sign(payload) {
  const key = secretKey();
  if (!key) return '';
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const mac = crypto.createHmac('sha256', key).update(body).digest('base64url');
  return body + '.' + mac;
}

export function verifyToken(token) {
  const key = secretKey();
  if (!key || !token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const body = parts[0];
  const mac = parts[1];
  const expected = crypto.createHmac('sha256', key).update(body).digest('base64url');
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data || typeof data.exp !== 'number' || Date.now() > data.exp) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function readCookie(req, name) {
  const raw = (req.headers && req.headers.cookie) || '';
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    if (p.slice(0, eq).trim() === name) return decodeURIComponent(p.slice(eq + 1).trim());
  }
  return '';
}

export function sessionCookie(token, maxAge, host) {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(String(host || ''));
  const secure = local ? '' : ' Secure;';
  return COOKIE_NAME + '=' + token + '; Path=/; HttpOnly;' + secure + ' SameSite=Strict; Max-Age=' + maxAge;
}

export function clearCookie(host) {
  return sessionCookie('', 0, host);
}

export function requireSession(req) {
  return verifyToken(readCookie(req, COOKIE_NAME));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  const len = Math.max(x.length, y.length, 1);
  const bx = Buffer.alloc(len);
  const by = Buffer.alloc(len);
  x.copy(bx);
  y.copy(by);
  return crypto.timingSafeEqual(bx, by) && x.length === y.length;
}

export function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}
