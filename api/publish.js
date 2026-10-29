import { noStore, readJson, requireSession } from '../lib/auth.js';
import { commitFiles, tokenReady } from '../lib/github.js';

const ALLOWED = ['data/', 'assets/uploads/'];
const SAFE_PATH = /^[A-Za-z0-9._\-\/]+$/;
// Vercel caps function request bodies at 4.5 MB; keep a margin.
const MAX_TOTAL = 50 * 1024 * 1024;

function badPath(p) {
  if (typeof p !== 'string' || !p) return true;
  if (p.indexOf('..') > -1) return true;
  if (!SAFE_PATH.test(p)) return true;
  return !ALLOWED.some(function (pre) {
    return p.indexOf(pre) === 0;
  });
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, msg: 'method' });
    return;
  }
  if (!requireSession(req)) {
    res.status(401).json({ ok: false, code: 'auth', msg: 'Session expired. Sign in again.' });
    return;
  }
  if (!tokenReady()) {
    res.status(400).json({ ok: false, code: 'no-token', msg: 'GITHUB_TOKEN is not set in Vercel.' });
    return;
  }

  const body = await readJson(req);
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) {
    res.status(400).json({ ok: false, code: 'empty', msg: 'Nothing to publish.' });
    return;
  }

  let total = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f || badPath(f.path)) {
      res.status(400).json({ ok: false, code: 'path', msg: 'Blocked file path: ' + (f && f.path) });
      return;
    }
    if (f.base64 !== undefined) {
      total += String(f.base64).length;
    } else {
      const text = String(f.text == null ? '' : f.text);
      total += text.length;
      if (/^data\/.+\.json$/.test(f.path)) {
        try {
          JSON.parse(text);
        } catch (e) {
          res.status(400).json({ ok: false, code: 'json', msg: 'Invalid JSON for ' + f.path });
          return;
        }
      }
    }
    if (total > MAX_TOTAL) {
      res.status(413).json({ ok: false, code: 'size', msg: 'Upload is too large (max 50 MB per publish).' });
      return;
    }
  }

  const message = String(body.message || '').trim().slice(0, 200) || 'Studio: publish content';

  try {
    const result = await commitFiles(files, message);
    res.status(200).json({ ok: true, commit: result });
  } catch (e) {
    res.status(400).json({
      ok: false,
      code: e.code || 'github',
      msg: e.message || 'Publish failed.',
    });
  }
}
