/* An AI Answer for Kazakhstan: site logic.
   All numbers come from data.json. Nothing here contains data.
   Plain JS, no libraries, no network calls except data.json. */
(function () {
  "use strict";

  const COLORS = ["#1F4E79", "#8F5200", "#1B6B5A", "#6B3F7A", "#444F5B"];
  const POS = "#1F4E79", NEG = "#9E2A2B", PAPER = "#FFFFFF";
  const SVGNS = "http://www.w3.org/2000/svg";

  let DATA = null, NUM = {}, SRC = {};

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isTodo = (s) => s == null || s === "" || /^\[TO FILL/.test(String(s));
  // Render a text field: placeholder style if missing or still [TO FILL ...]
  const txt = (s, fallback = "[TO FILL]") =>
    isTodo(s) ? `<span class="todo">${esc(s || fallback)}</span>` : esc(s);
  const hasVal = (r) => r && typeof r.value === "number" && isFinite(r.value);
  const fmtNum = (v, dec) => v.toLocaleString("en-US", dec == null
    ? { maximumFractionDigits: 2 } : { minimumFractionDigits: +dec, maximumFractionDigits: +dec });
  const bare = (r, dec) => fmtNum(r.value, dec) + (typeof r.value_high === "number" ? "–" + fmtNum(r.value_high, dec) : "");
  // tpl: "#" is replaced by the value, e.g. "$#bn" or "+#%". Without tpl the unit is appended.
  const fmt = (r, tpl, dec) => {
    if (!hasVal(r)) return "[TO FILL]";
    if (tpl) return tpl.replace("#", bare(r, dec));
    const u = r.unit || "";
    if (typeof r.value_high === "number") return u === "%" ? bare(r, dec) + "%" : bare(r, dec) + (u ? " " + u : "");
    if (u === "%") return fmtNum(r.value) + "%";
    if (/^(US\$|\$|₸|KZT ?)$/.test(u)) return u + fmtNum(r.value);
    return u ? fmtNum(r.value, dec) + " " + u : fmtNum(r.value, dec);
  };
  // Rich text: escapes, marks [TO FILL ...] fragments, turns {{id}} / {{id|tpl}} / {{id|tpl|dec}} into live numbers.
  const rich = (s, fallback = "[TO FILL]") => {
    if (s == null || s === "") return `<span class="todo">${esc(fallback)}</span>`;
    return esc(s).replace(/\[TO FILL[^\]]*\]/g, (m) => `<span class="todo">${m}</span>`)
      .replace(/\{\{([\w-]+)(?:\|([^|}]*))?(?:\|(\d+))?\}\}/g, (m, id, t, d) =>
        `<span data-num="${id}"${t ? ` data-fmt="${t}"` : ""}${d != null ? ` data-dec="${d}"` : ""}></span>`);
  };
  const srcName = (id) => {
    if (!id) return "[TO FILL: source]";
    const s = SRC[id];
    return s ? (s.short || s.citation) : `${id} (not in sources list)`;
  };
  const tipText = (r) => {
    if (!r) return "<b>Unknown id</b>: not in data.json";
    const status = r.verified ? "● SOLID: checked in primary document" : "○ HOLLOW: extraction / secondary only";
    return `<b>${esc(r.label || r.id)}</b>${r.year != null ? " · " + esc(r.year) : ""}<br>` +
      `${esc(hasVal(r) ? fmt(r) : "value not supplied")}<br>${status}<br>` +
      `Source: ${esc(srcName(r.source))}<br>Basis: ${esc(r.basis || "[TO FILL]")}<br>Vintage: ${esc(r.vintage || "[TO FILL]")}` +
      (r.derived ? `<br>Derived: ${esc(r.derived)}` : "");
  };
  const svg = (tag, attrs = {}, parent) => {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  const niceTicks = (min, max, n = 5) => {
    if (min === max) { min -= 1; max += 1; }
    const raw = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
    return out;
  };

  // ---------- tooltip ----------
  const tip = document.createElement("div");
  tip.className = "tip"; tip.hidden = true; tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 12)) + "px";
    tip.style.top = (y + h + 16 > window.innerHeight ? y - h - 12 : y + 14) + "px";
  }
  function hideTip() { tip.hidden = true; }
  function attachTip(el, rec) {
    el.setAttribute("tabindex", "0");
    el.addEventListener("mouseenter", (e) => showTip(tipText(rec), e.clientX, e.clientY));
    el.addEventListener("mousemove", (e) => showTip(tipText(rec), e.clientX, e.clientY));
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("focus", () => { const b = el.getBoundingClientRect(); showTip(tipText(rec), b.left, b.bottom); });
    el.addEventListener("blur", hideTip);
    el.addEventListener("click", (e) => { e.stopPropagation(); const b = el.getBoundingClientRect(); showTip(tipText(rec), b.left, b.bottom); });
  }
  document.addEventListener("click", hideTip);

  // ---------- inline numbers ----------
  function bindNumbers(root = document) {
    $$("[data-num]", root).forEach((el) => {
      const r = NUM[el.dataset.num];
      el.classList.remove("is-solid", "is-hollow", "is-missing", "todo");
      if (!hasVal(r)) { el.textContent = "[TO FILL]"; el.classList.add("is-missing", "todo"); }
      else { el.textContent = fmt(r, el.dataset.fmt, el.dataset.dec); el.classList.add(r.verified ? "is-solid" : "is-hollow"); }
      el.setAttribute("aria-label", (hasVal(r) ? fmt(r) : "not yet supplied") +
        (hasVal(r) ? (r.verified ? ", verified in primary document" : ", unverified, extraction or secondary only") : ""));
      attachTip(el, r || { id: el.dataset.num });
    });
  }

  // ---------- charts ----------
  function emptyChart(host, panel, total) {
    const W = 520, H = 200, s = svg("svg", { viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" });
    svg("rect", { x: 1, y: 1, width: W - 2, height: H - 2, class: "empty-frame" }, s);
    const t = svg("text", { x: W / 2, y: H / 2 - 6, "text-anchor": "middle", class: "empty" }, s);
    t.textContent = `[TO FILL] Panel ${panel}: 0 of ${total} data points supplied`;
    const t2 = svg("text", { x: W / 2, y: H / 2 + 14, "text-anchor": "middle", class: "empty" }, s);
    t2.textContent = `edit data.json → numbers with "panel": "${panel}"`;
    host.replaceChildren(s);
    host.setAttribute("aria-label", `Panel ${panel}: no data supplied yet`);
  }

  function marker(parent, cx, cy, color, rec, r = 4.5) {
    const c = svg("circle", { cx, cy, r, fill: rec.verified ? color : PAPER, stroke: color, "stroke-width": 2 }, parent);
    attachTip(c, rec);
    c.setAttribute("aria-label", `${rec.series || rec.label} ${rec.year ?? ""}: ${fmt(rec)}, ${rec.verified ? "verified" : "unverified"}`);
    return c;
  }

  function lineChart(host, all) {
    const W = 520, H = 260, m = { t: 30, r: 16, b: 28, l: 52 };
    const recs = all.filter((r) => !r.separate), seps = all.filter((r) => r.separate);
    const series = [...new Set(recs.map((r) => r.series || "series"))];
    const xs = all.map((r) => +r.year), ys = all.map((r) => r.value);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const ticks = niceTicks(Math.min(0, ...ys), Math.max(0, ...ys));
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const X = (v) => m.l + (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)) * (W - m.l - m.r);
    const Y = (v) => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
    const s = svg("svg", { viewBox: `0 0 ${W} ${H}` });
    const ax = svg("g", { class: "axis" }, s);
    ticks.forEach((t) => {
      svg("line", { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: t === 0 ? "zero" : "grid" }, ax);
      svg("text", { x: m.l - 6, y: Y(t) + 4, "text-anchor": "end" }, ax).textContent = fmtNum(t);
    });
    const years = [...new Set(xs)].sort((a, b) => a - b);
    const every = Math.ceil(years.length / 8);
    years.forEach((yr, i) => { if (i % every === 0 || i === years.length - 1)
      svg("text", { x: X(yr), y: H - m.b + 16, "text-anchor": "middle" }, ax).textContent = yr; });
    series.forEach((name, i) => {
      const col = COLORS[i % COLORS.length];
      const pts = recs.filter((r) => (r.series || "series") === name).sort((a, b) => a.year - b.year);
      svg("path", { d: pts.map((p, j) => (j ? "L" : "M") + X(p.year) + "," + Y(p.value)).join(""),
        fill: "none", stroke: col, "stroke-width": 2 }, s);
      pts.forEach((p) => marker(s, X(p.year), Y(p.value), col, p));
      // series key, top-left
      const g = svg("g", {}, s), kx = m.l + i * 150;
      svg("line", { x1: kx, x2: kx + 18, y1: 12, y2: 12, stroke: col, "stroke-width": 2 }, g);
      svg("text", { x: kx + 24, y: 16, class: "lbl" }, g).textContent = name;
    });
    seps.forEach((p) => {
      const col = COLORS[Math.max(0, series.indexOf(p.series)) % COLORS.length], cx = X(+p.year), cy = Y(p.value), d = 6;
      const dm = svg("path", { d: `M${cx},${cy - d}L${cx + d},${cy}L${cx},${cy + d}L${cx - d},${cy}Z`,
        fill: p.verified ? col : PAPER, stroke: col, "stroke-width": 2 }, s);
      attachTip(dm, p);
      dm.setAttribute("aria-label", `${p.label}: ${fmt(p)}, separate marker, ${p.verified ? "verified" : "unverified"}`);
    });
    if (seps.length) {
      const g = svg("g", {}, s), kx = m.l + series.length * 150;
      svg("path", { d: `M${kx + 6},6L${kx + 12},12L${kx + 6},18L${kx},12Z`, fill: PAPER, stroke: "#444F5B", "stroke-width": 2 }, g);
      svg("text", { x: kx + 18, y: 16, class: "lbl" }, g).textContent = seps[0].marker_label || "separate basis";
    }
    const u = recs.length ? recs[0].unit : all[0].unit;
    if (u) svg("text", { x: m.l, y: m.t - 4, class: "lbl" }, s).textContent = u;
    host.replaceChildren(s);
    host.setAttribute("aria-label", `Line chart, ${series.join(" and ")}, ${x0}–${x1}, unit ${u || "n/a"}`);
  }

  function barChart(host, recs) {
    const rowH = 30, m = { t: 8, r: 70, b: 24, l: 196 }, W = 560;
    const H = m.t + m.b + rowH * recs.length;
    const vals = recs.map((r) => r.value);
    const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 4);
    const v0 = ticks[0], v1 = ticks[ticks.length - 1];
    const X = (v) => m.l + (v - v0) / (v1 - v0) * (W - m.l - m.r);
    const s = svg("svg", { viewBox: `0 0 ${W} ${H}` });
    const ax = svg("g", { class: "axis" }, s);
    ticks.forEach((t) => {
      svg("line", { x1: X(t), x2: X(t), y1: m.t, y2: H - m.b, class: t === 0 ? "zero" : "grid" }, ax);
      svg("text", { x: X(t), y: H - m.b + 15, "text-anchor": "middle" }, ax).textContent = fmtNum(t);
    });
    recs.forEach((r, i) => {
      const y = m.t + i * rowH + 6, h = rowH - 12, col = r.value < 0 ? NEG : POS;
      const xa = X(Math.min(0, r.value)), w = Math.max(1, Math.abs(X(r.value) - X(0)));
      svg("text", { x: m.l - 8, y: y + h / 2 + 4, "text-anchor": "end", class: "lbl" }, s).textContent =
        (r.label || r.id).length > 34 ? (r.label || r.id).slice(0, 33) + "…" : (r.label || r.id);
      const b = svg("rect", { x: xa, y, width: w, height: h, fill: r.verified ? col : PAPER, stroke: col, "stroke-width": 2 }, s);
      attachTip(b, r);
      b.setAttribute("aria-label", `${r.label}: ${fmt(r)}, ${r.verified ? "verified" : "unverified"}`);
      // negative values: label inside the bar if it fits, otherwise just right of zero, never over the category label
      const inside = r.value < 0 && w > 44;
      const tx = r.value < 0 ? (inside ? xa + 5 : X(0) + 4) : xa + w + 4;
      svg("text", { x: tx, y: y + h / 2 + 4, "text-anchor": "start", class: "val" }, s).textContent = fmtNum(r.value);
    });
    host.replaceChildren(s);
    host.setAttribute("aria-label", `Bar chart: ${recs.map((r) => r.label + " " + fmt(r)).join("; ")}`);
  }

  function stackChart(host, recs) {
    const W = 520, barH = 44, m = { t: 10, l: 0, r: 0 };
    const pos = recs.filter((r) => r.value > 0), total = pos.reduce((a, r) => a + r.value, 0);
    const H = m.t + barH + 20 + pos.length * 20;
    const s = svg("svg", { viewBox: `0 0 ${W} ${H}` });
    let x = 0;
    pos.forEach((r, i) => {
      const w = (r.value / total) * W, col = COLORS[i % COLORS.length];
      const rect = svg("rect", { x: x + 1, y: m.t, width: Math.max(1, w - 2), height: barH,
        fill: r.verified ? col : PAPER, stroke: col, "stroke-width": 2 }, s);
      attachTip(rect, r);
      x += w;
      const ky = m.t + barH + 20 + i * 20;
      svg("rect", { x: 0, y: ky - 10, width: 12, height: 12, fill: r.verified ? col : PAPER, stroke: col, "stroke-width": 2 }, s);
      svg("text", { x: 20, y: ky, class: "lbl" }, s).textContent = `${r.label}: ${fmt(r)}`;
    });
    if (recs.length > pos.length)
      svg("text", { x: W, y: H - 4, "text-anchor": "end", class: "empty" }, s).textContent = "non-positive values omitted from stack";
    host.replaceChildren(s);
    host.setAttribute("aria-label", `Composition: ${pos.map((r) => r.label + " " + fmt(r)).join("; ")}`);
  }

  function renderCharts() {
    $$(".chart[data-panel]").forEach((host) => {
      const p = host.dataset.panel;
      const all = DATA.numbers.filter((r) => r.panel === p);
      const recs = all.filter((r) => hasVal(r) && r.chart !== false && !isTodo(r.label || r.series || "x") &&
        (host.dataset.type !== "line" || r.year != null));
      if (!recs.length) emptyChart(host, p, all.filter((r) => r.chart !== false).length);
      else if (host.dataset.type === "line") lineChart(host, recs);
      else if (host.dataset.type === "stack") stackChart(host, recs);
      else barChart(host, recs);
      // footer: source · basis · vintage for every distinct combination used
      const foot = $(`[data-foot="${p}"]`);
      if (!foot) return;
      const combos = [...new Set(recs.map((r) => JSON.stringify([r.source, r.basis, r.vintage])))].map((j) => JSON.parse(j));
      const solid = recs.filter((r) => r.verified).length;
      foot.innerHTML = combos.length
        ? combos.map(([s, b, v]) => `Source: ${txt(s ? srcName(s) : null, "[TO FILL: source]")} · Basis: ${txt(b, "[TO FILL: basis]")} · Vintage: ${txt(v, "[TO FILL: vintage]")}`).join("<br>") +
          `<br>${solid} of ${recs.length} points verified in primary document · Retrieved: ${txt(DATA.meta.retrieved, "[TO FILL: date]")}`
        : `<span class="todo">[TO FILL: source · basis · vintage · retrieval date]</span>`;
    });
  }

  // ---------- content blocks from data.json ----------
  const badge = (st) => `<span class="st st--${esc(st || "not-opened")}">${esc((st || "not-opened").replace("-", " "))}</span>`;
  const srcChips = (ids) => (ids && ids.length)
    ? `<ul class="srcchips">${ids.map((x) => { const [id, note] = String(x).split("|");
        return `<li>${badge(SRC[id] && SRC[id].status)}<a href="#src-${esc(id)}">${esc(srcName(id))}</a>${note ? ` <span>(${esc(note)})</span>` : ""}</li>`; }).join("")}</ul>`
    : `<p><span class="todo">[TO FILL: sources]</span></p>`;
  const numList = (ids) => ids.map((id) => `<li><span data-num="${esc(id)}"></span><span>${txt(NUM[id] && NUM[id].label)}</span></li>`).join("");

  function renderBlocks() {
    $("#silences").innerHTML =
      `<div class="h" role="columnheader">What we cannot see</div><div class="h" role="columnheader">Why it matters</div><div class="h" role="columnheader">Who falls through</div>` +
      DATA.silences.map((r) => `<div class="c" role="cell">${rich(r.silence)}</div><div class="c" role="cell">${rich(r.why, "[TO FILL: why it matters]")}</div><div class="c" role="cell">${rich(r.who, "[TO FILL: who falls through]")}</div>`).join("");

    $("#approaches").innerHTML = DATA.approaches.map((a, i) =>
      `<article class="approach"><span class="approach__n">Approach ${i + 1}</span><h3>${rich(a.name)}</h3><p>${rich(a.claim)}</p>${srcChips(a.sources)}</article>`).join("");

    $("#cases").innerHTML = DATA.cases.map((c) =>
      `<article class="case${c.kind ? " case--thin" : ""}"><p class="case__ev">${c.kind ? `<span class="case__kind">${esc(c.kind)}</span> ` : ""}Evidence: ${rich(c.evidence, "[TO FILL: evidence status]")}</p><h4>${rich(c.name)}</h4>
       <dl><dt>What it did</dt><dd>${rich(c.what)}</dd><dt>Reported result</dt><dd>${rich(c.result)}</dd>
       <dt>Limits</dt><dd>${rich(c.limits)}</dd></dl>
       ${c.numbers && c.numbers.length ? `<ul class="billcard__figs">${numList(c.numbers)}</ul>` : ""}${srcChips(c.sources)}</article>`).join("");

    $("#billCards").innerHTML = DATA.bill.map((b) =>
      `<article class="billcard"><h3>${esc(b.dimension)}</h3><p class="billcard__sum">${txt(b.summary)}</p>
       ${b.numbers.length ? `<ul class="billcard__figs">${numList(b.numbers)}</ul>` : `<p><span class="todo">[TO FILL: figures (number ids)]</span></p>`}
       ${b.nodata.length ? `<ul class="nodata">${b.nodata.map((n) => `<li>${txt(n)}</li>`).join("")}</ul>` : ""}
       ${srcChips(b.sources)}</article>`).join("");

    $("#conditions").innerHTML = DATA.conditions.map((c) => {
      const st = ["met", "unmet", "untested", "unknown"].includes(c.status) ? c.status : "unknown";
      return `<li><span class="cl">${txt(c.label)}</span><span class="stat-pill stat-pill--${st}">${st}</span><span class="cn">${txt(c.note)}</span></li>`;
    }).join("");

    $("#sourceList").innerHTML = DATA.sources.map((s) =>
      `<li id="src-${esc(s.id)}">${badge(s.status)}${rich(s.citation)}${s.url ? ` <a href="${esc(s.url)}" rel="noopener noreferrer">link</a>` : ""}
       ${s.note ? `<span class="note">${esc(s.note)}</span>` : ""}</li>`).join("");

    $$("[data-cites]").forEach((el) => {
      const list = DATA.sources.filter((s) => (s.section || []).includes(el.dataset.cites));
      el.innerHTML = list.length ? list.map((s) => `<a href="#src-${esc(s.id)}">${esc(s.short || s.citation)}</a>`).join("; ")
        : `<span class="todo">[TO FILL: at least 3 credible sources]</span>`;
    });
    $$("[data-meta]").forEach((el) => { el.innerHTML = txt(DATA.meta[el.dataset.meta], "[TO FILL: date]"); });
  }

  function countTodos() {
    const n = $$(".todo").length;
    const el = $("#todoCount");
    if (el) el.textContent = n ? `${n} placeholders still to fill.` : "";
    if (n) console.info(`[site] ${n} placeholders still to fill`);
  }

  // ---------- sticky progress nav ----------
  function initNav() {
    const fill = $("#progress");
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      fill.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})`;
    };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    const links = $$(".arcnav a[data-step]"), order = links.map((a) => a.dataset.step);
    const setActive = (id) => links.forEach((a) => {
      const i = order.indexOf(a.dataset.step), k = order.indexOf(id);
      a.classList.toggle("is-active", a.dataset.step === id);
      a.classList.toggle("is-done", k > -1 && i < k && a.closest(".arcnav__steps"));
      if (a.dataset.step === id) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current");
    });
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    order.forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  // ---------- presentation mode ----------
  function initPresent() {
    const root = document.documentElement, btn = $("#presentBtn"), hud = $("#hud");
    const slides = () => $$("[data-slide]");
    const current = () => {
      const ss = slides(); let best = 0, d = Infinity;
      ss.forEach((s, i) => { const t = Math.abs(s.getBoundingClientRect().top); if (t < d) { d = t; best = i; } });
      return best;
    };
    const go = (i) => {
      const ss = slides(); i = Math.max(0, Math.min(ss.length - 1, i));
      ss[i].scrollIntoView({ behavior: "smooth", block: "start" });
      $("#hudCount").textContent = `${i + 1} / ${ss.length}`;
    };
    const set = (on) => {
      root.classList.toggle("present", on); btn.setAttribute("aria-pressed", on);
      btn.textContent = on ? "Exit" : "Present"; hud.hidden = !on;
      if (on) go(current()); else if (document.fullscreenElement) document.exitFullscreen();
    };
    btn.addEventListener("click", () => set(!root.classList.contains("present")));
    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea")) return;
      const on = root.classList.contains("present");
      if (e.key === "p" || e.key === "P") { set(!on); return; }
      if (!on) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(current() + 1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(current() - 1); }
      else if (e.key === "Home") { e.preventDefault(); go(0); }
      else if (e.key === "End") { e.preventDefault(); go(slides().length - 1); }
      else if (e.key === "f" || e.key === "F") { document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen && root.requestFullscreen(); }
      else if (e.key === "Escape") set(false);
    });
    window.addEventListener("scroll", () => { if (!hud.hidden) $("#hudCount").textContent = `${current() + 1} / ${slides().length}`; }, { passive: true });
    if (new URLSearchParams(location.search).has("present")) set(true);
  }

  // ---------- boot ----------
  initNav();
  initPresent();
  fetch("data.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      DATA = d;
      d.numbers.forEach((r) => { if (NUM[r.id]) console.warn("[site] duplicate id", r.id); NUM[r.id] = r; });
      d.sources.forEach((s) => { SRC[s.id] = s; });
      d.numbers.forEach((r) => { if (hasVal(r) && !r.source) console.warn("[site] number without source:", r.id); });
      renderBlocks();
      bindNumbers();
      renderCharts();
      countTodos();
    })
    .catch((err) => {
      console.error("[site] data.json failed to load", err);
      $("#loadError").hidden = false;
      countTodos();
    });
})();
