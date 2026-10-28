/* MOREATIVE STUDIO — /studio
   App writes nothing until you press Publish. Publish commits data/*.json
   to GitHub through /api/publish, Vercel redeploys automatically. */
(function () {
  'use strict';

  var S = null;
  var ED = null;
  var BASE_S = null;
  var BASE_ED = null;
  var pending = {};          // path -> { b64, src }
  var STATUS = { passwordSet: false, tokenSet: false, repo: '' };
  var CATS = ['Logo', 'Branding Identity', 'Packaging', '3D Modeling', 'Prints', 'Production'];
  var SEC_LABELS = {
    hero: 'Hero', work: 'The work', studio: 'Studio', 'studio-desc': 'Studio description',
    grid: 'Portfolio grid', outro: 'Outro', contact: 'Contact', footer: 'Footer'
  };
  var LABELS = {
    'site.brand': 'Brand name',
    'site.email': 'Email',
    'hero.kicker': 'Hero — kicker',
    'hero.lines': 'Hero — rotating words (one per line)',
    'hero.cta': 'Hero — button text',
    'story_head.kicker': 'The work — kicker',
    'story_head.title': 'The work — headline',
    'studio.kicker': 'Studio — kicker',
    'studio.title': 'Studio — title',
    'studio.text': 'Studio — paragraph 1',
    'studio.text2': 'Studio — paragraph 2 (straight to the point)',
    'studio.line': 'Studio — services line',
    'studio.tags': 'Studio — tags (one per line)',
    'giant.text': 'Giant word',
    'giant.sub': 'Giant — line 1',
    'giant.sub2': 'Giant — line 2'
  };

  // ---------------------------------------------------------------- utils
  function $(sel, root) { return (root || document).querySelector(sel); }
  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function json2(o) { return JSON.stringify(o, null, 2) + '\n'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'on' + (isErr ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = ''; }, 3800);
  }
  function api(path, opts) {
    var o = Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opts || {});
    return fetch(path, o).then(function (r) {
      return r.json().catch(function () { return { ok: false, msg: 'Server error (' + r.status + ')' }; })
        .then(function (j) { j._status = r.status; return j; });
    });
  }

  // ---------------------------------------------------------------- gate
  function showGate(reason) {
    var gate = $('#gate');
    var app = $('#app');
    gate.hidden = false;
    app.hidden = true;
    var err = $('#gateErr');
    var btn = $('#loginBtn');
    if (reason === 'no-password') {
      err.innerHTML = '';
      $('.setup', gate).hidden = false;
      btn.disabled = true;
      $('#gateHint').textContent = 'Set STUDIO_PASSWORD in Vercel to enable this page.';
      return;
    }
    if (reason === 'offline') {
      err.textContent = 'Cannot reach the server. Check your connection.';
      return;
    }
    btn.disabled = false;
    setTimeout(function () { $('#pw').focus(); }, 50);
  }

  function login() {
    var pw = $('#pw').value;
    if (!pw) return;
    var btn = $('#loginBtn');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    api('/api/login', { method: 'POST', body: JSON.stringify({ password: pw }) }).then(function (j) {
      btn.disabled = false;
      btn.textContent = 'Sign in';
      if (j.ok) { $('#gateErr').textContent = ''; loadAll(); return; }
      if (j.code === 'no-password') { showGate('no-password'); return; }
      $('#gateErr').textContent = 'Wrong password.';
      $('#pw').value = '';
      $('#pw').focus();
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'Sign in';
      $('#gateErr').textContent = 'Connection error. Try again.';
    });
  }

  // ---------------------------------------------------------------- data
  function loadAll() {
    Promise.all([
      fetch('/data/site.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }),
      fetch('/data/editor.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); })
    ]).then(function (res) {
      S = res[0];
      ED = res[1] || {};
      if (!ED.order) ED.order = [];
      if (!ED.hidden) ED.hidden = {};
      if (!ED.settings) ED.settings = {};
      if (!Array.isArray(S.projects)) S.projects = [];
      if (!Array.isArray(S.cinematic)) S.cinematic = [];
      BASE_S = clone(S);
      BASE_ED = clone(ED);
      pending = {};
      return api('/api/session').then(function (j) { if (j) STATUS = j; });
    }).then(function () {
      $('#gate').hidden = true;
      $('#app').hidden = false;
      renderAll();
      setTab('projects');
      BASE_S = clone(S);
      BASE_ED = clone(ED);
      paintState();
    }).catch(function (e) {
      $('#gate').hidden = false;
      $('#app').hidden = true;
      $('#gateErr').textContent = 'Could not load site data (' + (e && e.message ? e.message : 'network') + '). Reload the page.';
      toast('Could not load site data: ' + (e && e.message ? e.message : 'network'), true);
    });
  }

  function dirty() {
    return json2(S) !== json2(BASE_S) || json2(ED) !== json2(BASE_ED) || Object.keys(pending).length > 0;
  }
  function paintState() {
    var st = $('#state');
    st.className = 'state' + (dirty() ? ' dirty' : '');
    st.innerHTML = '';
    st.appendChild(node('i'));
    st.appendChild(node('span', null, dirty() ? 'Unpublished changes' : 'Live'));
    $('#publishTop').disabled = !dirty();
  }

  function renderAll() {
    renderProjects();
    renderContent();
    renderSections();
    renderPublish();
    paintState();
  }

  // ---------------------------------------------------------------- tabs
  function setTab(name) {
    var tabs = document.querySelectorAll('nav.tabs button');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === name);
    var panels = document.querySelectorAll('.tab');
    for (var j = 0; j < panels.length; j++) panels[j].classList.toggle('on', panels[j].id === 'tab-' + name);
    if (name === 'publish') renderPublish();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ---------------------------------------------------------------- projects
  function renderProjects() {
    var host = $('#tab-projects');
    clear(host);

    var head = node('div', 'row');
    head.style.marginBottom = '1rem';
    var info = node('div', 'hint', S.projects.length + ' projects · the first five feed the cinematic stack on the home page');
    info.style.flex = '1';
    var add = node('button', 'btn primary', '+ New project');
    add.onclick = function () { openProject(-1); };
    head.appendChild(info);
    head.appendChild(add);
    host.appendChild(head);

    var grid = node('div', 'pgrid');
    S.projects.forEach(function (p, i) {
      var card = node('div', 'pcard');
      var thumb = node('div', 'thumb');
      var img = node('img');
      img.src = imgSrc(p.image) || '';
      img.alt = p.name || '';
      img.loading = 'lazy';
      thumb.appendChild(img);
      var badge = node('span', 'badge' + (p.status === 'draft' ? ' draft' : ''), (p.status === 'draft' ? 'DRAFT' : 'LIVE'));
      thumb.appendChild(badge);
      card.appendChild(thumb);

      var meta = node('div', 'meta');
      meta.appendChild(node('b', null, p.name || p.id || 'Untitled'));
      meta.appendChild(node('small', null, (p.cat || '—') + ' · ' + (p.year || '')));
      card.appendChild(meta);

      var acts = node('div', 'acts');
      var ed = node('button', 'btn tiny', 'Edit');
      ed.onclick = function () { openProject(i); };
      var up = node('button', 'btn tiny', '↑');
      up.title = 'Move up';
      up.onclick = function () { moveProject(i, -1); };
      var dn = node('button', 'btn tiny', '↓');
      dn.title = 'Move down';
      dn.onclick = function () { moveProject(i, 1); };
      acts.appendChild(ed);
      acts.appendChild(up);
      acts.appendChild(dn);
      card.appendChild(acts);

      grid.appendChild(card);
    });

    var ghost = node('button', 'ghostcard', '+ Add project');
    ghost.onclick = function () { openProject(-1); };
    grid.appendChild(ghost);
    host.appendChild(grid);
  }

  function moveProject(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= S.projects.length) return;
    var t = S.projects[i];
    S.projects[i] = S.projects[j];
    S.projects[j] = t;
    renderProjects();
    paintState();
  }

  function imgSrc(path) {
    if (!path) return '';
    if (pending[path]) return pending[path].src;
    if (path.charAt(0) === '/' || /^https?:/.test(path)) return path;
    return '/' + path.replace(/^\.?\//, '');
  }

  var MAX_EDGE = 2600;
  var MAX_BYTES = 3.2 * 1024 * 1024;

  function pickImage(cb) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(inp);
    function cleanup() { if (inp.parentNode) inp.parentNode.removeChild(inp); }
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      cleanup();
      if (!f) return;
      if (f.size > 24 * 1024 * 1024) { toast('That image is over 24 MB.', true); return; }
      var fr = new FileReader();
      fr.onload = function () { shrink(String(fr.result), f.name, cb); };
      fr.readAsDataURL(f);
    };
    inp.click();
  }

  function shrink(dataUrl, filename, cb) {
    var ext = (filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
    var base = (filename.replace(/\.[^.]+$/, '') || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'image';

    function done(finalUrl, outExt) {
      var b64 = finalUrl.split(',')[1] || '';
      if (!b64) { toast('Could not read that image.', true); return; }
      if (b64.length * 0.75 > MAX_BYTES) {
        toast('That image is still too large (max 3 MB). Resize it and try again.', true);
        return;
      }
      var path = 'assets/uploads/' + Date.now() + '-' + base + '.' + outExt;
      pending[path] = { b64: b64, src: finalUrl };
      cb(path);
    }

    if (ext === 'svg' || ext === 'gif') { done(dataUrl, ext); return; }

    var img = new Image();
    img.onerror = function () { done(dataUrl, ext); };
    img.onload = function () {
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
      var big = dataUrl.length * 0.75 > 900 * 1024;
      if (scale === 1 && !big) { done(dataUrl, ext); return; }

      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));

      function render(type) {
        var cv = document.createElement('canvas');
        cv.width = cw;
        cv.height = ch;
        var ctx = cv.getContext('2d');
        if (type === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cw, ch);
        }
        if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, cw, ch);
        return cv.toDataURL(type, 0.88);
      }

      if (ext === 'png') {
        var png = render('image/png');
        if (png.length * 0.75 > MAX_BYTES) done(render('image/jpeg'), 'jpg');
        else done(png, 'png');
      } else {
        done(render('image/jpeg'), 'jpg');
      }
    };
    img.src = dataUrl;
  }

  // ---------------------------------------------------------------- project sheet
  var sheetIndex = -1;

  function openProject(i) {
    sheetIndex = i;
    var p = i < 0
      ? { id: '', name: '', cat: CATS[0], year: String(new Date().getFullYear()), client: '', role: '', desc: '', image: '', gallery: [], services: [], keywords: [], links: [], status: 'published' }
      : clone(S.projects[i]);
    if (!Array.isArray(p.gallery)) p.gallery = [];
    if (!Array.isArray(p.services)) p.services = [];
    if (!Array.isArray(p.keywords)) p.keywords = [];
    if (!Array.isArray(p.links)) p.links = [];

    var box = $('#sheetBox');
    clear(box);

    var head = node('div', 'sheethead');
    head.appendChild(node('h3', null, i < 0 ? 'New project' : 'Edit project'));
    var close = node('button', 'btn tiny', 'Close');
    close.onclick = closeSheet;
    head.appendChild(close);
    box.appendChild(head);

    function field(label, input, sub) {
      var w = node('div', 'field');
      var l = node('label', null, label);
      w.appendChild(l);
      w.appendChild(input);
      if (sub) w.appendChild(node('div', 'sub', sub));
      return w;
    }
    function textInput(value, oninput) {
      var inp = node('input');
      inp.type = 'text';
      inp.value = value || '';
      inp.oninput = function () { oninput(inp.value); };
      return inp;
    }
    function area(value, oninput, rows) {
      var t = node('textarea');
      t.value = value || '';
      if (rows) t.rows = rows;
      t.oninput = function () { oninput(t.value); };
      return t;
    }
    function lines(arr) { return (arr || []).join('\n'); }
    function fromLines(v) { return String(v).split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }

    var g2 = node('div', 'grid2');
    g2.appendChild(field('Project name', textInput(p.name, function (v) { p.name = v; })));
    g2.appendChild(field('URL slug', textInput(p.id, function (v) { p.id = slug(v); }), 'used in /portfolio/category/slug'));
    box.appendChild(g2);

    var g3 = node('div', 'grid2');
    var catSel = node('select');
    CATS.forEach(function (c) {
      var o = node('option', null, c);
      o.value = c;
      if (p.cat === c) o.selected = true;
      catSel.appendChild(o);
    });
    if (p.cat && CATS.indexOf(p.cat) < 0) {
      var oc = node('option', null, p.cat);
      oc.value = p.cat;
      oc.selected = true;
      catSel.appendChild(oc);
    }
    catSel.onchange = function () { p.cat = catSel.value; };
    g3.appendChild(field('Category', catSel));
    g3.appendChild(field('Year', textInput(p.year, function (v) { p.year = v; })));
    box.appendChild(g3);

    var g4 = node('div', 'grid2');
    g4.appendChild(field('Client', textInput(p.client, function (v) { p.client = v; })));
    g4.appendChild(field('Role', textInput(p.role, function (v) { p.role = v; })));
    box.appendChild(g4);

    var stat = node('select');
    [['published', 'Published (live)'], ['draft', 'Draft (hidden)']].forEach(function (o) {
      var op = node('option', null, o[1]);
      op.value = o[0];
      if ((p.status || 'published') === o[0]) op.selected = true;
      stat.appendChild(op);
    });
    stat.onchange = function () { p.status = stat.value; };
    box.appendChild(field('Status', stat));

    box.appendChild(field('Description', area(p.desc, function (v) { p.desc = v; }, 4)));

    // cover
    var coverWrap = node('div', 'media');
    var prev = node('div', 'prev');
    var pimg = node('img');
    pimg.src = imgSrc(p.image) || '';
    prev.appendChild(pimg);
    coverWrap.appendChild(prev);
    var ctr = node('div', 'controls');
    var pickBtn = node('button', 'btn tiny', 'Upload cover');
    pickBtn.onclick = function () {
      pickImage(function (path) {
        p.image = path;
        pimg.src = imgSrc(path);
        if (!p.gallery.length) { p.gallery.push(path); paintGal(); }
        paintState();
      });
    };
    var clr = node('button', 'btn tiny', 'Clear');
    clr.onclick = function () { p.image = ''; pimg.removeAttribute('src'); paintState(); };
    var ctrRow = node('div', 'row');
    ctrRow.appendChild(pickBtn);
    ctrRow.appendChild(clr);
    ctr.appendChild(ctrRow);
    ctr.appendChild(node('div', 'sub', 'Shown on the portfolio grid and in the cinematic cards.'));
    coverWrap.appendChild(ctr);
    var coverField = node('div', 'field');
    coverField.appendChild(node('label', null, 'Cover image'));
    coverField.appendChild(coverWrap);
    box.appendChild(coverField);

    // gallery
    var galField = node('div', 'field');
    galField.appendChild(node('label', null, 'Gallery'));
    var galHost = node('div', 'gal');
    function paintGal() {
      clear(galHost);
      p.gallery.forEach(function (src, gi) {
        var it = node('div', 'item');
        var im = node('img');
        im.src = imgSrc(src);
        im.loading = 'lazy';
        it.appendChild(im);
        var x = node('button', 'x', '×');
        x.title = 'Remove';
        x.onclick = function () { p.gallery.splice(gi, 1); paintGal(); paintState(); };
        it.appendChild(x);
        var mv = node('div', 'mv');
        var l = node('button', null, '←');
        l.onclick = function () { if (gi > 0) { var t = p.gallery[gi - 1]; p.gallery[gi - 1] = p.gallery[gi]; p.gallery[gi] = t; paintGal(); paintState(); } };
        var r = node('button', null, '→');
        r.onclick = function () { if (gi < p.gallery.length - 1) { var t2 = p.gallery[gi + 1]; p.gallery[gi + 1] = p.gallery[gi]; p.gallery[gi] = t2; paintGal(); paintState(); } };
        mv.appendChild(l);
        mv.appendChild(r);
        it.appendChild(mv);
        galHost.appendChild(it);
      });
      var addGal = node('button', 'ghostcard', '+ Image');
      addGal.style.minHeight = '0';
      addGal.style.aspectRatio = '4/3';
      addGal.style.fontSize = '.7rem';
      addGal.onclick = function () {
        pickImage(function (path) { p.gallery.push(path); paintGal(); paintState(); });
      };
      galHost.appendChild(addGal);
    }
    paintGal();
    galField.appendChild(galHost);
    box.appendChild(galField);

    var g5 = node('div', 'grid2');
    g5.appendChild(field('Services (one per line)', area(lines(p.services), function (v) { p.services = fromLines(v); }, 4)));
    g5.appendChild(field('Keywords (one per line)', area(lines(p.keywords), function (v) { p.keywords = fromLines(v); }, 4)));
    box.appendChild(g5);

    box.appendChild(field('Links (label | url, one per line)', area((p.links || []).map(function (l) { return (l.label || '') + ' | ' + (l.url || ''); }).join('\n'), function (v) {
      p.links = String(v).split('\n').map(function (row) {
        var parts = row.split('|');
        if (parts.length < 2) return null;
        return { label: parts[0].trim(), url: parts.slice(1).join('|').trim() };
      }).filter(function (x) { return x && x.url; });
    }, 3)));

    var foot = node('div', 'sheetfoot');
    if (i >= 0) {
      var del = node('button', 'btn danger', 'Delete project');
      del.onclick = function () {
        if (!confirm('Delete "' + (p.name || p.id) + '"?')) return;
        var goneId = p.id;
        S.projects.splice(i, 1);
        (S.cinematic || []).forEach(function (slot) {
          if (slot && slot.project === goneId) slot.project = '';
        });
        closeSheet();
        renderProjects();
        renderContent();
        renderPublish();
        paintState();
      };
      foot.appendChild(del);
    }
    var cancel = node('button', 'btn', 'Cancel');
    cancel.onclick = closeSheet;
    var save = node('button', 'btn primary', i < 0 ? 'Add project' : 'Save project');
    save.onclick = function () {
      if (!p.name.trim()) { toast('Project needs a name.', true); return; }
      if (!p.id) p.id = slug(p.name);
      var clash = S.projects.some(function (x, k) { return x.id === p.id && k !== i; });
      if (clash) { toast('Another project already uses the slug "' + p.id + '".', true); return; }
      var before = i >= 0 && S.projects[i] ? S.projects[i].id : '';
      if (i < 0) S.projects.push(p); else S.projects[i] = p;
      if (before && before !== p.id) {
        (S.cinematic || []).forEach(function (slot) {
          if (slot && slot.project === before) slot.project = p.id;
        });
      }
      closeSheet();
      renderProjects();
      renderContent();
      renderPublish();
      paintState();
      toast(i < 0 ? 'Project added. Publish to make it live.' : 'Project updated.');
    };
    foot.appendChild(cancel);
    foot.appendChild(save);
    box.appendChild(foot);

    $('#sheet').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    $('#sheet').classList.remove('open');
    document.body.style.overflow = '';
    sheetIndex = -1;
  }

  // ---------------------------------------------------------------- generic fields
  function fieldLabel(path) {
    if (LABELS[path]) return LABELS[path];
    var parts = path.split('.');
    var key = parts.pop();
    var pretty = key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  }

  function setPath(obj, path, value) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function isLongString(path, v) {
    return String(v).length > 90 || /\.(text|text2|desc|sub|sub2|title|line)$/.test('.' + path.split('.').slice(-1)[0]);
  }

  function buildField(obj, path, host) {
    var value = path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
    if (Array.isArray(value)) {
      var allStr = value.every(function (x) { return typeof x === 'string'; });
      if (!allStr) return;
      var ta = node('textarea');
      ta.value = value.join('\n');
      ta.rows = Math.max(2, Math.min(8, value.length));
      ta.oninput = function () {
        setPath(obj, path, String(ta.value).split('\n').map(function (x) { return x.trim(); }).filter(Boolean));
        paintState();
        renderPublish();
      };
      var w = node('div', 'field');
      w.appendChild(node('label', null, fieldLabel(path)));
      w.appendChild(ta);
      host.appendChild(w);
      return;
    }
    if (value !== null && typeof value === 'object') {
      var fs = node('fieldset', 'fieldset');
      fs.appendChild(node('legend', null, fieldLabel(path)));
      Object.keys(value).forEach(function (k) { buildField(obj, path + '.' + k, fs); });
      host.appendChild(fs);
      return;
    }
    var wrap = node('div', 'field');
    wrap.appendChild(node('label', null, fieldLabel(path)));
    var input;
    if (typeof value === 'number') {
      input = node('input');
      input.type = 'number';
      input.value = value;
      input.oninput = function () { setPath(obj, path, Number(input.value)); paintState(); renderPublish(); };
    } else if (typeof value === 'boolean') {
      input = node('div', 'switch' + (value ? ' on' : ''));
      input.onclick = function () {
        var nv = !input.classList.contains('on');
        input.classList.toggle('on', nv);
        setPath(obj, path, nv);
        paintState();
        renderPublish();
      };
    } else {
      input = isLongString(path, value) ? node('textarea') : node('input');
      if (input.tagName === 'INPUT') input.type = 'text';
      input.value = value == null ? '' : value;
      if (input.tagName === 'TEXTAREA') input.rows = 3;
      input.oninput = function () { setPath(obj, path, input.value); paintState(); renderPublish(); };
    }
    wrap.appendChild(input);
    host.appendChild(wrap);
  }

  function renderContent() {
    var host = $('#tab-content');
    clear(host);

    function panel(title, obj, keys, note) {
      var p = node('div', 'panel');
      p.appendChild(node('h2', null, title));
      if (note) p.appendChild(node('div', 'hint', note));
      keys.forEach(function (k) { buildField(obj, k, p); });
      host.appendChild(p);
    }

    panel('Site', S, ['site.brand', 'site.email']);
    panel('Hero', S, ['hero.kicker', 'hero.lines', 'hero.cta']);
    panel('The work', S, ['story_head.kicker', 'story_head.title']);
    panel('Studio', S, ['studio.kicker', 'studio.title', 'studio.text', 'studio.text2', 'studio.line', 'studio.tags']);
    panel('Giant', S, ['giant.text', 'giant.sub', 'giant.sub2']);

    // cinematic stack
    var cp = node('div', 'panel');
    cp.appendChild(node('h2', null, 'Cinematic stack (home page)'));
    cp.appendChild(node('div', 'hint', 'Five pinned cards. Pick the project and, optionally, a different cover.'));
    for (var i = 0; i < 5; i++) {
      (function (idx) {
        if (!S.cinematic[idx]) S.cinematic[idx] = { project: '', cover: '' };
        var slot = S.cinematic[idx];
        var row = node('div', 'media');
        row.style.marginBottom = '.8rem';
        row.style.alignItems = 'center';

        var num = node('div', null, String(idx + 1));
        num.style.cssText = 'width:26px;height:26px;border-radius:50%;background:#f5f5f5;color:#000;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none;font-size:.72rem';
        row.appendChild(num);

        var sel = node('select');
        sel.style.flex = '1';
        var empty = node('option', null, '— empty slot —');
        empty.value = '';
        sel.appendChild(empty);
        S.projects.forEach(function (p) {
          var o = node('option', null, p.name + ' · ' + (p.cat || ''));
          o.value = p.id;
          if (slot.project === p.id) o.selected = true;
          sel.appendChild(o);
        });
        sel.onchange = function () { slot.project = sel.value; paintState(); renderPublish(); };
        row.appendChild(sel);

        var prev = node('div', 'prev');
        prev.style.width = '84px';
        prev.style.height = '52px';
        var im = node('img');
        im.src = imgSrc(slot.cover);
        prev.appendChild(im);
        row.appendChild(prev);

        var up = node('button', 'btn tiny', 'Cover');
        up.onclick = function () {
          pickImage(function (path) { slot.cover = path; im.src = imgSrc(path); paintState(); renderPublish(); });
        };
        row.appendChild(up);
        var cl = node('button', 'btn tiny', '×');
        cl.title = 'Clear cover';
        cl.onclick = function () { slot.cover = ''; im.removeAttribute('src'); paintState(); renderPublish(); };
        row.appendChild(cl);

        cp.appendChild(row);
      })(i);
    }
    host.appendChild(cp);

    // editor settings
    var sp = node('div', 'panel');
    sp.appendChild(node('h2', null, 'Site settings'));
    sp.appendChild(node('div', 'hint', 'Contact links, social accounts and link previews.'));
    [
      ['instagram', 'Instagram URL', 'https://instagram.com/moreatives'],
      ['whatsapp', 'WhatsApp number', '201013162533'],
      ['title', 'Browser title', 'Moreative'],
      ['desc', 'SEO description', ''],
      ['og', 'Social preview image', 'assets/...'],
      ['favicon', 'Favicon', 'assets/...'],
      ['logo', 'Logo override', 'assets/...']
    ].forEach(function (row) {
      var cur = ED.settings[row[0]] == null ? '' : ED.settings[row[0]];
      var w = node('div', 'field');
      w.appendChild(node('label', null, row[1]));
      var inp = node('input');
      inp.type = 'text';
      inp.placeholder = row[2] || '';
      inp.value = cur;
      inp.oninput = function () { ED.settings[row[0]] = inp.value.trim(); paintState(); renderPublish(); };
      w.appendChild(inp);
      sp.appendChild(w);
    });
    host.appendChild(sp);
  }

  // ---------------------------------------------------------------- sections
  function renderSections() {
    var host = $('#tab-sections');
    clear(host);
    var p = node('div', 'panel');
    p.appendChild(node('h2', null, 'Sections'));
    p.appendChild(node('div', 'hint', 'Order and visibility of the home page sections.'));
    var list = node('div', 'seclist');
    list.style.marginTop = '.9rem';

    ED.order.forEach(function (id, i) {
      var row = node('div', 'secrow' + (ED.hidden[id] ? ' off' : ''));
      var num = node('span', null, String(i + 1).padStart(2, '0'));
      num.style.cssText = 'color:rgba(255,255,255,.3);font-size:.68rem;letter-spacing:.1em;width:20px';
      row.appendChild(num);
      var name = node('div', 'name', SEC_LABELS[id] || id);
      name.appendChild(node('small', null, id));
      row.appendChild(name);

      var sw = node('div', 'switch' + (ED.hidden[id] ? '' : ' on'));
      sw.title = 'Visible';
      sw.onclick = function () {
        if (ED.hidden[id]) delete ED.hidden[id]; else ED.hidden[id] = true;
        renderSections();
        paintState();
        renderPublish();
      };
      row.appendChild(sw);

      var up = node('button', 'btn tiny', '↑');
      up.onclick = function () {
        if (i === 0) return;
        var t = ED.order[i - 1];
        ED.order[i - 1] = ED.order[i];
        ED.order[i] = t;
        renderSections();
        paintState();
        renderPublish();
      };
      var dn = node('button', 'btn tiny', '↓');
      dn.onclick = function () {
        if (i === ED.order.length - 1) return;
        var t = ED.order[i + 1];
        ED.order[i + 1] = ED.order[i];
        ED.order[i] = t;
        renderSections();
        paintState();
        renderPublish();
      };
      row.appendChild(up);
      row.appendChild(dn);
      list.appendChild(row);
    });
    p.appendChild(list);
    host.appendChild(p);
  }

  // ---------------------------------------------------------------- publish
  function changes() {
    var out = [];
    if (json2(S) !== json2(BASE_S)) out.push({ path: 'data/site.json', label: 'Site content' });
    if (json2(ED) !== json2(BASE_ED)) out.push({ path: 'data/editor.json', label: 'Sections & settings' });
    Object.keys(pending).forEach(function (p) {
      out.push({ path: p, label: 'New image', upload: true });
    });
    return out;
  }

  function summary() {
    var lines = [];
    var bp = (BASE_S && BASE_S.projects) || [];
    var np = S.projects || [];
    var bIds = bp.map(function (p) { return p.id; });
    var nIds = np.map(function (p) { return p.id; });
    var added = nIds.filter(function (id) { return bIds.indexOf(id) < 0; });
    var removed = bIds.filter(function (id) { return nIds.indexOf(id) < 0; });
    var edited = np.filter(function (p) {
      var b = bp.filter(function (x) { return x.id === p.id; })[0];
      return b && JSON.stringify(b) !== JSON.stringify(p);
    });
    if (added.length) lines.push('+' + added.length + ' project' + (added.length > 1 ? 's' : ''));
    if (removed.length) lines.push('−' + removed.length + ' project' + (removed.length > 1 ? 's' : ''));
    if (edited.length) lines.push(edited.length + ' project' + (edited.length > 1 ? 's' : '') + ' edited');
    var reordered = bIds.filter(function (id) { return nIds.indexOf(id) > -1; }).join() !== nIds.filter(function (id) { return bIds.indexOf(id) > -1; }).join();
    if (reordered) lines.push('project order');
    ['site', 'hero', 'story_head', 'studio', 'giant', 'cinematic'].forEach(function (k) {
      if (JSON.stringify((BASE_S || {})[k]) !== JSON.stringify(S[k])) lines.push(k.replace('_', ' ') + ' content');
    });
    if (json2(ED) !== json2(BASE_ED)) lines.push('sections / settings');
    Object.keys(pending).forEach(function (p) { lines.push('image ' + p.split('/').pop()); });
    return lines;
  }

  function renderPublish() {
    if (!S) return;
    var host = $('#tab-publish');
    clear(host);

    // status
    var st = node('div', 'panel');
    st.appendChild(node('h2', null, 'Connection'));
    var kv = node('div');
    function line(k, v, cls) {
      var r = node('div', 'kv');
      r.appendChild(node('span', null, k));
      var val = node('span');
      val.appendChild(node('i', 'dot ' + (cls || '')));
      val.appendChild(node('span', null, v));
      r.appendChild(val);
      kv.appendChild(r);
    }
    line('Password', STATUS.passwordSet ? 'configured' : 'missing', STATUS.passwordSet ? 'ok' : 'bad');
    line('GitHub token', STATUS.tokenSet ? 'configured' : 'not set', STATUS.tokenSet ? 'ok' : 'bad');
    line('Repository', STATUS.repo || '—');
    st.appendChild(kv);

    var check = node('button', 'btn tiny', 'Check repository access');
    check.style.marginTop = '.8rem';
    check.onclick = function () {
      check.disabled = true;
      check.textContent = 'Checking…';
      api('/api/session?repo=1').then(function (j) {
        check.disabled = false;
        check.textContent = 'Check repository access';
        var r = j.repoStatus || {};
        if (r.ok) toast('Access OK · ' + r.repo + ' · ' + (r.permissions && r.permissions.push ? 'write allowed' : 'read only'));
        else toast('Access failed: ' + (r.message || r.code || 'unknown'), true);
      }).catch(function () { check.disabled = false; check.textContent = 'Check repository access'; toast('Check failed.', true); });
    };
    st.appendChild(check);

    if (!STATUS.tokenSet || !STATUS.passwordSet) {
      var help = node('div', 'help');
      help.innerHTML =
        '<div style="margin-top:1rem;border-top:1px solid rgba(255,255,255,.12);padding-top:.9rem">' +
        '<b>مطلوب إعداد لمرة واحدة في Vercel</b><br>' +
        'اذهب إلى المشروع في Vercel ← Settings ← Environment Variables وأضف:<br>' +
        '<code>STUDIO_PASSWORD</code> كلمة مرور قوية للوحة.<br>' +
        '<code>GITHUB_TOKEN</code> توكن من GitHub (Fine-grained) بصلاحية <code>Contents: Read and write</code> على مستودع <code>Moreativees</code>.<br>' +
        'اختياري: <code>STUDIO_SECRET</code> نص عشوائي لتوقيع الجلسة، و<code>GITHUB_REPO</code> / <code>GITHUB_BRANCH</code> لتغيير المستودع أو الفرع.<br>' +
        'بعد الإضافة اضغط Redeploy ثم أعد تحميل هذه الصفحة.</div>';
      st.appendChild(help);
    }
    host.appendChild(st);

    // changes
    var ch = node('div', 'panel');
    ch.appendChild(node('h2', null, 'Unpublished changes'));
    var list = changes();
    if (!list.length) {
      ch.appendChild(node('div', 'hint', 'Everything is published. Edit something and it will show up here.'));
    } else {
      list.forEach(function (c) {
        var d = node('div', 'diff');
        d.appendChild(node('b', null, c.path));
        var tag = node('span', 'tag', c.upload ? 'new image' : 'modified');
        d.appendChild(tag);
        ch.appendChild(d);
      });
      var sum = summary();
      if (sum.length) {
        var s = node('div', 'hint');
        s.style.marginTop = '.6rem';
        s.textContent = sum.join(' · ');
        ch.appendChild(s);
      }

      var mw = node('div', 'field');
      mw.style.marginTop = '.9rem';
      mw.appendChild(node('label', null, 'Commit message'));
      var msg = node('input');
      msg.type = 'text';
      msg.id = 'commitMsg';
      msg.placeholder = 'Studio: update content';
      mw.appendChild(msg);
      ch.appendChild(mw);

      var acts = node('div', 'row');
      acts.style.marginTop = '.6rem';
      var pub = node('button', 'btn primary', 'Publish now');
      pub.id = 'publishNow';
      pub.onclick = publish;
      var disc = node('button', 'btn danger', 'Discard changes');
      disc.onclick = function () {
        if (!confirm('Discard every unpublished change?')) return;
        loadAll();
        toast('Changes discarded.');
      };
      acts.appendChild(pub);
      acts.appendChild(disc);
      ch.appendChild(acts);
      ch.appendChild(node('div', 'hint', 'Publishing commits to GitHub, then Vercel redeploys the live site in about a minute.'));
    }
    host.appendChild(ch);

    // result
    var res = node('div', 'panel');
    res.id = 'pubResult';
    res.hidden = true;
    host.appendChild(res);
  }

  function publish() {
    var files = [];
    if (json2(S) !== json2(BASE_S)) files.push({ path: 'data/site.json', text: json2(S) });
    if (json2(ED) !== json2(BASE_ED)) files.push({ path: 'data/editor.json', text: json2(ED) });
    Object.keys(pending).forEach(function (p) {
      files.push({ path: p, base64: pending[p].b64 });
    });
    if (!files.length) { toast('Nothing to publish.'); return; }

    var msgInput = $('#commitMsg');
    var message = (msgInput && msgInput.value.trim()) || 'Studio: update content';
    var btn = $('#publishNow');
    if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
    $('#publishTop').disabled = true;

    api('/api/publish', { method: 'POST', body: JSON.stringify({ files: files, message: message }) }).then(function (j) {
      if (btn) { btn.disabled = false; btn.textContent = 'Publish now'; }
      if (!j.ok) {
        paintState();
        var code = j.code || 'error';
        var msg = j.msg || 'Publish failed.';
        if (code === 'auth') { toast('Session expired — sign in again.', true); location.reload(); return; }
        if (code === 'no-token') toast('No GitHub token set in Vercel — see Connection above.', true);
        else toast(msg, true);
        return;
      }
      // success
      pending = {};
      BASE_S = clone(S);
      BASE_ED = clone(ED);
      renderProjects();
      renderPublish();
      paintState();

      var host = $('#pubResult');
      if (host) {
        host.hidden = false;
        clear(host);
        host.appendChild(node('h2', null, 'Published'));
        var ok = node('div', 'hint');
        ok.innerHTML = 'Commit <b>' + j.commit.short + '</b> pushed to GitHub · ' + j.commit.files +
          ' file' + (j.commit.files > 1 ? 's' : '') + ' · Vercel is redeploying now.';
        host.appendChild(ok);
        var a = node('a', 'btn tiny', 'Open commit on GitHub ↗');
        a.href = j.commit.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.marginTop = '.6rem';
        a.style.display = 'inline-block';
        host.appendChild(a);
        host.scrollIntoView({ block: 'nearest' });
      }
      toast('Published. The live site updates in about a minute.');
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Publish now'; }
      paintState();
      toast('Network error while publishing.', true);
    });
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    document.querySelectorAll('nav.tabs button').forEach(function (b) {
      b.onclick = function () { setTab(b.getAttribute('data-tab')); };
    });
    $('#loginBtn').onclick = login;
    $('#pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
    $('#outBtn').onclick = function () { api('/api/logout', { method: 'POST' }).then(function () { location.reload(); }); };
    $('#publishTop').onclick = function () { setTab('publish'); };
    $('#previewBtn').onclick = function () { window.open('/', '_blank', 'noopener'); };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('#sheet').classList.contains('open')) closeSheet();
    });
    $('#sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') closeSheet(); });
    window.addEventListener('beforeunload', function (e) {
      if (S && dirty()) { e.preventDefault(); e.returnValue = ''; }
    });

    api('/api/session').then(function (j) {
      STATUS = j || {};
      if (!j.passwordSet) { showGate('no-password'); return; }
      if (j.authed) loadAll(); else showGate();
    }).catch(function () { showGate('offline'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
