// scene-redteam.js: the red-team loop, for the red-teaming stage. Two zones split
// by a wall: what participants get (rules, kit, practice paths) and what stays on
// the server (hidden parameters, house bots, secret seeds). The red team works
// only on the participant side; its bots cross the wall only as code, through
// matches. Five steps play in order and loop; the caption explains each one.
// It shows the process, not results.

(function () {
  "use strict";

  var root = document.getElementById("rtviz");
  if (!root) return;
  var cv = root.querySelector(".rtviz__canvas");
  var g = cv.getContext("2d");
  var capEl = document.getElementById("rtviz-caption");
  var dotsEl = document.getElementById("rtviz-dots");
  var playBtn = document.getElementById("rtviz-play");
  var nextBtn = document.getElementById("rtviz-next");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var ACC = "137,207,240", CORAL = "214,150,140", GREY = "139,140,147", TEXT = "240,240,242", LINE = "168,172,182";
  var STEPS = [
    "A red team starts a fresh session with an AI coding tool and only what participants get: the rules, the starter kit and the practice paths.",
    "Their bots are saved against the clock: one after 30 minutes, one at the end. No hard-coding, because the real scoring runs on paths nobody has seen.",
    "The bots cross the wall only as code, and play the house bot over many seeds with colours swapped.",
    "Too close? The house bot gets better, and the new version replaces the old one only if it passes a promotion rule written down before the games.",
    "Then a fresh red team goes again. The sessions that build the engine never write these bots, because they know the hidden parts."
  ];
  var DUR = 4.2;

  var step = 0, t = 0, playing = !reduce, visible = false;
  STEPS.forEach(function () { dotsEl.appendChild(document.createElement("span")); });
  var dots = [].slice.call(dotsEl.children);

  function setStep(s) {
    step = (s + STEPS.length) % STEPS.length; t = 0;
    capEl.textContent = STEPS[step];
    dots.forEach(function (d, i) { d.classList.toggle("is-on", i <= step); });
  }

  // ---- layout ----
  var W = 0, H = 0, dpr = 1, L = {};
  function layout() {
    W = cv.offsetWidth; H = cv.offsetHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    L.small = W < 460;
    L.wx = W / 2;
    L.lz = { x: 4, y: 28, w: L.wx - 14, h: H - 34 };
    L.rz = { x: L.wx + 10, y: 28, w: W - 4 - (L.wx + 10), h: H - 34 };
    L.lc = L.lz.x + L.lz.w / 2;
    L.rc = L.rz.x + L.rz.w / 2;
    L.ny = Math.round(H * (L.small ? 0.5 : 0.52));
    L.nw = Math.min(156, L.lz.w - 16);
    L.door0 = L.ny - 20; L.door1 = L.ny + 20;
  }

  function rr(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function text(s, x, y, col, size, align, base) {
    g.font = (size || 10.5) + "px 'IBM Plex Mono', ui-monospace, monospace";
    g.fillStyle = col; g.textAlign = align || "center"; g.textBaseline = base || "middle";
    g.fillText(s, x, y);
  }
  function pills(list, zone, y, col, litUpTo) {
    var size = L.small ? 9 : 10;
    g.font = size + "px 'IBM Plex Mono', ui-monospace, monospace";
    var pad = 7, gap = 6, rows = [[]], widths = [], rowW = [0];
    list.forEach(function (s) {
      var w = g.measureText(s).width + pad * 2;
      var r = rows.length - 1;
      if (rowW[r] + w + (rows[r].length ? gap : 0) > zone.w - 12 && rows[r].length) { rows.push([]); rowW.push(0); r++; }
      rowW[r] += w + (rows[r].length ? gap : 0);
      rows[r].push({ s: s, w: w });
    });
    var k = 0;
    rows.forEach(function (row, ri) {
      var x = zone.x + (zone.w - rowW[ri]) / 2, yy = y + ri * 22;
      row.forEach(function (p) {
        var lit = k < litUpTo;
        rr(x, yy - 9, p.w, 18, 9);
        g.strokeStyle = lit ? "rgba(" + col + ",0.75)" : "rgba(" + LINE + ",0.35)"; g.lineWidth = 1; g.stroke();
        text(p.s, x + p.w / 2, yy, lit ? "rgba(" + col + ",0.95)" : "rgba(" + GREY + ",0.9)", size);
        x += p.w + gap; k++;
      });
    });
  }
  function node(cx, cy, title, sub, col, a, glow) {
    var w = L.nw, h = 44;
    g.globalAlpha = a;
    rr(cx - w / 2, cy - h / 2, w, h, 8);
    g.fillStyle = "rgba(" + col + "," + (0.05 + 0.12 * (glow || 0)).toFixed(3) + ")"; g.fill();
    g.strokeStyle = "rgba(" + col + "," + (0.6 + 0.35 * (glow || 0)).toFixed(3) + ")"; g.lineWidth = 1.2; g.stroke();
    text(title, cx, cy - 7, "rgba(" + TEXT + ",0.92)", L.small ? 10.5 : 11.5);
    text(sub, cx, cy + 9, "rgba(" + GREY + ",0.95)", L.small ? 8.5 : 9.5);
    g.globalAlpha = 1;
  }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  function draw() {
    g.clearRect(0, 0, W, H);
    var s = step, p = clamp01(t / DUR);

    // zones
    var leftLit = s === 0 ? 0.5 + 0.5 * Math.sin(t * 3) : 0;
    rr(L.lz.x, L.lz.y, L.lz.w, L.lz.h, 10);
    g.strokeStyle = "rgba(" + ACC + "," + (0.22 + 0.35 * leftLit).toFixed(3) + ")"; g.lineWidth = 1; g.stroke();
    rr(L.rz.x, L.rz.y, L.rz.w, L.rz.h, 10);
    g.strokeStyle = "rgba(" + LINE + ",0.25)"; g.stroke();
    text(L.small ? "participants get" : "what participants get", L.lc, 14, "rgba(" + ACC + ",0.9)", 10.5);
    text(L.small ? "server only" : "server side, never shown", L.rc, 14, "rgba(" + GREY + ",0.95)", 10.5);
    pills(["rules", "starter kit", "practice paths"], L.lz, L.lz.y + 24, ACC, s === 0 ? Math.floor(1 + p * 4) : 3);
    pills(["hidden parameters", "house bots", "secret seeds"], L.rz, L.rz.y + 24, LINE, 0);

    // the wall, with one door: matches
    var wallGlow = s === 4 ? 0.5 + 0.5 * Math.sin(t * 3) : 0;
    g.strokeStyle = s === 4 ? "rgba(" + CORAL + "," + (0.45 + 0.4 * wallGlow).toFixed(3) + ")" : "rgba(" + LINE + ",0.45)";
    g.lineWidth = 1.5; g.setLineDash([5, 5]);
    g.beginPath(); g.moveTo(L.wx, 26); g.lineTo(L.wx, L.door0); g.moveTo(L.wx, L.door1); g.lineTo(L.wx, H - 4); g.stroke();
    g.setLineDash([]);
    g.font = "9.5px 'IBM Plex Mono', ui-monospace, monospace";
    var mw = g.measureText("matches").width + 8;
    g.fillStyle = "#131316"; g.fillRect(L.wx - mw / 2, L.door0 - 17, mw, 15);
    text("matches", L.wx, L.door0 - 9, "rgba(" + TEXT + ",0.75)", 9.5);

    // red team
    var rtA = s === 0 ? clamp01(p * 3) : 1;
    node(L.lc, L.ny, "red team", L.small ? "fresh session" : "fresh session · AI tool", ACC, rtA, s === 0 ? leftLit : 0);

    // house bot
    var hbGlow = s === 3 ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
    var v2 = s >= 3 && (s > 3 || p > 0.3);
    node(L.rc, L.ny, "house bot", v2 ? "improved version" : "current version", LINE, 1, hbGlow);

    // the two saved bots
    var by = L.ny + 40;
    if (s >= 1) {
      var a1 = s === 1 ? clamp01(p * 3) : 1, a2 = s === 1 ? clamp01(p * 3 - 1) : 1;
      var tp = s === 2 ? ease(clamp01(p * 1.6)) : s > 2 ? 1 : 0;
      [["30 min", a1, -1], ["final", a2, 1]].forEach(function (b, i) {
        var x0 = L.lc + b[2] * 30, y0 = by;
        var x1 = L.rc + b[2] * 30, y1 = by;
        // route: down-left start, through the door, to the house bot
        var x, y;
        if (tp <= 0) { x = x0; y = y0; }
        else if (tp < 0.5) { var q = tp / 0.5; x = x0 + (L.wx - x0) * q; y = y0 + (L.ny - y0) * q; }
        else { var q2 = (tp - 0.5) / 0.5; x = L.wx + (x1 - L.wx) * q2; y = L.ny + (y1 - L.ny) * q2; }
        if (s >= 3) { x = x1; y = y1; }
        g.globalAlpha = b[1] * (s >= 3 ? 0.55 : 1);
        g.font = (L.small ? 9 : 10) + "px 'IBM Plex Mono', ui-monospace, monospace";
        var w = g.measureText(b[0]).width + 14;
        rr(x - w / 2, y - 9, w, 18, 9);
        g.fillStyle = "rgba(" + ACC + ",0.12)"; g.fill();
        g.strokeStyle = "rgba(" + ACC + ",0.85)"; g.lineWidth = 1; g.stroke();
        text(b[0], x, y, "rgba(" + ACC + ",1)", L.small ? 9 : 10);
        g.globalAlpha = 1;
      });
    }

    // many games, colours swapped: a grid that fills in (no results shown)
    if (s >= 2) {
      var fill = s === 2 ? clamp01((p - 0.45) / 0.5) : 1;
      var cols = L.small ? 8 : 12, rows = 2, cell = 7, gp = 3;
      var gw = cols * cell + (cols - 1) * gp, gx = L.rc - gw / 2, gy = by + 18;
      var total = cols * rows, lit = Math.floor(total * fill);
      for (var i = 0; i < total; i++) {
        var cx = gx + (i % cols) * (cell + gp), cy = gy + Math.floor(i / cols) * (cell + gp);
        g.fillStyle = i < lit ? (i % 2 ? "rgba(" + TEXT + ",0.55)" : "rgba(" + GREY + ",0.75)") : "rgba(" + LINE + ",0.12)";
        g.fillRect(cx, cy, cell, cell);
      }
      if (fill > 0) text(L.small ? "many games" : "many games, colours swapped", L.rc, gy + rows * (cell + gp) + 9, "rgba(" + GREY + ",0.95)", 9.5);
    }

    // promotion rule, written first
    if (s >= 3) {
      var ra = s === 3 ? clamp01((p - 0.35) * 3) : 1;
      g.globalAlpha = ra;
      var ry = L.ny - 44;
      text(L.small ? "✓ rule set in advance" : "✓ promotion rule, set in advance", L.rc, ry, "rgba(" + ACC + ",0.95)", L.small ? 9 : 10);
      g.globalAlpha = 1;
    }

    // step 4: engine sessions are walled off; a fresh red team starts
    if (s === 4) {
      var ea = clamp01(p * 3);
      g.globalAlpha = ea;
      var ey = H - 22;
      var etxt = L.small ? "engine sessions" : "engine sessions: know the hidden parts";
      g.font = (L.small ? 9 : 10) + "px 'IBM Plex Mono', ui-monospace, monospace";
      var etw = g.measureText(etxt).width, etx = L.rz.x + L.rz.w - 8 - etw;
      text(etxt, etx, ey, "rgba(" + CORAL + ",0.95)", L.small ? 9 : 10, "left");
      g.strokeStyle = "rgba(" + CORAL + ",0.6)"; g.setLineDash([3, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(etx - 6, ey); g.lineTo(L.wx + 8, ey); g.stroke(); g.setLineDash([]);
      var xx = L.wx, yy = ey;
      g.strokeStyle = "rgba(" + CORAL + ",1)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(xx - 5, yy - 5); g.lineTo(xx + 5, yy + 5); g.moveTo(xx + 5, yy - 5); g.lineTo(xx - 5, yy + 5); g.stroke();
      if (!L.small) text("never write red-team bots", L.lc, ey, "rgba(" + CORAL + ",0.9)", 9.5);
      // circular "again" arrow by the red team
      var ax = L.small ? L.lc - L.nw / 2 + 8 : L.lc + L.nw / 2 - 6, ay = L.ny - 32, r = 9, rot = t * 2.4;
      g.strokeStyle = "rgba(" + ACC + ",0.9)"; g.lineWidth = 1.5;
      g.beginPath(); g.arc(ax, ay, r, rot, rot + 4.8); g.stroke();
      var ex = ax + r * Math.cos(rot + 4.8), ey2 = ay + r * Math.sin(rot + 4.8);
      g.beginPath(); g.arc(ex, ey2, 2.2, 0, 6.2832); g.fillStyle = "rgba(" + ACC + ",0.9)"; g.fill();
      g.globalAlpha = 1;
    }
  }

  // ---- loop ----
  var raf = 0, last = 0, running = false;
  function loop(ts) {
    if (!running) return;
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
    t += dt;
    if (playing && t >= DUR) setStep(step + 1);
    draw();
    raf = requestAnimationFrame(loop);
  }
  function start() { if (reduce || running) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  playBtn.addEventListener("click", function () {
    playing = !playing;
    playBtn.textContent = playing ? "Pause" : "Play";
    if (playing) t = Math.min(t, DUR - 0.01);
  });
  nextBtn.addEventListener("click", function () {
    setStep(step + 1);
    if (reduce) { t = DUR; draw(); }
  });

  layout(); setStep(0);
  if (reduce) { playing = false; playBtn.textContent = "Play"; playBtn.disabled = true; t = DUR; draw(); }
  else draw();
  window.addEventListener("resize", function () { layout(); draw(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0.2 }).observe(root);
  } else { start(); }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else if (visible) start();
  });
})();
