import { requireSession, hasPassword, noStore } from '../lib/auth.js';
import { repoStatus, repoLabel, tokenReady } from '../lib/github.js';

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, msg: 'method' });
    return;
  }
  const session = requireSession(req);
  const base = {
    passwordSet: hasPassword(),
    tokenSet: tokenReady(),
    repo: repoLabel(),
  };
  if (!session) {
    res.status(200).json(Object.assign({ ok: false, authed: false }, base));
    return;
  }
  let repo = null;
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.searchParams.get('repo') === '1') repo = await repoStatus();
  res.status(200).json(Object.assign({ ok: true, authed: true, repoStatus: repo }, base));
}
