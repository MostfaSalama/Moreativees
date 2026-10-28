const API = 'https://api.github.com';

function settings() {
  const token = process.env.GITHUB_TOKEN || '';
  const repo = process.env.GITHUB_REPO || 'MostfaSalama/Moreativees';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const parts = repo.split('/');
  return { token: token, repo: repo, branch: branch, owner: parts[0], name: parts[1] };
}

export function tokenReady() {
  return !!process.env.GITHUB_TOKEN;
}

export function repoLabel() {
  const s = settings();
  return s.repo + ' @ ' + s.branch;
}

async function gh(path, init) {
  const s = settings();
  if (!s.token) {
    const err = new Error('no-token');
    err.code = 'no-token';
    throw err;
  }
  const opts = init || {};
  const headers = Object.assign(
    {
      Authorization: 'Bearer ' + s.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'moreative-studio',
    },
    opts.body ? { 'Content-Type': 'application/json' } : {},
    opts.headers || {}
  );
  const res = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error((data && (data.message || data.raw)) || 'GitHub ' + res.status);
    err.code = res.status === 401 ? 'bad-token' : res.status === 404 ? 'no-access' : 'github';
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function repoStatus() {
  if (!tokenReady()) return { token: false, ok: false, code: 'no-token' };
  const s = settings();
  try {
    const data = await gh('/repos/' + s.owner + '/' + s.name);
    return {
      token: true,
      ok: true,
      repo: data.full_name,
      branch: s.branch,
      defaultBranch: data.default_branch,
      private: !!data.private,
      permissions: data.permissions || null,
    };
  } catch (e) {
    return { token: true, ok: false, code: e.code || 'github', message: e.message };
  }
}

export async function commitFiles(files, message) {
  const s = settings();
  const base = '/repos/' + s.owner + '/' + s.name;

  const ref = await gh(base + '/git/ref/heads/' + encodeURIComponent(s.branch));
  const headSha = ref.object.sha;
  const headCommit = await gh(base + '/git/commits/' + headSha);
  const baseTree = headCommit.tree.sha;

  const tree = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const blob = await gh(base + '/git/blobs', {
      method: 'POST',
      body: JSON.stringify(
        f.base64 !== undefined
          ? { content: f.base64, encoding: 'base64' }
          : { content: String(f.text == null ? '' : f.text), encoding: 'utf-8' }
      ),
    });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const newTree = await gh(base + '/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTree, tree: tree }),
  });

  const commit = await gh(base + '/git/commits', {
    method: 'POST',
    body: JSON.stringify({
      message: message,
      tree: newTree.sha,
      parents: [headSha],
    }),
  });

  await gh(base + '/git/refs/heads/' + encodeURIComponent(s.branch), {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return {
    sha: commit.sha,
    short: String(commit.sha).slice(0, 7),
    url: 'https://github.com/' + s.owner + '/' + s.name + '/commit/' + commit.sha,
    files: files.length,
  };
}

export function historyUrl() {
  const s = settings();
  return 'https://github.com/' + s.owner + '/' + s.name + '/commits/' + s.branch;
}
