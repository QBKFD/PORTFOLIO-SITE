// scene-rbc.js: one turn of Reconnaissance Blind Chess, for the RBC stage.
// White has played e4; Black's reply is hidden. The candidate set is every board
// Black could have: 16 pawn moves, 4 knight moves, or a pass (21 boards). Shading
// shows how many candidates put a black piece on each square. Clicking a square
// senses the 3x3 window around it (clipped at the edge, as in reconchess) and
// keeps only the candidates that match what the window shows. "Best sense"
// picks the window with the fewest boards left on average.

(function () {
  "use strict";

  var root = document.getElementById("cviz");
  if (!root) return;
  var cv = root.querySelector(".cviz__board");
  var g = cv.getContext("2d");
  var countEl = document.getElementById("cviz-count");
  var msgEl = document.getElementById("cviz-msg");
  var bestBtn = document.getElementById("cviz-best");
  var newBtn = document.getElementById("cviz-new");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var ACC = "137,207,240", CORAL = "214,150,140", TEXT = "236,236,240";
  var FILES = "abcdefgh";
  var GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞" };
  var GLYPH_FONT = "'Segoe UI Symbol', 'Apple Symbols', 'DejaVu Sans', 'Noto Sans Symbols 2', 'Noto Sans Symbols2', serif";
  var DEFAULT_MSG = "Hover to preview a sense, click to use it. Shaded squares are where Black's pieces might be.";

  // ---- boards: index = rank * 8 + file, rank 0 is White's back rank ----
  function startBoard() {
    var rows = ["RNBQKBNR", "PPPPPPPP", "", "", "", "", "pppppppp", "rnbqkbnr"];
    var b = new Array(64).fill(null);
    rows.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) b[r * 8 + c] = row[c];
    });
    return b;
  }
  function move(b, from, to) { var n = b.slice(); n[to] = n[from]; n[from] = null; return n; }
  function sq(r, c) { return r * 8 + c; }

  var AFTER_E4 = move(startBoard(), sq(1, 4), sq(3, 4));
  var CANDS = [];
  (function buildCandidates() {
    for (var c = 0; c < 8; c++) {
      CANDS.push({ b: move(AFTER_E4, sq(6, c), sq(5, c)), name: "…" + FILES[c] + "6" });
      CANDS.push({ b: move(AFTER_E4, sq(6, c), sq(4, c)), name: "…" + FILES[c] + "5" });
    }
    [[1, 0], [1, 2], [6, 5], [6, 7]].forEach(function (k) {
      var from = sq(7, k[0]), toC = k[1];
      CANDS.push({ b: move(AFTER_E4, from, sq(5, toC)), name: "…N" + FILES[toC] + "6" });
    });
    CANDS.push({ b: AFTER_E4.slice(), name: "a pass" });
  })();

  // ---- state ----
  var alive = [], truth = 0, sensed = -1, hover = -1, suggested = -1, pulse = 0, sugMsg = "";

  function windowOf(center) {
    var r0 = Math.floor(center / 8), c0 = center % 8, out = [];
    for (var r = r0 - 1; r <= r0 + 1; r++) {
      for (var c = c0 - 1; c <= c0 + 1; c++) {
        if (r >= 0 && r < 8 && c >= 0 && c < 8) out.push(sq(r, c));
      }
    }
    return out;
  }
  function keyFor(cand, win) { return win.map(function (s) { return cand.b[s] || "."; }).join(""); }
  function expectedLeft(center) {
    var win = windowOf(center), groups = {};
    alive.forEach(function (i) { var k = keyFor(CANDS[i], win); groups[k] = (groups[k] || 0) + 1; });
    var e = 0;
    Object.keys(groups).forEach(function (k) { e += groups[k] * groups[k]; });
    return e / alive.length;
  }
  function bestCenter() {
    var best = -1, bestE = Infinity, bestD = Infinity;
    for (var s = 0; s < 64; s++) {
      var e = expectedLeft(s);
      var r = Math.floor(s / 8), c = s % 8;
      var d = Math.abs(r - 4.5) + Math.abs(c - 3.5);          // prefer central windows on ties
      if (e < bestE - 1e-9 || (Math.abs(e - bestE) < 1e-9 && d < bestD)) { best = s; bestE = e; bestD = d; }
    }
    return best;
  }
  function name(s) { return FILES[s % 8] + (Math.floor(s / 8) + 1); }

  function newGame() {
    alive = CANDS.map(function (c, i) { return i; });
    truth = Math.floor(Math.random() * CANDS.length);
    sensed = -1; suggested = -1; hover = -1;
    countEl.textContent = String(alive.length);
    msgEl.textContent = DEFAULT_MSG;
    bestBtn.textContent = "Show the best sense";
    bestBtn.disabled = false;
    cv.classList.remove("is-done");
    draw();
  }

  function sense(center) {
    if (sensed >= 0) return;
    var win = windowOf(center), seen = keyFor(CANDS[truth], win);
    var before = alive.length;
    alive = alive.filter(function (i) { return keyFor(CANDS[i], win) === seen; });
    sensed = center; suggested = -1; hover = -1;
    bestBtn.disabled = true;
    cv.classList.add("is-done");
    animateCount(before, alive.length);
    if (alive.length === 1) {
      msgEl.textContent = "One board left: Black played " + CANDS[truth].name +
        ". You know where every piece is, for now.";
    } else {
      var names = alive.map(function (i) { return CANDS[i].name; });
      var shown = names.slice(0, 4).join(", ") + (names.length > 4 ? " and " + (names.length - 4) + " more" : "");
      msgEl.textContent = alive.length + " boards still fit what the window at " + name(center) +
        " showed: " + shown + ". Try a different square in a new game.";
    }
    draw();
  }

  function animateCount(from, to) {
    if (reduce) { countEl.textContent = String(to); return; }
    var start = null, dur = 650;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      countEl.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---- drawing ----
  var W = 0, S = 0, dpr = 1;
  function layout() {
    W = cv.offsetWidth;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = W / 8;
  }
  function xy(s) { return [(s % 8) * S, (7 - Math.floor(s / 8)) * S]; }

  function pawn(x, y, col) {
    var s = S;
    g.fillStyle = col;
    g.beginPath(); g.arc(x, y - 0.17 * s, 0.11 * s, 0, 6.2832); g.fill();
    g.beginPath();
    g.moveTo(x - 0.075 * s, y - 0.08 * s); g.lineTo(x + 0.075 * s, y - 0.08 * s);
    g.lineTo(x + 0.15 * s, y + 0.17 * s); g.lineTo(x - 0.15 * s, y + 0.17 * s);
    g.closePath(); g.fill();
    g.fillRect(x - 0.22 * s, y + 0.17 * s, 0.44 * s, 0.08 * s);
  }
  function piece(p, s, col) {
    var c = xy(s), x = c[0] + S / 2, y = c[1] + S / 2;
    var t = p.toLowerCase();
    if (t === "p") { pawn(x, y + 0.02 * S, col); return; }
    g.fillStyle = col;
    g.font = Math.round(S * 0.74) + "px " + GLYPH_FONT;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(GLYPH[t], x, y + S * 0.04);
  }

  function draw() {
    g.clearRect(0, 0, W, W);
    var win = sensed >= 0 ? windowOf(sensed) : [];
    var inWin = {}; win.forEach(function (s) { inWin[s] = true; });

    for (var s = 0; s < 64; s++) {
      var c = xy(s), light = (Math.floor(s / 8) + s % 8) % 2 === 1;
      g.fillStyle = light ? "rgba(255,255,255,0.065)" : "rgba(255,255,255,0.022)";
      g.fillRect(c[0], c[1], S, S);
    }
    // coordinates
    g.font = Math.max(8, Math.round(S * 0.19)) + "px 'IBM Plex Mono', ui-monospace, monospace";
    g.fillStyle = "rgba(139,140,147,0.75)";
    g.textAlign = "left"; g.textBaseline = "bottom";
    for (var f = 0; f < 8; f++) g.fillText(FILES[f], f * S + 3, W - 2);
    g.textBaseline = "top";
    for (var r = 0; r < 8; r++) g.fillText(String(r + 1), 3, (7 - r) * S + 2);

    // black pieces: certain ones solid, uncertain ones as a ghost scaled by how many boards agree
    for (var q = 0; q < 64; q++) {
      if (inWin[q]) continue;
      var counts = {}, n = 0;
      alive.forEach(function (i) {
        var p = CANDS[i].b[q];
        if (p && p === p.toLowerCase()) { counts[p] = (counts[p] || 0) + 1; n++; }
      });
      if (!n) continue;
      var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      var share = n / alive.length;
      if (share >= 1 && Object.keys(counts).length === 1) {
        piece(top, q, "rgba(" + CORAL + ",0.95)");
      } else {
        var cc = xy(q);
        g.fillStyle = "rgba(" + CORAL + "," + (0.05 + 0.16 * share).toFixed(3) + ")";
        g.fillRect(cc[0], cc[1], S, S);
        piece(top, q, "rgba(" + CORAL + "," + (0.16 + 0.5 * share).toFixed(3) + ")");
      }
    }
    // white pieces (always known)
    for (var w = 0; w < 64; w++) {
      var pw = AFTER_E4[w];
      if (pw && pw === pw.toUpperCase()) piece(pw, w, "rgba(" + TEXT + ",0.92)");
    }
    // the sensed window shows the truth
    if (sensed >= 0) {
      win.forEach(function (s2) {
        var p2 = CANDS[truth].b[s2];
        if (p2 && p2 === p2.toLowerCase()) piece(p2, s2, "rgba(" + CORAL + ",1)");
      });
      outline(sensed, 0.95, 0.1, 2);
    }
    if (suggested >= 0) outline(suggested, 0.55 + 0.4 * Math.abs(Math.sin(pulse)), 0.08, 2);
    if (hover >= 0 && sensed < 0) outline(hover, 0.7, 0.06, 1.5);
  }
  function outline(center, a, fillA, lw) {
    var win = windowOf(center);
    var rs = win.map(function (s) { return Math.floor(s / 8); });
    var cs = win.map(function (s) { return s % 8; });
    var c0 = Math.min.apply(null, cs), c1 = Math.max.apply(null, cs);
    var r0 = Math.min.apply(null, rs), r1 = Math.max.apply(null, rs);
    var x = c0 * S, y = (7 - r1) * S, w = (c1 - c0 + 1) * S, h = (r1 - r0 + 1) * S;
    g.fillStyle = "rgba(" + ACC + "," + fillA + ")"; g.fillRect(x, y, w, h);
    g.strokeStyle = "rgba(" + ACC + "," + a.toFixed(3) + ")"; g.lineWidth = lw;
    g.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  }

  // ---- input ----
  function squareAt(ev) {
    var rect = cv.getBoundingClientRect();
    var x = (ev.clientX - rect.left) / rect.width * 8, y = (ev.clientY - rect.top) / rect.height * 8;
    if (x < 0 || y < 0 || x >= 8 || y >= 8) return -1;
    return sq(7 - Math.floor(y), Math.floor(x));
  }
  cv.addEventListener("mousemove", function (ev) {
    if (sensed >= 0) return;
    var s = squareAt(ev);
    if (s === hover) return;
    hover = s;
    if (s >= 0) {
      msgEl.textContent = "Sensing around " + name(s) + " leaves " +
        expectedLeft(s).toFixed(1) + " boards on average.";
    } else {
      msgEl.textContent = DEFAULT_MSG;
    }
    draw();
  });
  cv.addEventListener("mouseleave", function () {
    if (sensed >= 0) return;
    hover = -1;
    msgEl.textContent = suggested >= 0 ? sugMsg : DEFAULT_MSG;
    draw();
  });
  cv.addEventListener("click", function (ev) {
    var s = squareAt(ev);
    if (s >= 0) sense(s);
  });

  var praf = 0;
  function pulseLoop() {
    if (suggested < 0) { praf = 0; return; }
    pulse += 0.06; draw();
    praf = requestAnimationFrame(pulseLoop);
  }
  bestBtn.addEventListener("click", function () {
    if (sensed >= 0) return;
    if (suggested >= 0) { sense(suggested); return; }
    suggested = bestCenter();
    sugMsg = "Best window: centred on " + name(suggested) + ". It leaves " +
      expectedLeft(suggested).toFixed(1) + " boards on average, because it looks where the boards disagree most.";
    msgEl.textContent = sugMsg;
    bestBtn.textContent = "Sense there";
    if (!reduce && !praf) praf = requestAnimationFrame(pulseLoop); else draw();
  });
  newBtn.addEventListener("click", newGame);

  // ---- init ----
  layout();
  newGame();
  var rz = 0;
  window.addEventListener("resize", function () {
    if (rz) return;
    rz = requestAnimationFrame(function () { rz = 0; layout(); draw(); });
  });
  // fonts can arrive after the first paint; repaint once they do
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { draw(); });
})();
