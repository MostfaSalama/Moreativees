import {
  MAX_AGE,
  hasPassword,
  noStore,
  readJson,
  safeEqual,
  sessionCookie,
  sign,
} from '../lib/auth.js';

function wait(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, msg: 'method' });
    return;
  }
  if (!hasPassword()) {
    res.status(500).json({ ok: false, code: 'no-password', msg: 'STUDIO_PASSWORD is not set in Vercel.' });
    return;
  }
  const body = await readJson(req);
  const given = String(body.password || '');
  if (!given || !safeEqual(given, process.env.STUDIO_PASSWORD)) {
    await wait(700);
    res.status(401).json({ ok: false, code: 'bad-password' });
    return;
  }
  const token = sign({ exp: Date.now() + MAX_AGE * 1000 });
  res.setHeader('Set-Cookie', sessionCookie(token, MAX_AGE, req.headers.host));
  res.status(200).json({ ok: true });
}
