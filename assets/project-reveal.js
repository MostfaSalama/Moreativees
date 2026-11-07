/* MOREATIVE — soft "reveal" lens for images inside the project case view.
   Usage: ProjectReveal.attach(wrapEl, altImageUrl) / ProjectReveal.clear(wrapEl) */
(function () {
  'use strict';
  if (window.ProjectReveal && window.ProjectReveal.attach) return;

  var CSS =
    '.pr-reveal{position:relative;isolation:isolate}' +
    '.pr-layer{position:absolute;inset:0;z-index:1;opacity:0;pointer-events:none;transition:opacity .4s ease;' +
      '-webkit-mask-image:radial-gradient(circle var(--lr,160px) at var(--mx,50%) var(--my,50%),#000 0 40%,rgba(0,0,0,.94) 58%,rgba(0,0,0,.55) 78%,rgba(0,0,0,0) 100%);' +
      'mask-image:radial-gradient(circle var(--lr,160px) at var(--mx,50%) var(--my,50%),#000 0 40%,rgba(0,0,0,.94) 58%,rgba(0,0,0,.55) 78%,rgba(0,0,0,0) 100%)}' +
    '.pr-layer img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;filter:none;transform:none!important}' +
    '.pr-reveal.pr-seen .pr-layer{opacity:1}' +
    '.pr-reveal.pr-on .pr-layer{opacity:1;-webkit-mask-image:none;mask-image:none}' +
    '.pr-ring{position:absolute;left:var(--mx,50%);top:var(--my,50%);z-index:2;width:calc(var(--lr,160px) * 1.36);height:calc(var(--lr,160px) * 1.36);transform:translate(-50%,-50%);border-radius:50%;border:1px solid rgba(255,255,255,.42);box-shadow:0 0 30px rgba(0,0,0,.25) inset,0 12px 44px rgba(0,0,0,.32);opacity:0;transition:opacity .3s ease;pointer-events:none}' +
    '.pr-reveal.pr-seen .pr-ring{opacity:.6}' +
    '.pr-btn{position:absolute;right:.9rem;bottom:.85rem;z-index:3;display:inline-flex;align-items:center;gap:.36rem;padding:.5rem .74rem .48rem;border-radius:999px;border:1px solid rgba(255,255,255,.34);background:rgba(10,10,10,.34);-webkit-backdrop-filter:blur(12px) saturate(1.15);backdrop-filter:blur(12px) saturate(1.15);box-shadow:0 8px 24px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.22);color:rgba(255,255,255,.92);font-family:"Space Grotesk","Helvetica Neue",Arial,sans-serif;font-size:.52rem;font-weight:600;letter-spacing:.18em;line-height:1;text-transform:uppercase;cursor:pointer;transition:background .3s ease,color .3s ease,border-color .3s ease}' +
    '.pr-btn:hover{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.62)}' +
    '.pr-btn:focus-visible{outline:2px solid rgba(255,255,255,.85);outline-offset:3px}' +
    '.pr-btn svg{width:12px;height:12px;display:block;opacity:.9}' +
    '.pr-reveal.pr-on .pr-btn{background:#f5f5f5;color:#050505;border-color:#f5f5f5}' +
    '@media(hover:none){.pr-btn{min-height:34px;padding:.52rem .8rem .5rem}}' +
    '@media(prefers-reduced-motion:reduce){.pr-layer,.pr-ring,.pr-btn{transition:none}}';

  function ensureCss() {
    if (document.getElementById('project-reveal-css')) return;
    var st = document.createElement('style');
    st.id = 'project-reveal-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var SWAP_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="9.2" cy="12" r="5.6"></circle><circle cx="14.8" cy="12" r="5.6"></circle></svg>';

  function isOwn(el) {
    return !!(el && el.classList &&
      (el.classList.contains('pr-layer') || el.classList.contains('pr-ring') || el.classList.contains('pr-btn')));
  }

  function clear(wrap) {
    if (!wrap) return;
    wrap.classList.remove('pr-reveal', 'pr-seen', 'pr-on');
    var kids = Array.prototype.slice.call(wrap.children || []);
    kids.forEach(function (el) { if (isOwn(el)) wrap.removeChild(el); });
    wrap.style.removeProperty('--lr');
    wrap.style.removeProperty('--mx');
    wrap.style.removeProperty('--my');
  }

  function attach(wrap, altSrc) {
    if (!wrap || !altSrc) return false;
    ensureCss();
    clear(wrap);
    wrap.classList.add('pr-reveal');

    var layer = document.createElement('span');
    layer.className = 'pr-layer';
    layer.setAttribute('aria-hidden', 'true');
    var ai = document.createElement('img');
    ai.src = altSrc;
    ai.alt = '';
    ai.decoding = 'async';
    layer.appendChild(ai);

    var ring = document.createElement('span');
    ring.className = 'pr-ring';
    ring.setAttribute('aria-hidden', 'true');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pr-btn';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Show alternate design');
    btn.innerHTML = SWAP_SVG + '<span>AFTER</span>';
    var label = btn.querySelector('span');

    wrap.appendChild(layer);
    wrap.appendChild(ring);
    wrap.appendChild(btn);

    function setOn(on) {
      wrap.classList.toggle('pr-on', !!on);
      if (on) wrap.classList.remove('pr-seen');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Show original design' : 'Show alternate design');
      if (label) label.textContent = on ? 'BEFORE' : 'AFTER';
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setOn(!wrap.classList.contains('pr-on'));
    });

    var hoverLike = !(window.matchMedia && window.matchMedia('(hover:none)').matches);

    if (hoverLike) {
      wrap.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (wrap.classList.contains('pr-on')) return;
        var r = wrap.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var lr = Math.max(130, Math.min(360, Math.min(r.width, r.height) * 0.3));
        wrap.style.setProperty('--lr', lr.toFixed(0) + 'px');
        wrap.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        wrap.style.setProperty('--my', (e.clientY - r.top) + 'px');
        wrap.classList.add('pr-seen');
      }, { passive: true });
      wrap.addEventListener('pointerleave', function () { wrap.classList.remove('pr-seen'); });
    } else {
      // Touch: tapping the image toggles the alternate design.
      wrap.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('.pr-btn')) return;
        setOn(!wrap.classList.contains('pr-on'));
      });
    }

    return true;
  }

  window.ProjectReveal = { attach: attach, clear: clear };
})();
