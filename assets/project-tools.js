/* MOREATIVE — tool catalog + renderer for project case views.
   Project data stores tools as plain labels: ["Photoshop","Blender","Behance"].
   Unknown labels still render, using an initials tile. */
(function () {
  'use strict';
  if (window.ProjectTools) return;

  var CATALOG = [
    { label: 'Photoshop', abbr: 'Ps', keys: ['ps', 'adobe photoshop'] },
    { label: 'Illustrator', abbr: 'Ai', keys: ['ai', 'adobe illustrator'] },
    { label: 'InDesign', abbr: 'Id', keys: ['indd', 'adobe indesign'] },
    { label: 'After Effects', abbr: 'Ae', keys: ['ae', 'aftereffect'] },
    { label: 'Premiere Pro', abbr: 'Pr', keys: ['premiere', 'pr'] },
    { label: 'Lightroom', abbr: 'Lr', keys: ['lr'] },
    { label: 'Blender', abbr: 'Bl', keys: [] },
    { label: 'Cinema 4D', abbr: 'C4D', keys: ['c4d', 'cinema4d'] },
    { label: '3ds Max', abbr: '3ds', keys: ['3dsmax', 'max'] },
    { label: 'Maya', abbr: 'Ma', keys: ['autodesk maya'] },
    { label: 'ZBrush', abbr: 'Zb', keys: [] },
    { label: 'Substance 3D', abbr: 'S3D', keys: ['substance', 'substance painter', 'substance designer'] },
    { label: 'SketchUp', abbr: 'Su', keys: ['sketchup'] },
    { label: 'Rhino', abbr: 'Rh', keys: ['rhino3d'] },
    { label: 'KeyShot', abbr: 'Ks', keys: ['keyshot'] },
    { label: 'Unreal Engine', abbr: 'UE', keys: ['unreal', 'ue5', 'ue4'] },
    { label: 'Unity', abbr: 'Un', keys: [] },
    { label: 'Houdini', abbr: 'Hd', keys: ['sidefx'] },
    { label: 'Figma', abbr: 'Fg', keys: [] },
    { label: 'Sketch', abbr: 'Sk', keys: [] },
    { label: 'Framer', abbr: 'Fr', keys: [] },
    { label: 'Webflow', abbr: 'Wf', keys: [] },
    { label: 'Procreate', abbr: 'Pc', keys: [] },
    { label: 'Canva', abbr: 'Cv', keys: [] },
    { label: 'DaVinci Resolve', abbr: 'Dv', keys: ['davinci', 'resolve'] },
    { label: 'Midjourney', abbr: 'Mj', keys: ['mj'] },
    { label: 'Behance', abbr: 'Bē', keys: ['behance'] },
    { label: 'Dribbble', abbr: 'Dr', keys: ['dribbble'] }
  ];

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  function initials(name) {
    var parts = String(name || '').trim().split(/[\s._-]+/).filter(Boolean);
    if (!parts.length) return '•';
    if (parts.length === 1) {
      var w = parts[0];
      return w.length > 2 ? w.charAt(0).toUpperCase() + w.charAt(1).toLowerCase() : w.toUpperCase();
    }
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  function meta(name) {
    var n = norm(name);
    for (var i = 0; i < CATALOG.length; i++) {
      var c = CATALOG[i];
      if (norm(c.label) === n) return { label: c.label, abbr: c.abbr };
      for (var k = 0; k < c.keys.length; k++) {
        if (c.keys[k] === n) return { label: c.label, abbr: c.abbr };
      }
    }
    return { label: String(name || '').trim(), abbr: initials(name) };
  }

  function tile(label) {
    var m = meta(label);
    var el = document.createElement('span');
    el.className = 'tool';
    var ico = document.createElement('i');
    ico.className = 'tool-ico';
    ico.textContent = m.abbr;
    var nm = document.createElement('b');
    nm.className = 'tool-name';
    nm.textContent = m.label;
    el.appendChild(ico);
    el.appendChild(nm);
    return el;
  }

  function render(host, list) {
    if (!host) return 0;
    while (host.firstChild) host.removeChild(host.firstChild);
    var items = (Array.isArray(list) ? list : []).filter(function (x) {
      return x && String(x).trim();
    });
    items.forEach(function (name) { host.appendChild(tile(name)); });
    return items.length;
  }

  window.ProjectTools = { catalog: CATALOG, meta: meta, initials: initials, tile: tile, render: render };
})();
