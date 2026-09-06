/* ============================================================
   oddfox.js — shared data + rendering layer
   No dependencies, no build step. Two halves:
     OF.data  loading and querying the JSON datasets
     OF.ui    small render helpers that emit HTML strings
   Everything is pure enough to lift into a real app later.
   ============================================================ */
(function (global) {
  'use strict';

  var BASE = 'json/';
  var store = Object.create(null);   // id -> parsed dataset
  var srcIndex = Object.create(null); // source id -> source record

  /* ---------- loading ---------------------------------------------------- */

  // Prefer fetch so the JSON files stay the single source of truth.
  // Falls back to window.ODDFOX_DATA (json/bundle.js) so the page also
  // works when opened straight off the filesystem, where fetch is blocked.
  function load(name) {
    if (store[name]) return Promise.resolve(store[name]);
    return fetch(BASE + name + '.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.json();
      })
      .catch(function (err) {
        var bundled = global.ODDFOX_DATA && global.ODDFOX_DATA[name];
        if (bundled) return bundled;
        throw err;
      })
      .then(function (d) { store[name] = d; return d; });
  }

  function loadAll(names) {
    return Promise.all(names.map(load)).then(function (list) {
      var out = Object.create(null);
      names.forEach(function (n, i) { out[n] = list[i]; });
      if (out.sources) {
        out.sources.records.forEach(function (s) { srcIndex[s.id] = s; });
      }
      return out;
    });
  }

  function get(name) { return store[name]; }

  /* ---------- querying --------------------------------------------------- */

  function records(name) {
    var d = store[name];
    return (d && d.records) || [];
  }

  function byId(name, id) {
    return records(name).filter(function (r) { return r.id === id; })[0] || null;
  }

  // where('chokepoints', {status: 'active'}) or where('x', fn)
  function where(name, pred) {
    var rs = records(name);
    if (typeof pred === 'function') return rs.filter(pred);
    return rs.filter(function (r) {
      return Object.keys(pred).every(function (k) { return r[k] === pred[k]; });
    });
  }

  function series(id) {
    var d = store['threat-stats'];
    if (!d) return null;
    return d.series.filter(function (s) { return s.id === id; })[0] || null;
  }

  function breakdown(id) {
    var d = store['threat-stats'];
    if (!d) return null;
    return d.breakdowns.filter(function (b) { return b.id === id; })[0] || null;
  }

  function source(id) { return srcIndex[id] || null; }

  function pointAt(seriesId, period) {
    var s = series(seriesId);
    if (!s) return null;
    return s.points.filter(function (p) { return p.period === period; })[0] || null;
  }

  function pctChange(from, to) {
    if (!from) return null;
    return Math.round(((to - from) / from) * 100);
  }

  /* ---------- html helpers ----------------------------------------------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var CONF_TONE = { high: 'calm', medium: 'warm', low: 'hot' };

  function confChip(level) {
    if (!level) return '';
    return chip(level + ' confidence', CONF_TONE[level] || '');
  }

  function chip(text, tone) {
    return '<span class="of-chip ' + (tone || '') + '">' + esc(text) + '</span>';
  }

  function chips(list, tone) {
    if (!list || !list.length) return '';
    return '<div class="of-chips">' +
      list.map(function (t) { return chip(t, tone); }).join('') + '</div>';
  }

  function stat(value, label, sub, delta) {
    var d = '';
    if (delta != null) {
      d = '<span class="of-delta ' + (delta > 0 ? 'up' : 'down') + '">' +
          (delta > 0 ? '+' : '') + delta + '%</span>';
    }
    return '<div class="of-stat">' +
      '<div class="of-stat-v">' + esc(value) + ' ' + d + '</div>' +
      '<div class="of-stat-l">' + esc(label) + '</div>' +
      (sub ? '<div class="of-stat-s">' + esc(sub) + '</div>' : '') +
      '</div>';
  }

  // rows: [{label, value, tone?}] — value must be numeric
  function bars(rows, opts) {
    opts = opts || {};
    var max = opts.max || Math.max.apply(null, rows.map(function (r) { return r.value; }));
    var suffix = opts.suffix || '';
    return '<div class="of-bars">' + rows.map(function (r) {
      var w = max ? (r.value / max) * 100 : 0;
      return '<div class="of-bar-row">' +
        '<div class="of-bar-lab">' + esc(r.label) + '</div>' +
        '<div class="of-bar-track"><div class="of-bar-fill ' + (r.tone || '') +
          '" style="width:' + w.toFixed(1) + '%"></div></div>' +
        '<div class="of-bar-v">' + esc(r.value) + suffix + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  // cols: [{key, label, num?, render?(row)}]
  function table(rows, cols) {
    var head = cols.map(function (c) {
      return '<th' + (c.num ? ' style="text-align:right"' : '') + '>' + esc(c.label) + '</th>';
    }).join('');
    var body = rows.map(function (row) {
      return '<tr>' + cols.map(function (c) {
        var v = c.render ? c.render(row) : esc(row[c.key] == null ? '—' : row[c.key]);
        return '<td' + (c.num ? ' class="num"' : '') + '>' + v + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="of-scroll"><table class="of-table"><thead><tr>' + head +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  // Renders source_ids as linked citations back into sources.json
  function cite(ids) {
    if (!ids || !ids.length) return '';
    return '<div class="of-src">Source: ' + ids.map(function (id) {
      var s = source(id);
      if (!s) return esc(id);
      return '<a class="of-link" href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
        esc(s.publisher || s.name) + '</a>';
    }).join(' · ') + '</div>';
  }

  function section(kicker, html) {
    return '<section class="of-section"><div class="of-kicker">' + esc(kicker) + '</div>' + html + '</section>';
  }

  function grid(cells, cols) {
    return '<div class="of-grid cols-' + (cols || 3) + '">' +
      cells.map(function (c) { return '<div class="of-cell">' + c + '</div>'; }).join('') +
      '</div>';
  }

  function callout(html) { return '<div class="of-callout">' + html + '</div>'; }
  function gap(html) { return '<div class="of-gap">' + html + '</div>'; }


  /* ---------- flags ------------------------------------------------------ */

  // flagsapi.com — https://flagsapi.com/{ISO}/flat/{16|24|32|48|64}.png
  function flag(iso, opts) {
    opts = opts || {};
    if (!iso) return '<span class="of-flag-none" title="flag not recorded"></span>';
    var px = opts.size || 24;
    return '<img class="of-flag' + (opts.large ? ' lg' : '') + '" loading="lazy"' +
      ' src="https://flagsapi.com/' + esc(iso.toUpperCase()) + '/flat/' + px + '.png"' +
      ' alt="' + esc(opts.name || iso) + '" title="' + esc(opts.name || iso) + '">';
  }

  /* ---------- map -------------------------------------------------------- */

  // Equirectangular, matching tools/build-world-path.py:
  //   x = (lon + 180) / 360 * 2000 ; y = (90 - lat) / 180 * 1000
  function lonlat(lat, lon) {
    return [(lon + 180) / 360 * 2000, (90 - lat) / 180 * 1000];
  }

  // points: [{name, coords:[lat,lon], count, unquantified}]
  // Auto-fits the viewBox to the plotted points so a regional series fills the
  // frame instead of sitting in a corner of the whole world.
  function map(points, opts) {
    opts = opts || {};
    var land = store['world-land'];
    var counted = points.filter(function (p) { return p.count; });
    // maxRef pins the circle scale to an external maximum so two maps drawn
    // side by side stay directly comparable.
    var maxC = opts.maxRef || Math.max.apply(null, counted.map(function (p) { return p.count; }).concat([1]));

    // Fit to the plotted data only. Reference chokepoints are decoration and
    // would otherwise drag an Asia-only series out to Panama.
    var xs = [], ys = [];
    points.forEach(function (p) {
      var c = lonlat(p.coords[0], p.coords[1]); xs.push(c[0]); ys.push(c[1]);
    });
    var view;
    if (opts.world) {
      view = [0, 0, 2000, 1000];
    } else if (opts.view) {
      view = opts.view;
    } else if (xs.length) {
      var padX = 190, padY = 140;
      var x0 = Math.max(0, Math.min.apply(null, xs) - padX);
      var x1 = Math.min(2000, Math.max.apply(null, xs) + padX);
      var y0 = Math.max(0, Math.min.apply(null, ys) - padY);
      var y1 = Math.min(1000, Math.max.apply(null, ys) + padY);
      // keep a sane aspect ratio, min width so a single point does not fill the world
      var w = Math.max(x1 - x0, 460), hgt = Math.max(y1 - y0, 260);
      if (w / hgt < 1.6) { var need = hgt * 1.6; x0 -= (need - w) / 2; w = need; }
      if (w / hgt > 2.8) { var needH = w / 2.8; y0 -= (needH - hgt) / 2; hgt = needH; }
      x0 = Math.max(0, Math.min(x0, 2000 - w)); y0 = Math.max(0, Math.min(y0, 1000 - hgt));
      view = [x0, y0, Math.min(w, 2000), Math.min(hgt, 1000)];
    } else {
      view = [0, 0, 2000, 1000];
    }
    // scale text and strokes with the zoom so labels stay readable
    var k = view[2] / 2000;
    var fs = (13 * k).toFixed(1), fsCt = (15 * k).toFixed(1), fsRef = (11 * k).toFixed(1);

    var grat = '';
    for (var lonG = -180; lonG <= 180; lonG += 30) {
      var gx = lonlat(0, lonG)[0];
      grat += '<line class="grat" x1="' + gx + '" y1="0" x2="' + gx + '" y2="1000"/>';
    }
    for (var latG = -60; latG <= 60; latG += 30) {
      var gy = lonlat(latG, 0)[1];
      grat += '<line class="grat" x1="0" y1="' + gy + '" x2="2000" y2="' + gy + '"/>';
    }

    var landPaths = land ? land.paths.map(function (d) {
      return '<path class="land" d="' + d + '"/>';
    }).join('') : '';

    // only draw reference marks that fall inside the fitted frame
    var refs = (opts.reference || []).filter(function (r) {
      var c = lonlat(r.coords[0], r.coords[1]);
      return c[0] >= view[0] && c[0] <= view[0] + view[2] &&
             c[1] >= view[1] && c[1] <= view[1] + view[3];
    }).map(function (r) {
      var c = lonlat(r.coords[0], r.coords[1]), m = 7 * k;
      return '<g><title>' + esc(r.name) + '</title>' +
        '<path class="ref" d="M' + (c[0]-m).toFixed(1) + ',' + c[1].toFixed(1) + 'h' + (m*2).toFixed(1) +
        'M' + c[0].toFixed(1) + ',' + (c[1]-m).toFixed(1) + 'v' + (m*2).toFixed(1) + '"/>' +
        '<text class="ref-l" style="font-size:' + fsRef + 'px" x="' + (c[0] + m + 3).toFixed(1) +
        '" y="' + (c[1] + 3 * k).toFixed(1) + '">' + esc(r.name) + '</text></g>';
    }).join('');

    // biggest first so small circles draw on top; labels staggered to reduce collisions
    var ordered = points.slice().sort(function (a, b) { return (b.count || 0) - (a.count || 0); });
    var placed = [];
    var marks = ordered.map(function (p, i) {
      var c = lonlat(p.coords[0], p.coords[1]);
      var n = p.count;
      var r = (opts.heat
        ? (3 + Math.sqrt(n / maxC) * 26)
        : (n ? 9 + Math.sqrt(n / maxC) * 46 : 7)) * k;
      var cls = n ? 'pt' : (p.unquantified ? 'pt unq' : 'pt zero');
      var label = n != null ? String(n) : '?';

      // find a label offset that does not sit on an already-placed label
      var dy = r + 14 * k, tries = [dy, -(r + 6 * k), dy + 15 * k, -(r + 20 * k)], oy = tries[0];
      for (var t = 0; t < tries.length; t++) {
        var cand = { x: c[0], y: c[1] + tries[t] };
        var clash = placed.some(function (q) {
          return Math.abs(q.x - cand.x) < 90 * k && Math.abs(q.y - cand.y) < 15 * k;
        });
        if (!clash) { oy = tries[t]; break; }
      }
      placed.push({ x: c[0], y: c[1] + oy });

      // heat mode: hundreds of binned cells, so no labels and no count text
      var showName = !opts.heat && opts.labelAll !== false && (n || p.unquantified || placed.length <= 12);
      return '<g><title>' + esc(p.name) + ' — ' +
          (n != null ? n : esc(p.unquantified || 'none')) + '</title>' +
        '<circle class="' + cls + '" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + r.toFixed(1) + '"/>' +
        (n != null && !opts.heat ? '<text class="ct" style="font-size:' + fsCt + 'px" x="' + c[0].toFixed(1) +
          '" y="' + (c[1] + 5 * k).toFixed(1) + '" text-anchor="middle">' + label + '</text>' : '') +
        (showName ? '<text style="font-size:' + fs + 'px" x="' + c[0].toFixed(1) + '" y="' +
          (c[1] + oy).toFixed(1) + '" text-anchor="middle">' + esc(p.name) + '</text>' : '') +
        '</g>';
    }).join('');

    return '<svg class="of-map" viewBox="' + view.map(function (v) { return v.toFixed(1); }).join(' ') +
      '" role="img" aria-label="' + esc(opts.label || 'Incident map') + '" preserveAspectRatio="xMidYMid meet">' +
      grat + landPaths + refs + marks + '</svg>' +
      '<div class="of-maplegend">' +
        '<span class="k"><span class="sw" style="background:rgba(255,77,61,.55);border:1px solid var(--hot)"></span>' +
          (opts.heat ? 'attacks per 2° cell, area proportional to count' : 'incidents, area proportional to count') + '</span>' +
        (opts.heat ? '' :
          '<span class="k"><span class="sw" style="border:1px dashed var(--warm)"></span>reported, not quantified</span>' +
          '<span class="k"><span class="sw" style="border:1px dashed var(--fog)"></span>zero</span>') +
        (refs ? '<span class="k"><span class="sw" style="border:1px solid var(--cool)"></span>chokepoint</span>' : '') +
      '</div>';
  }

  /* ---------- charts ------------------------------------------------------ */

  // Vertical column chart. points: [{label, value, tone?}]
  function columns(points, opts) {
    opts = opts || {};
    var W = 1000, H = opts.height || 260, padL = 34, padB = 42, padT = 14;
    var max = opts.max || Math.max.apply(null, points.map(function (p) { return p.value; }).concat([1]));
    var n = points.length;
    var bw = (W - padL) / n;
    var barW = Math.max(2, bw * 0.62);
    var plotH = H - padB - padT;

    var grid = '', ticks = opts.ticks || 4;
    for (var i = 0; i <= ticks; i++) {
      var v = max * i / ticks, y = padT + plotH - (v / max) * plotH;
      grid += '<line class="gridline" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + W + '" y2="' + y.toFixed(1) + '"/>' +
        '<text class="lbl" x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + Math.round(v) + '</text>';
    }

    var every = opts.labelEvery || Math.ceil(n / 14);
    var bars = points.map(function (p, i) {
      var h = (p.value / max) * plotH;
      var x = padL + i * bw + (bw - barW) / 2;
      var y = padT + plotH - h;
      // Rotate labels only when they would otherwise collide; a handful of wide
      // bars reads far better with the label sitting flat under it.
      var cxb = (x + barW / 2).toFixed(1);
      var flat = bw > 58;
      var lab = (i % every === 0 || i === n - 1)
        ? (flat
            ? '<text class="lbl" style="font-size:12px" x="' + cxb + '" y="' + (H - padB + 18) +
              '" text-anchor="middle">' + esc(p.label) + '</text>'
            : '<text class="lbl" x="' + cxb + '" y="' + (H - padB + 15) +
              '" text-anchor="end" transform="rotate(-45 ' + cxb + ',' + (H - padB + 15) + ')">' +
              esc(p.label) + '</text>')
        : '';
      var vlab = (p.value > 0 && opts.showValues)
        ? '<text class="vlbl" style="font-size:' + (flat ? 14 : 10) + 'px" x="' + cxb +
          '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle">' + p.value + '</text>'
        : '';
      return '<g><title>' + esc(p.label) + ': ' + p.value + '</title>' +
        '<rect class="col ' + (p.tone || '') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
        '" width="' + barW.toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '"/></g>' + vlab + lab;
    }).join('');

    return '<svg class="of-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      esc(opts.label || 'column chart') + '" preserveAspectRatio="none" style="height:' + H + 'px">' +
      grid + bars +
      '<line class="axis" x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + W + '" y2="' + (padT + plotH) + '"/>' +
      '</svg>';
  }

  // Line chart with area fill. points: [{label, value}]
  function line(points, opts) {
    opts = opts || {};
    var W = 1000, H = opts.height || 240, padL = 34, padB = 34, padT = 14;
    var max = opts.max || Math.max.apply(null, points.map(function (p) { return p.value; }).concat([1]));
    var plotH = H - padB - padT, n = points.length;
    var xAt = function (i) { return padL + (n === 1 ? 0 : (i / (n - 1)) * (W - padL - 6)); };
    var yAt = function (v) { return padT + plotH - (v / max) * plotH; };

    var grid = '';
    for (var i = 0; i <= 4; i++) {
      var v = max * i / 4, y = yAt(v);
      grid += '<line class="gridline" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + W + '" y2="' + y.toFixed(1) + '"/>' +
        '<text class="lbl" x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + Math.round(v) + '</text>';
    }
    var d = points.map(function (p, i) {
      return (i ? 'L' : 'M') + xAt(i).toFixed(1) + ',' + yAt(p.value).toFixed(1);
    }).join(' ');
    var area = d + ' L' + xAt(n - 1).toFixed(1) + ',' + yAt(0).toFixed(1) +
               ' L' + xAt(0).toFixed(1) + ',' + yAt(0).toFixed(1) + ' Z';
    var dots = points.map(function (p, i) {
      return '<g><title>' + esc(p.label) + ': ' + p.value + '</title>' +
        '<circle class="dot" cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(p.value).toFixed(1) + '" r="3.5"/></g>';
    }).join('');
    var every = opts.labelEvery || Math.ceil(n / 10);
    var labs = points.map(function (p, i) {
      if (i % every !== 0 && i !== n - 1) return '';
      return '<text class="lbl" x="' + xAt(i).toFixed(1) + '" y="' + (H - padB + 16) + '" text-anchor="middle">' + esc(p.label) + '</text>';
    }).join('');

    return '<svg class="of-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      esc(opts.label || 'line chart') + '" preserveAspectRatio="none" style="height:' + H + 'px">' +
      '<defs><linearGradient id="ofgrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#fff" stop-opacity=".22"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      grid + '<path class="area" d="' + area + '"/><path class="ln" d="' + d + '"/>' + dots + labs +
      '<line class="axis" x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + W + '" y2="' + (padT + plotH) + '"/>' +
      '</svg>';
  }

  // Aggregate helper: [{k: v}] -> [{label, value}] sorted desc
  function tally(items, key) {
    var m = Object.create(null);
    items.forEach(function (it) {
      var k = typeof key === 'function' ? key(it) : it[key];
      if (k == null) return;
      m[k] = (m[k] || 0) + 1;
    });
    return Object.keys(m).map(function (k) { return { label: k, value: m[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  function sum(items, key) {
    return items.reduce(function (a, it) { return a + (Number(it[key]) || 0); }, 0);
  }


  /* ---------- multi-series time chart ------------------------------------ */

  function dnum(d) { var p = String(d).split('-'); return new Date(+p[0], (+p[1]||1)-1, +p[2]||1).getTime(); }

  // series: [{area, tone, points:[{date, low, high, label, approx}]}]
  function multiline(series, opts) {
    opts = opts || {};
    var W = 1000, H = opts.height || 320, padL = 46, padB = 46, padT = 16, padR = 12;
    var all = [];
    series.forEach(function (s) { s.points.forEach(function (p) { all.push(p); }); });
    if (!all.length) return '';
    var t0 = Math.min.apply(null, all.map(function (p) { return dnum(p.date); }));
    var t1 = Math.max.apply(null, all.map(function (p) { return dnum(p.date); }));
    var vals = all.map(function (p) { return (p.low + p.high) / 2; });
    var vMin = Math.min.apply(null, vals), vMax = Math.max.apply(null, vals);
    var log = opts.logY !== false;
    var lo = log ? Math.log10(Math.max(vMin * 0.6, 0.01)) : 0;
    var hi = log ? Math.log10(vMax * 1.5) : vMax * 1.15;
    var plotW = W - padL - padR, plotH = H - padB - padT;

    var xAt = function (d) { return padL + (t1 === t0 ? plotW / 2 : (dnum(d) - t0) / (t1 - t0) * plotW); };
    var yAt = function (v) {
      var f = log ? (Math.log10(Math.max(v, 0.01)) - lo) / (hi - lo) : v / hi;
      return padT + plotH - f * plotH;
    };

    var grid = '', ticks = log ? [0.1, 0.25, 0.5, 1, 2.5, 5, 10] : null;
    if (log) {
      ticks.forEach(function (v) {
        if (v < Math.pow(10, lo) || v > Math.pow(10, hi)) return;
        var y = yAt(v);
        grid += '<line class="gridline" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '"/>' +
          '<text class="lbl" x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + v + '%</text>';
      });
    }
    // year gridlines
    var y0 = new Date(t0).getFullYear(), y1 = new Date(t1).getFullYear();
    for (var yy = y0; yy <= y1 + 1; yy++) {
      var tx = new Date(yy, 0, 1).getTime();
      if (tx < t0 || tx > t1) continue;
      var x = padL + (tx - t0) / (t1 - t0) * plotW;
      grid += '<line class="gridline" x1="' + x.toFixed(1) + '" y1="' + padT + '" x2="' + x.toFixed(1) + '" y2="' + (padT + plotH) + '"/>' +
        '<text class="lbl" x="' + x.toFixed(1) + '" y="' + (H - padB + 16) + '" text-anchor="middle">' + yy + '</text>';
    }

    var TONE = { hot: 'var(--hot)', warm: 'var(--warm)', cool: 'var(--cool)', calm: 'var(--calm)' };
    var body = series.map(function (s) {
      var col = TONE[s.tone] || 'var(--paper)';
      var pts = s.points.slice().sort(function (a, b) { return dnum(a.date) - dnum(b.date); });
      var d = pts.map(function (p, i) {
        return (i ? 'L' : 'M') + xAt(p.date).toFixed(1) + ',' + yAt((p.low + p.high) / 2).toFixed(1);
      }).join(' ');
      var band = pts.filter(function (p) { return p.high > p.low; }).map(function (p) {
        return '<line x1="' + xAt(p.date).toFixed(1) + '" y1="' + yAt(p.low).toFixed(1) +
          '" x2="' + xAt(p.date).toFixed(1) + '" y2="' + yAt(p.high).toFixed(1) +
          '" stroke="' + col + '" stroke-width="6" stroke-opacity=".28" stroke-linecap="round"/>';
      }).join('');
      var dots = pts.map(function (p) {
        var v = (p.low + p.high) / 2;
        return '<g><title>' + esc(s.area) + ' — ' + esc(p.date) + ': ' + esc(p.label) +
          (p.approx ? ' (date approximate)' : '') + '</title>' +
          '<circle cx="' + xAt(p.date).toFixed(1) + '" cy="' + yAt(v).toFixed(1) + '" r="4.5" fill="var(--void)" stroke="' + col + '" stroke-width="2.5"' +
          (p.approx ? ' stroke-dasharray="2 2"' : '') + '/></g>';
      }).join('');
      var lastP = pts[pts.length - 1];
      var lab = '<text x="' + (xAt(lastP.date) + 9).toFixed(1) + '" y="' + (yAt((lastP.low + lastP.high) / 2) + 4).toFixed(1) +
        '" fill="' + col + '" font-family="var(--mono)" font-size="11" paint-order="stroke" stroke="#04070a" stroke-width="4">' +
        esc(lastP.label) + '</text>';
      return band + '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round"/>' + dots + lab;
    }).join('');

    var legend = '<div class="of-maplegend">' + series.map(function (s) {
      return '<span class="k"><span class="sw" style="width:16px;height:3px;border-radius:0;background:' +
        (TONE[s.tone] || 'var(--paper)') + '"></span>' + esc(s.area) + '</span>';
    }).join('') + '</div>';

    return '<svg class="of-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      esc(opts.label || 'risk over time') + '" preserveAspectRatio="none" style="height:' + H + 'px">' +
      grid + body +
      '<line class="axis" x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (W - padR) + '" y2="' + (padT + plotH) + '"/>' +
      '</svg>' + legend +
      (log ? '<p class="of-note" style="margin-top:10px">Vertical axis is logarithmic; the plotted range spans 0.1% to 10% of hull value. Hollow dashed markers are values the source described in relative terms, placed on an approximate date.</p>' : '');
  }


  /* ---------- slope chart ------------------------------------------------- */

  // rows: [{label, from, to, body?}] — a two-period comparison read as one shape
  function slope(rows, opts) {
    opts = opts || {};
    var W = 1000, H = opts.height || 300, padT = 44, padB = 34;
    var xL = 250, xR = W - 250;
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.from, r.to); }).concat([1]));
    var plotH = H - padT - padB;
    var yAt = function (v) { return padT + plotH - (v / max) * plotH; };

    var TONE = { hot:'var(--hot)', warm:'var(--warm)', cool:'var(--cool)', calm:'var(--calm)' };

    var body = rows.map(function (r, i) {
      var down = r.to < r.from;
      var col = r.tone ? TONE[r.tone] : (down ? 'var(--calm)' : 'var(--hot)');
      var y0 = yAt(r.from), y1 = yAt(r.to);
      var pct = r.from ? Math.round((r.to - r.from) / r.from * 100) : null;
      return '<g><title>' + esc(r.label) + ': ' + r.from + ' → ' + r.to +
          (pct != null ? ' (' + (pct > 0 ? '+' : '') + pct + '%)' : '') + '</title>' +
        '<line class="sl" x1="' + xL + '" y1="' + y0.toFixed(1) + '" x2="' + xR + '" y2="' + y1.toFixed(1) +
          '" stroke="' + col + '"/>' +
        '<circle class="sdot" cx="' + xL + '" cy="' + y0.toFixed(1) + '" r="5" fill="var(--void)" stroke="' + col + '"/>' +
        '<circle class="sdot" cx="' + xR + '" cy="' + y1.toFixed(1) + '" r="5" fill="' + col + '" stroke="' + col + '"/>' +
        '<text class="sv" x="' + (xL - 12) + '" y="' + (y0 + 5).toFixed(1) + '" text-anchor="end" fill="' + col + '">' + r.from + '</text>' +
        '<text class="sv" x="' + (xR + 12) + '" y="' + (y1 + 5).toFixed(1) + '" fill="' + col + '">' + r.to +
          (pct != null ? '  <tspan font-size="11" fill="' + col + '">' + (pct > 0 ? '+' : '') + pct + '%</tspan>' : '') + '</text>' +
        '<text class="sn" x="' + (xL - 12) + '" y="' + (y0 - 11).toFixed(1) + '" text-anchor="end">' + esc(r.label) + '</text>' +
        (r.body ? '<text class="sp" x="' + (xL - 12) + '" y="' + (y0 + 20).toFixed(1) + '" text-anchor="end">' + esc(r.body) + '</text>' : '') +
        '</g>';
    }).join('');

    return '<svg class="of-slope" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      esc(opts.label || 'period comparison') + '" preserveAspectRatio="xMidYMid meet" style="height:' + H + 'px">' +
      '<line class="srule" x1="' + xL + '" y1="' + (padT - 22) + '" x2="' + xL + '" y2="' + (H - padB + 6) + '"/>' +
      '<line class="srule" x1="' + xR + '" y1="' + (padT - 22) + '" x2="' + xR + '" y2="' + (H - padB + 6) + '"/>' +
      '<text class="sp" x="' + xL + '" y="' + (padT - 30) + '" text-anchor="middle">' + esc(opts.fromLabel || 'FROM') + '</text>' +
      '<text class="sp" x="' + xR + '" y="' + (padT - 30) + '" text-anchor="middle">' + esc(opts.toLabel || 'TO') + '</text>' +
      body + '</svg>';
  }

  /* ---------- pie / donut ------------------------------------------------- */

  var PIE_TONES = ['var(--hot)','var(--cool)','var(--warm)','var(--calm)','#b48cff','#8c8c8c','#5f7d8c','#d9d9d9'];

  // items: [{label, value}]
  function pie(items, opts) {
    opts = opts || {};
    items = items.filter(function (i) { return i.value > 0; });
    var total = items.reduce(function (a, i) { return a + i.value; }, 0);
    if (!total) return '<p class="of-note">No data.</p>';
    var R = 80, r = opts.donut === false ? 0 : 46, cx = 100, cy = 100, a = -Math.PI / 2;

    var arcs = items.map(function (it, i) {
      var frac = it.value / total, sweep = frac * Math.PI * 2;
      var a0 = a, a1 = a + sweep; a = a1;
      var col = it.tone || PIE_TONES[i % PIE_TONES.length];
      var large = sweep > Math.PI ? 1 : 0;
      var p0 = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)];
      var p1 = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
      var d;
      if (frac >= 0.9999) {
        d = 'M' + cx + ',' + (cy - R) + 'A' + R + ',' + R + ' 0 1 1 ' + (cx - 0.01) + ',' + (cy - R) + 'Z';
      } else if (r) {
        var q0 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
        var q1 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
        d = 'M' + p0[0].toFixed(2) + ',' + p0[1].toFixed(2) +
            'A' + R + ',' + R + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ',' + p1[1].toFixed(2) +
            'L' + q0[0].toFixed(2) + ',' + q0[1].toFixed(2) +
            'A' + r + ',' + r + ' 0 ' + large + ' 0 ' + q1[0].toFixed(2) + ',' + q1[1].toFixed(2) + 'Z';
      } else {
        d = 'M' + cx + ',' + cy + 'L' + p0[0].toFixed(2) + ',' + p0[1].toFixed(2) +
            'A' + R + ',' + R + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ',' + p1[1].toFixed(2) + 'Z';
      }
      return '<g><title>' + esc(it.label) + ': ' + it.value + ' (' + Math.round(frac * 100) + '%)</title>' +
        '<path d="' + d + '" fill="' + col + '" fill-opacity=".85" stroke="var(--void)" stroke-width="1.5"/></g>';
    }).join('');

    var centre = r ? '<text x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle" fill="var(--paper)" ' +
      'font-family="var(--mono)" font-size="26" font-variant-numeric="tabular-nums">' + total + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" fill="var(--fog)" ' +
      'font-family="var(--mono)" font-size="8" letter-spacing="1.5">' + esc(opts.centreLabel || 'TOTAL') + '</text>' : '';

    var legend = '<div style="display:flex;flex-direction:column;gap:7px;margin-top:14px">' +
      items.map(function (it, i) {
        var col = it.tone || PIE_TONES[i % PIE_TONES.length];
        return '<div style="display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--paper)">' +
          '<span style="width:10px;height:10px;border-radius:2px;background:' + col + ';flex-shrink:0"></span>' +
          '<span style="flex:1">' + esc(it.label) + '</span>' +
          '<span class="of-num" style="opacity:.8">' + it.value + '</span>' +
          '<span class="of-num" style="color:var(--fog);min-width:34px;text-align:right">' +
            Math.round(it.value / total * 100) + '%</span></div>';
      }).join('') + '</div>';

    return '<div><svg viewBox="0 0 200 200" style="width:100%;max-width:200px;display:block;margin:0 auto" ' +
      'role="img" aria-label="' + esc(opts.label || 'proportions') + '">' + arcs + centre + '</svg>' + legend + '</div>';
  }


  /* ---------- comparison matrix ------------------------------------------ */

  // rows: [{label, sub?, cells:[{on, tone?, text?}], values?:[...]}]
  // cols: [{label, kind?: 'dot'|'text'}]
  function matrix(rows, cols, opts) {
    opts = opts || {};
    var head = '<tr><th class="co">' + esc(opts.corner || 'Company') + '</th>' +
      cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r) {
      return '<tr><td class="co"><span class="co-name">' + esc(r.label) + '</span>' +
        (r.sub ? '<span class="co-sub">' + esc(r.sub) + '</span>' : '') + '</td>' +
        r.cells.map(function (c) {
          if (c == null) return '<td class="cell"><span class="of-dot-off"></span></td>';
          if (c.text != null) return '<td class="' + (c.num ? 'val' : 'cell') + '">' +
            (c.text === '' ? '<span class="of-dot-off"></span>' : esc(c.text)) + '</td>';
          return '<td class="cell">' + (c.on
            ? '<span class="of-dot ' + (c.tone || '') + '" title="' + esc(c.title || '') + '"></span>'
            : '<span class="of-dot-off"></span>') + '</td>';
        }).join('') + '</tr>';
    }).join('');
    return '<div class="of-matrix-wrap"><table class="of-matrix"><thead>' + head +
      '</thead><tbody>' + body + '</tbody></table></div>';
  }


  /* ---------- stacked area ------------------------------------------------ */

  // xLabels: ['0','1','2','3','4']
  // series:  [{label, tone, values:[...]}]  — stacked bottom-up in array order
  function stackedArea(xLabels, series, opts) {
    opts = opts || {};
    var W = 1000, H = opts.height || 320, padL = 44, padB = 46, padT = 18, padR = 12;
    var n = xLabels.length;
    var totals = xLabels.map(function (_, i) {
      return series.reduce(function (a, s) { return a + (s.values[i] || 0); }, 0);
    });
    var max = opts.max || Math.max.apply(null, totals.concat([1]));
    var plotW = W - padL - padR, plotH = H - padB - padT;
    var xAt = function (i) { return padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW); };
    var yAt = function (v) { return padT + plotH - (v / max) * plotH; };

    var grid = '';
    for (var g = 0; g <= 4; g++) {
      var v = max * g / 4, y = yAt(v);
      grid += '<line class="gridline" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '"/>' +
        '<text class="lbl" x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + Math.round(v) + '</text>';
    }

    var TONE = { hot:'var(--hot)', warm:'var(--warm)', cool:'var(--cool)', calm:'var(--calm)', paper:'var(--paper)' };
    var base = xLabels.map(function () { return 0; });
    var bands = series.map(function (s) {
      var top = base.map(function (b, i) { return b + (s.values[i] || 0); });
      var up = top.map(function (v, i) { return (i ? 'L' : 'M') + xAt(i).toFixed(1) + ',' + yAt(v).toFixed(1); }).join(' ');
      var down = base.slice().reverse().map(function (v, k) {
        var i = base.length - 1 - k;
        return 'L' + xAt(i).toFixed(1) + ',' + yAt(v).toFixed(1);
      }).join(' ');
      var col = TONE[s.tone] || 'var(--paper)';
      var path = '<path d="' + up + ' ' + down + ' Z" fill="' + col + '" fill-opacity=".38" stroke="' + col +
                 '" stroke-width="1.5" stroke-linejoin="round"><title>' + esc(s.label) + '</title></path>';
      base = top;
      return path;
    }).join('');

    var labs = xLabels.map(function (l, i) {
      return '<text class="lbl" style="font-size:12px" x="' + xAt(i).toFixed(1) + '" y="' + (H - padB + 18) +
        '" text-anchor="middle">' + esc(l) + '</text>' +
        '<text class="vlbl" style="font-size:13px" x="' + xAt(i).toFixed(1) + '" y="' + (yAt(totals[i]) - 8).toFixed(1) +
        '" text-anchor="middle">' + totals[i] + '</text>';
    }).join('');

    var legend = '<div class="of-maplegend">' + series.slice().reverse().map(function (s) {
      return '<span class="k"><span class="sw" style="background:' + (TONE[s.tone] || 'var(--paper)') +
        ';opacity:.75;border-radius:2px"></span>' + esc(s.label) + '</span>';
    }).join('') + '</div>';

    return '<svg class="of-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="height:' + H + 'px" ' +
      'role="img" aria-label="' + esc(opts.label || 'composition') + '">' + grid + bands + labs +
      '<line class="axis" x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (W - padR) + '" y2="' + (padT + plotH) + '"/>' +
      '</svg>' + legend;
  }

  function mount(el, html) {
    (typeof el === 'string' ? document.querySelector(el) : el).innerHTML = html;
  }

  global.OF = {
    data: { load: load, loadAll: loadAll, get: get, records: records, byId: byId,
            where: where, series: series, breakdown: breakdown, source: source,
            pointAt: pointAt, pctChange: pctChange, base: function (b) { BASE = b; } },
    ui: { esc: esc, chip: chip, chips: chips, confChip: confChip, stat: stat, bars: bars,
          table: table, cite: cite, section: section, grid: grid, callout: callout,
          gap: gap, mount: mount, flag: flag, map: map, columns: columns, line: line,
          lonlat: lonlat, tally: tally, sum: sum, multiline: multiline, pie: pie, slope: slope, matrix: matrix, stackedArea: stackedArea }
  };
})(window);
