import { clearCookie, noStore } from '../lib/auth.js';

export default async function handler(req, res) {
  noStore(res);
  res.setHeader('Set-Cookie', clearCookie(req.headers.host));
  res.status(200).json({ ok: true });
}
