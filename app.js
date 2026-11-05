"use strict";
(function () {
  const $ = (id) => document.getElementById(id);
  const PAIRS = 5;              // pairs per round
  const ROUNDS = 6;             // rounds per stage (30 words), then a short break
  const MASTERED = 3;           // consecutive correct answers to count a word as mastered
  const KEY = "ptwords.v1";

  /* ---------- data ---------- */
  const LESSONS = window.LESSONS;           // [n, name, desc]
  const MAXLV = LESSONS.length;
  const lessonRows = {};                    // lesson -> [[pt, ar], ...]
  const words = [];                         // unique words, course order
  const byPt = new Map();
  for (const [n, pt, ar] of window.ROWS) {
    (lessonRows[n] = lessonRows[n] || []).push([pt, ar]);
    const k = pt.toLowerCase();
    if (!byPt.has(k)) {
      const w = { id: k, pt, ar, lesson: n, short: shortAr(ar), idx: words.length };
      byPt.set(k, w);
      words.push(w);
    }
  }
  // words are in course order, so the pool up to level N is a prefix
  const poolEnd = new Array(MAXLV + 1).fill(0);
  for (const w of words) poolEnd[w.lesson] = w.idx + 1;
  for (let i = 1; i <= MAXLV; i++) poolEnd[i] = Math.max(poolEnd[i], poolEnd[i - 1]);

  function shortAr(ar) {
    const it = ar.split(", ");
    let s = it[0];
    if (it[1] && (s + it[1]).length <= 16) s += "، " + it[1];
    return s;
  }
  function tokens(w) { return w.short.split("، "); }

  /* ---------- persistent state ---------- */
  let S = { level: 1, sfx: true, tts: true, order: "random", p: {} };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  S.level = Math.min(Math.max(1, S.level | 0), MAXLV);
  let saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }, 150); }
  window.addEventListener("pagehide", () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} });
  // p[id] = [seen, right, wrong, streak, lastTick]
  let tick = Object.values(S.p).reduce((m, r) => Math.max(m, r[4] || 0), 0);
  const rec = (id) => S.p[id] || (S.p[id] = [0, 0, 0, 0, 0]);

  function stats(level) {
    let nw = 0, rev = 0, ok = 0;
    const end = poolEnd[level];
    for (let i = 0; i < end; i++) {
      const r = S.p[words[i].id];
      if (!r) nw++;
      else if (r[2] > 0 && r[3] < 2) rev++;
      else if (r[3] >= MASTERED) ok++;
    }
    return { total: end, nw, rev, ok };
  }

  /* ---------- helpers ---------- */
  const rnd = (n) => Math.floor(Math.random() * n);
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function show(id) { document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id)); }

  /* ---------- home ---------- */
  function setLevel(n, fromInput) {
    n = Math.min(Math.max(1, n | 0 || 1), MAXLV);
    S.level = n; save();
    if (!fromInput) $("lvNum").value = n;
    $("lvRange").value = n;
    const [, name, desc] = LESSONS[n - 1];
    $("lcName").textContent = name;
    $("lcDesc").textContent = desc;
    const rows = lessonRows[n] || [];
    const chips = $("lcChips");
    const showN = 14;
    chips.innerHTML = rows.slice(0, showN).map((r) => `<span class="chip">${esc(r[0])}</span>`).join("") +
      (rows.length > showN ? `<span class="chip more">+${rows.length - showN}</span>` : "");
    $("btnAll").textContent = `كلمات الدرس (${rows.length}) ›`;
    const st = stats(n);
    $("stats").innerHTML =
      `<div class="stat"><b>${st.total}</b><span>كلمة حتى هنا</span></div>` +
      `<div class="stat new"><b>${st.nw}</b><span>جديدة</span></div>` +
      `<div class="stat rev"><b>${st.rev}</b><span>للمراجعة</span></div>` +
      `<div class="stat ok"><b>${st.ok}</b><span>متقنة</span></div>`;
  }
  $("lvNum").addEventListener("input", (e) => { if (e.target.value !== "") setLevel(+e.target.value, true); });
  $("lvNum").addEventListener("blur", () => setLevel(S.level));
  $("lvNum").addEventListener("focus", (e) => e.target.select());
  $("lvRange").addEventListener("input", (e) => setLevel(+e.target.value));
  $("lvPrev").onclick = () => setLevel(S.level - 1);
  $("lvNext").onclick = () => setLevel(S.level + 1);
  $("btnAll").onclick = () => {
    const n = S.level, rows = lessonRows[n] || [];
    openSheet(`<h3>الدرس ${n}: <span dir="ltr">${esc(LESSONS[n - 1][1])}</span></h3>
      <div class="sub">${esc(LESSONS[n - 1][2])} — ${rows.length} كلمة</div>
      <div class="scroll">${rows.map((r) => `<div class="wrow"><span class="p">${esc(r[0])}</span><span class="a">${esc(shortAr(r[1]))}</span></div>`).join("")}</div>
      <button class="cta ghost" data-close>إغلاق</button>`);
  };

  /* ---------- sheets ---------- */
  function openSheet(html) { $("sheet").innerHTML = html; $("sheetWrap").classList.add("open"); }
  function closeSheet() { $("sheetWrap").classList.remove("open"); }
  $("backdrop").onclick = closeSheet;
  $("sheet").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(); });

  $("btnSettings").onclick = openSettings;
  function openSettings() {
    const tg = (k, t, sub) => `<div class="set-row"><div>${t}${sub ? `<small>${sub}</small>` : ""}</div><div class="toggle ${S[k] ? "on" : ""}" data-t="${k}"></div></div>`;
    openSheet(`<h3>الإعدادات</h3>
      <div class="scroll">
        ${tg("tts", "نطق الكلمة", "ينطق الكلمة البرتغالية عند الضغط عليها")}
        ${tg("sfx", "مؤثرات صوتية")}
        <div class="set-row"><div>ترتيب الكلمات الجديدة<small>عشوائي من كل الدروس، أو بالترتيب من أول المنهج</small></div>
          <div class="seg"><button data-o="random" class="${S.order === "random" ? "on" : ""}">عشوائي</button><button data-o="course" class="${S.order === "course" ? "on" : ""}">بالترتيب</button></div></div>
        <div class="danger" data-reset>مسح كل التقدّم</div>
      </div>
      <button class="cta ghost" data-close>تم</button>`);
  }
  $("sheet").addEventListener("click", (e) => {
    const t = e.target.closest("[data-t]");
    if (t) { S[t.dataset.t] = !S[t.dataset.t]; t.classList.toggle("on"); save(); }
    const o = e.target.closest("[data-o]");
    if (o) { S.order = o.dataset.o; save(); o.parentNode.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === o)); }
    if (e.target.closest("[data-reset]") && confirm("هل تريد مسح تقدّمك في كل الكلمات؟")) { S.p = {}; tick = 0; save(); closeSheet(); setLevel(S.level); }
  });

  /* ---------- word selection ---------- */
  let recent = [];                          // ids used in the latest rounds
  function clash(w, chosen) {
    const tw = tokens(w);
    return chosen.some((c) => c.id === w.id || tokens(c).some((t) => tw.includes(t)));
  }
  function pickRound() {
    const end = poolEnd[S.level];
    const avoid = new Set(recent);
    const A = [], B = [], C = [];
    for (let i = 0; i < end; i++) {
      const w = words[i], r = S.p[w.id];
      if (!r) B.push(w);
      else if (r[2] > 0 && r[3] < 2) A.push(w);
      else C.push(w);
    }
    const fresh = (arr) => arr.filter((w) => !avoid.has(w.id));
    const last = (r) => (r ? r[4] : 0);
    // mistakes: oldest-seen first (with some noise); new: random or course order; rest: weakest/oldest first
    const a = fresh(A).sort((x, y) => last(S.p[x.id]) - last(S.p[y.id]) + (Math.random() - .5) * 6);
    const b = S.order === "course" ? fresh(B) : shuffle(fresh(B));
    const c = fresh(C).sort((x, y) => {
      const rx = S.p[x.id], ry = S.p[y.id];
      return (rx[3] - ry[3]) * 4 + (rx[4] - ry[4]) / 8 + (Math.random() - .5) * 20;
    });
    const quota = [[a, A.length > 15 ? 3 : 2], [b, 2], [c, 1]];
    const chosen = [];
    const take = (arr, n) => { for (let i = 0; i < arr.length && n > 0; i++) if (!clash(arr[i], chosen)) { chosen.push(arr[i]); arr.splice(i--, 1); n--; } };
    for (const [arr, n] of quota) take(arr, n);
    for (const arr of [a, b, c]) take(arr, PAIRS - chosen.length);
    // small pools: relax the "recently used" rule
    if (chosen.length < Math.min(PAIRS, end)) {
      const rest = words.slice(0, end).filter((w) => !chosen.includes(w));
      shuffle(rest);
      take(rest, PAIRS - chosen.length);
    }
    const keep = Math.min(PAIRS * 3, Math.max(0, end - PAIRS * 2));
    recent = keep ? recent.concat(chosen.map((w) => w.id)).slice(-keep) : [];
    return chosen;
  }

  /* ---------- sound ---------- */
  let ac;
  function beep(freq, dur, type) {
    if (!S.sfx) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(.12, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + dur);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
    } catch (e) {}
  }
  function speak(text) {
    if (!S.tts || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR"; u.rate = .9;
      const v = speechSynthesis.getVoices().find((x) => /pt[-_]BR/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^pt/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------- practice ---------- */
  let G = null;
  function startStage() {
    G = { round: 0, matched: 0, wrongs: 0, right: 0, combo: 0, best: 0, sel: null, lock: false, round_words: [], bad: new Set(), left: 0, words: new Set() };
    show("play");
    nextRound();
  }
  function nextRound() {
    if (G.round >= ROUNDS) return finishStage();
    const ws = pickRound();
    G.round_words = ws; G.bad = new Set(); G.left = ws.length; G.sel = null; G.lock = false;
    const ar = shuffle(ws.map((w) => ({ w, side: "ar" })));
    const pt = shuffle(ws.map((w) => ({ w, side: "pt" })));
    const board = $("board");
    board.innerHTML = "";
    for (let i = 0; i < ws.length; i++) {
      for (const it of [ar[i], pt[i]]) {
        const b = document.createElement("button");
        b.className = "cell " + it.side;
        b.textContent = it.side === "ar" ? it.w.short : it.w.pt;
        b.dataset.id = it.w.id; b.dataset.side = it.side;
        board.appendChild(b);
      }
    }
    $("footNote").textContent = `الجولة ${G.round + 1} من ${ROUNDS}`;
    updateBar();
  }
  function updateBar() {
    const frac = (G.round + (G.round_words.length ? (G.round_words.length - G.left) / G.round_words.length : 0)) / ROUNDS;
    $("barFill").style.width = Math.min(100, frac * 100) + "%";
  }
  function setCombo(n, pop) {
    const el = $("combo");
    $("comboTxt").textContent = "على التوالي x" + n;
    el.classList.toggle("on", n > 0);
    if (pop) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
  }
  $("board").addEventListener("click", (e) => {
    const c = e.target.closest(".cell");
    if (!c || !G || G.lock || c.classList.contains("ok")) return;
    if (c.dataset.side === "pt") speak(byPt.get(c.dataset.id).pt);
    const cur = G.sel;
    if (!cur) { c.classList.add("sel"); G.sel = c; beep(520, .06); return; }
    if (cur === c) { c.classList.remove("sel"); G.sel = null; return; }
    if (cur.dataset.side === c.dataset.side) { cur.classList.remove("sel"); c.classList.add("sel"); G.sel = c; beep(520, .06); return; }
    cur.classList.remove("sel");
    G.sel = null;
    const id = c.dataset.id;
    if (cur.dataset.id === id) onRight(cur, c, id); else onWrong(cur, c);
  });
  function onRight(a, b, id) {
    a.classList.add("ok"); b.classList.add("ok");
    beep(780, .12); beep(1040, .16);
    const r = rec(id);
    r[0]++; r[4] = ++tick;
    if (!G.bad.has(id)) { r[1]++; r[3]++; }
    G.words.add(id);
    G.right++; G.combo++; G.best = Math.max(G.best, G.combo); setCombo(G.combo, true);
    save();
    G.left--; updateBar();
    setTimeout(() => { a.classList.add("done"); b.classList.add("done"); }, 380);
    if (G.left === 0) { G.lock = true; G.round++; setTimeout(() => { G.round >= ROUNDS ? finishStage() : nextRound(); }, 750); }
  }
  function onWrong(a, b) {
    G.lock = true;
    a.classList.add("bad"); b.classList.add("bad");
    beep(180, .25, "square");
    if (navigator.vibrate) navigator.vibrate(40);
    G.wrongs++; G.combo = 0; setCombo(0);
    for (const x of [a, b]) {
      const id = x.dataset.id;
      if (!G.bad.has(id)) { G.bad.add(id); const r = rec(id); r[2]++; r[3] = 0; r[4] = ++tick; }   // each word is penalised once per round
    }
    save();
    setTimeout(() => { a.classList.remove("bad"); b.classList.remove("bad"); G.lock = false; }, 420);
  }
  function finishStage() {
    G.lock = true;
    const st = stats(S.level);
    const tot = G.right + G.wrongs;
    const acc = tot ? Math.round((G.right / tot) * 100) : 100;
    const msg = acc >= 90 ? "ممتاز! 🔥" : acc >= 70 ? "أحسنت! 👏" : "استمر، التكرار يثبّت الكلمات 💪";
    openSheet(`<div class="cheer">🎉</div><h3 style="text-align:center">${msg}</h3>
      <div class="sum-grid">
        <div class="stat ok"><b>${G.right}</b><span>إجابات صحيحة</span></div>
        <div class="stat rev"><b>${G.wrongs}</b><span>أخطاء</span></div>
        <div class="stat"><b>${acc}%</b><span>الدقة</span></div>
        <div class="stat"><b>${G.best}</b><span>أفضل تتابع</span></div>
      </div>
      <div class="sub" style="text-align:center">حتى الدرس ${S.level}: ${st.nw} كلمة جديدة · ${st.rev} للمراجعة · ${st.ok} متقنة</div>
      <div class="btn-row"><button class="cta" data-act="more">تابع</button><button class="cta ghost" data-act="home">خروج</button></div>`);
  }
  $("sheet").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    closeSheet();
    if (b.dataset.act === "more") startStage(); else goHome();
  });
  $("btnExit").onclick = () => {
    if (!G) return goHome();
    openSheet(`<h3>هل تريد الخروج؟</h3><div class="sub">تقدّمك محفوظ تلقائياً.</div>
      <div class="btn-row"><button class="cta" data-close>أكمل المراجعة</button><button class="cta ghost" data-act="home">خروج</button></div>`);
  };
  function goHome() { G = null; window.speechSynthesis && speechSynthesis.cancel(); show("home"); setLevel(S.level); }
  $("btnStart").onclick = () => { recent = []; startStage(); };

  setLevel(S.level);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
