// Drawing code for each part of the report. Each dash.draw(name, fn) fills the elements marked data-draw="name".
// Centre the title emblems on the middle of the capital letters.
(function () {
  function align() {
    document.querySelectorAll('.tsr-title-row, .brand-row').forEach((row) => {
      const t = row.querySelector('.tsr-title-main, .brand-main'); if (!t) return;
      const cs = getComputedStyle(t);
      const ctx = document.createElement('canvas').getContext('2d'); if (!ctx) return;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText(t.textContent.toUpperCase());
      if (!m.fontBoundingBoxAscent) return;
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize);
      const base = (lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      const mid = base - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      const off = mid - lh / 2;
      row.querySelectorAll('.tsr-emblem, .nav-emb').forEach((s) => { s.style.transform = `translateY(${off.toFixed(2)}px)`; });
    });
  }
  align();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(align);
  window.addEventListener('resize', align);
})();

window.tsr = {
  rows() { const d = dash.data('games'); return d.status === 'ok' ? d.data : []; },
  row() {
    const rows = this.rows(); if (!rows.length) return null;
    const want = dash.params().game;
    return rows.find((r) => String(r.id) === String(want)) || rows.reduce((a, b) => (String(b.id) > String(a.id) ? b : a));
  },
  span(cls, text, _f, _r, tag) { const s = document.createElement(tag || 'span'); if (cls) s.className = cls; s.textContent = text; return s; },
  fmtVP(v) { return v > 0 ? 'US +' + v : v < 0 ? 'USSR ' + (-v) : 'Even'; },
  sideName: { us: 'US', ussr: 'USSR' },
  icon: { us: '★', ussr: '☭' },
  tip(cell, text) {
    const tip = document.createElement('div'); tip.className = 'tsr-tip'; tip.hidden = true; tip.textContent = text;
    cell.appendChild(tip);
    cell.onmouseenter = () => { tip.hidden = false; }; cell.onmouseleave = () => { tip.hidden = true; };
    cell.ontouchstart = () => { tip.hidden = !tip.hidden; };
  }
};

dash.draw('gamepick', (sel) => {
  const rows = tsr.rows().slice().sort((a, b) => String(b.id).localeCompare(String(a.id)));
  const r = tsr.row();
  sel.replaceChildren(...rows.map((x) => new Option(`${x.id} · ${x.us_player} (US) vs ${x.ussr_player} (USSR)`, String(x.id))));
  if (r) sel.value = String(r.id);
  sel.onchange = () => dash.setParams({ game: sel.value });
});

dash.draw('pname', (el) => {
  const r = tsr.row(); const s = el.dataset.side;
  el.textContent = r ? r[s + '_player'] : '—';
});

dash.draw('ptags', (el) => {
  const r = tsr.row(); const s = el.dataset.side; if (!r) { el.replaceChildren(); return; }
  el.replaceChildren(...(r.winner === tsr.sideName[s] ? [tsr.span('tsr-tag win', tsr.icon[s] + ' Winner')] : []));
});

dash.draw('vp', (el) => {
  const r = tsr.row(); if (!r) { el.textContent = '—'; el.className = 'tsr-vp'; return; }
  el.className = 'tsr-vp ' + (r.final_vp > 0 ? 'us' : r.final_vp < 0 ? 'ussr' : '');
  el.textContent = tsr.fmtVP(r.final_vp);
});

dash.draw('track', (el) => {
  const r = tsr.row(); el.replaceChildren(); if (!r) return;
  const NS = 'http://www.w3.org/2000/svg';
  const W = Math.max(200, el.clientWidth || 300), H = 32, pad = 16, mid = W / 2, half = (W - 2 * pad) / 2;
  const x = (vp) => mid - Math.max(-20, Math.min(20, vp)) / 20 * half;
  const mk = (tag, attrs, style) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (style) n.setAttribute('style', style); return n; };
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `VP track, US 20 on the left to USSR 20 on the right; final VP ${tsr.fmtVP(r.final_vp)}` });
  svg.append(
    mk('rect', { x: pad, y: 14, width: half, height: 4 }, 'fill:var(--us-soft)'),
    mk('rect', { x: mid, y: 14, width: half, height: 4 }, 'fill:var(--ussr-soft)'),
    mk('line', { x1: mid, x2: mid, y1: 10, y2: 22 }, 'stroke:#9aa2b1;stroke-width:1'));
  const mx = x(r.final_vp);
  const col = r.final_vp > 0 ? 'var(--us)' : r.final_vp < 0 ? 'var(--ussr)' : '#9aa2b1';
  svg.append(mk('circle', { cx: mx, cy: 16, r: 11 }, `fill:${col};stroke:#fff;stroke-width:2`));
  const t = mk('text', { x: mx, y: 16, dy: '0.36em', 'text-anchor': 'middle' }, 'fill:#fff;font-size:13px');
  t.textContent = r.final_vp > 0 ? '★' : r.final_vp < 0 ? '☭' : '=';
  svg.append(t);
  el.append(svg);
});

dash.draw('ending', (el) => { const r = tsr.row(); el.textContent = r ? r.ending : '—'; });
dash.draw('turn', (el) => { const r = tsr.row(); el.textContent = r ? String(r.turn) : '—'; });
dash.draw('clock', (el) => { const r = tsr.row(); el.textContent = r && r.clock_min != null ? String(r.clock_min) : '—'; });

dash.draw('dice', (el) => {
  const r = tsr.row(); const s = el.dataset.side, k = el.dataset.k;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const avg = r[`${s}_${k}_avg`], n = r[`${s}_${k}_n`];
  const bar = document.createElement('div'); bar.className = 'tsr-bar';
  const fill = document.createElement('div'); fill.className = 'tsr-fill'; fill.style.width = avg == null ? '0%' : (avg / 6 * 100) + '%';
  const ref = document.createElement('div'); ref.className = 'tsr-ref'; ref.style[s === 'us' ? 'right' : 'left'] = `${3.5 / 6 * 100}%`;
  bar.append(fill, ref);
  const val = avg == null ? tsr.span('tsr-val empty', '—') : tsr.span('tsr-val', avg.toFixed(2));
  const cnt = tsr.span('tsr-n tsr-cnt', `(${n})`);
  el.replaceChildren(val, bar, cnt);
  tsr.tip(el, avg == null ? `${r[s + '_player']}: no rolls` : `${r[s + '_player']}: ${avg.toFixed(2)} over ${n} roll${n === 1 ? '' : 's'} (fair 3.50)`);
});

dash.draw('ops', (el) => {
  const r = tsr.row(); const s = el.dataset.side, era = el.dataset.era;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const T = r[`${s}_${era}_total`], C = r[`${s}_${era}_costly`];
  let max = era === 'game'
    ? Math.max(r.us_game_total, r.ussr_game_total)
    : Math.max(...['us', 'ussr'].flatMap((x) => ['early', 'mid', 'late'].map((e) => r[`${x}_${e}_total`])));
  max = Math.max(max, 1);
  const wrap = document.createElement('div'); wrap.className = 'tsr-ops ' + s;
  const bar = document.createElement('div'); bar.className = 'tsr-bar';
  const fp = document.createElement('div'); fp.className = 'tsr-fill'; fp.style.width = ((T - C) / max * 100) + '%';
  const fc = document.createElement('div'); fc.className = 'tsr-fill cost'; fc.style.width = (C / max * 100) + '%';
  fc.style[s === 'us' ? 'right' : 'left'] = ((T - C) / max * 100) + '%';
  bar.append(fp, fc);
  const nums = document.createElement('div'); nums.className = 'tsr-nums';
  const item = (label, v) => { const x = document.createElement('span'); x.append(label + ' ', tsr.span('', String(v), 0, 0, 'b')); return x; };
  nums.append(item('Total', T), item('Costly', C));
  const A = r[`${s}_${era}_avg_ops`];
  const avg = document.createElement('span'); avg.className = 'tsr-avg';
  if (A == null) avg.textContent = '—';
  else avg.append(tsr.span('', A.toFixed(1), 0, 0, 'b'), ' /card');
  const row = document.createElement('div'); row.className = 'tsr-oprow';
  row.append(bar, avg);
  wrap.append(row, nums);
  el.replaceChildren(wrap);
  tsr.tip(el, `${r[s + '_player']}: ${T} Ops played, ${C} of them costly${A == null ? '' : `, ${A.toFixed(1)} Ops per card`}`);
});

dash.draw('four', (el) => {
  const r = tsr.row(); const s = el.dataset.side;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const F = r[`${s}_game_four`];
  const box = document.createElement('div'); box.className = 'tsr-four';
  box.append(tsr.span('', String(F), 0, 0, 'b'));
  el.replaceChildren(box);
  tsr.tip(el, `${r[s + '_player']}: ${F} card${F === 1 ? '' : 's'} played at 4 Ops`);
});

dash.draw('flips', (el) => {
  const r = tsr.row(); const s = el.dataset.side;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const F = r[`${s}_bg_flips`], N = r[`${s}_coup_bg_n`];
  const box = document.createElement('div'); box.className = 'tsr-war';
  const icons = tsr.span('ic', tsr.icon[s].repeat(F)); icons.setAttribute('aria-hidden', 'true');
  const num = document.createElement('span'); num.style.whiteSpace = 'nowrap';
  num.append(tsr.span('', String(F), 0, 0, 'b'), ' ', tsr.span('tsr-n', `of ${N}`));
  box.append(num, icons);
  el.replaceChildren(box);
  tsr.tip(el, `${r[s + '_player']}: ${F} of ${N} battleground coup${N === 1 ? '' : 's'} took control from the opponent`);
});

dash.draw('wars', (el) => {
  const r = tsr.row(); const s = el.dataset.side;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const W = r[`${s}_wars_won`];
  const box = document.createElement('div'); box.className = 'tsr-war';
  const icons = tsr.span('ic', tsr.icon[s].repeat(W)); icons.setAttribute('aria-hidden', 'true');
  box.append(tsr.span('', String(W), 0, 0, 'b'), icons);
  el.replaceChildren(box);
  tsr.tip(el, `${r[s + '_player']}: ${W} war${W === 1 ? '' : 's'} won`);
});

// Scoring card colours (two-tone cards are split top/bottom)
tsr.scorColor = {
  1: ['#F3A638'],             // Asia Scoring
  2: ['#A499C3', '#BFB7D6'],  // Europe Scoring
  3: ['#C4E4F5'],             // Middle East Scoring
  37: ['#C8D896'],            // Central America Scoring
  38: ['#F3A638', '#FFD200'], // Southeast Asia Scoring
  79: ['#F7E396'],            // Africa Scoring
  81: ['#9AC284']             // South America Scoring
};
tsr.eraOf = (turn) => (turn <= 3 ? 'early' : turn <= 7 ? 'mid' : 'late');

dash.draw('scor', (el) => {
  const r = tsr.row(); const s = el.dataset.side, era = el.dataset.era;
  if (!r) { el.replaceChildren(tsr.span('tsr-n', '—')); return; }
  const S = r[`${s}_${era}_scorings`];
  const seq = Array.isArray(r[`${s}_scoring_seq`]) ? r[`${s}_scoring_seq`].filter(([, turn]) => era === 'game' || tsr.eraOf(turn) === era) : null;
  const box = document.createElement('div'); box.className = 'tsr-sc';
  const pips = document.createElement('div'); pips.className = 'tsr-pips';
  const cards = (window.TS_REFERENCE && window.TS_REFERENCE.cards) || {};
  for (let i = 0; i < S; i++) {
    const p = document.createElement('span'); p.className = 'tsr-pip';
    p.tabIndex = 0;
    if (seq && seq[i]) {
      const [no, turn] = seq[i];
      const name = cards[no] ? cards[no][0] : 'Scoring card';
      const col = tsr.scorColor[no] || ['#9aa2b1'];
      p.classList.add('scored');
      p.style.background = col.length > 1 ? `linear-gradient(${col[0]} 0 50%, ${col[1]} 50% 100%)` : col[0];
      p.dataset.tip = `${name} · Turn ${turn}`;
      p.setAttribute('aria-label', `${name}, turn ${turn}`);
    } else {
      p.dataset.tip = 'Add this game\'s log again to see which scoring card this was';
      p.setAttribute('aria-label', 'Scoring card');
    }
    pips.append(p);
  }
  box.append(tsr.span('', String(S), 0, 0, 'b'), pips);
  el.replaceChildren(box);
});

// ---------- "?" help: what each measure means ----------
(function () {
  const HELP = {
    vp: ['<b>Final VP</b> is the score when the game ended. The track runs from US 20 on the left to USSR 20 on the right.',
      'The log never says how a game ended, so it is worked out by replaying the game: 20 VP, DEFCON 1, Final Scoring, Wargames, Europe Control, Cuban Missile Crisis, a scoring card held at the end of a turn, or a forfeit or timeout.'],
    wars: ['<b>Wars won</b> counts war events this player won.',
      'Korean War and Arab-Israeli War always count for the USSR, even when the US triggers them. Neutral wars (Indo-Pakistani War, Brush War, Iran-Iraq War) count for the player who played the card.'],
    four: ['<b>4 Ops cards</b> counts cards this player played at 4 Ops or more, after modifiers: Red Scare/Purge −1, Containment +1 (US), Brezhnev Doctrine +1 (USSR).',
      'Scoring cards are not counted.'],
    coups: ['The average <b>raw die roll</b> on this player\'s coups, before Ops and modifiers are added. Coups made through events count too.',
      'The thin line marks 3.5, the average of a fair die. The number in brackets is how many coup rolls there were.'],
    bg: ['<b>Battleground</b> coups target battleground countries, the countries that decide Domination and Control in region scoring and are worth 1 VP each when controlled. Taiwan counts once Formosan Resolution is in play and the US controls Taiwan.',
      '<b>Non-battleground</b> coups target every other country.'],
    flips: ['A <b>battleground flip</b> is a coup in a battleground country that the opponent controlled before the coup and this player controlled after it.',
      '"of 6" means 6 battleground coups in total.'],
    ops: ['<b>Total</b> is the Ops value of every non-scoring card this player played: for Ops, as an event or on the Space Race. Values include Red Scare/Purge, Containment and Brezhnev Doctrine. The China Card counts 5 when all its Ops went into Asia.',
      '<b>Costly</b> Ops come from opponent cards whose event fired, or that were sent to the Space Race to avoid the event. They are the light part of the bar.',
      '<b>/card</b> is the average Ops per card. Early War is turns 1–3, Mid War 4–7, Late War 8–10.'],
    timeline: ['The score after every step of the game: the headlines, each action round and the end of each turn. Above the middle line the US is ahead; below it the USSR is ahead.',
      'Hover over or tap the chart to see the action round, the card played, how many VP changed hands in that step and the score after it. The scale always runs to 20 VP each way; the dashed lines mark 20 VP, which wins the game.'],
    scor: ['<b>Scoring cards</b> this player played, for the whole game and per era, in the order they were played.',
      'Each card has its own colour. Hover over or tap a card to see which region it scored and in which turn.']
  };
  const pop = document.createElement('div'); pop.className = 'tsr-pop'; pop.id = 'tsr-pop'; pop.setAttribute('role', 'tooltip'); pop.hidden = true;
  (document.getElementById('report') || document.body).appendChild(pop);
  let cur = null, pinned = false;
  function show(btn) {
    const k = btn.dataset.help; const lines = btn.dataset.tip ? [btn.dataset.tip] : HELP[k]; if (!lines) return;
    if (cur && cur !== btn) cur.setAttribute('aria-expanded', 'false');
    cur = btn; btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-describedby', 'tsr-pop');
    pop.replaceChildren(...lines.map((s) => { const q = document.createElement('p'); if (btn.dataset.tip) q.textContent = s; else q.innerHTML = s; return q; }));
    pop.classList.toggle('small', !!btn.dataset.tip);
    pop.hidden = false;
    const r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, m = 8;
    let x = r.left + r.width / 2 - pw / 2; x = Math.max(m, Math.min(x, window.innerWidth - pw - m));
    let y = r.bottom + 8; if (y + ph > window.innerHeight - m) y = Math.max(m, r.top - ph - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function hide() { if (cur) { cur.setAttribute('aria-expanded', 'false'); cur.removeAttribute('aria-describedby'); } cur = null; pinned = false; pop.hidden = true; }
  document.querySelectorAll('.tsr-help').forEach((b) => {
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('mouseenter', () => { if (!pinned) show(b); });
    b.addEventListener('mouseleave', () => { if (!pinned) hide(); });
    b.addEventListener('focus', () => show(b));
    b.addEventListener('blur', () => hide());
    b.addEventListener('click', (e) => { e.stopPropagation(); if (pinned && cur === b) { hide(); } else { show(b); pinned = true; } });
  });
  // scoring card pips are redrawn, so listen on the document
  document.addEventListener('mouseover', (e) => { const p = e.target.closest && e.target.closest('.tsr-pip[data-tip]'); if (p && !pinned && cur !== p) show(p); });
  document.addEventListener('mouseout', (e) => { const p = e.target.closest && e.target.closest('.tsr-pip[data-tip]'); if (p && !pinned && cur === p && !p.contains(e.relatedTarget)) hide(); });
  document.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches('.tsr-pip[data-tip]')) show(e.target); });
  document.addEventListener('focusout', (e) => { if (e.target.matches && e.target.matches('.tsr-pip[data-tip]') && !pinned) hide(); });
  document.addEventListener('click', (e) => {
    const p = e.target.closest && e.target.closest('.tsr-pip[data-tip]');
    if (p) { e.stopPropagation(); if (pinned && cur === p) hide(); else { show(p); pinned = true; } return; }
    if (pinned) hide();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', () => { if (cur) hide(); }, { passive: true });
  window.addEventListener('resize', () => { if (cur) hide(); });
})();

// ---------- VP timeline: score after every headline, action round and turn end ----------
dash.draw('timeline', (el) => {
  const r = tsr.row(); el.replaceChildren(); if (!r) return;
  const tl = r.vp_timeline;
  if (!Array.isArray(tl) || !tl.length) { el.append(tsr.span('tsr-tl-empty', 'Add this game\'s log again to see the timeline.', 0, 0, 'p')); return; }
  const cards = (window.TS_REFERENCE && window.TS_REFERENCE.cards) || {};
  const pts = [[tl[0][0], 'S', null, null, 0]].concat(tl);
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.append(n); return n; };
  const W = Math.max(320, el.clientWidth || 800), narrow = W < 560;
  const H = narrow ? 190 : 210, L = narrow ? 52 : 64, R = 14, T = 10, B = 24;
  const iw = W - L - R, ih = H - T - B;
  const dom = 20; // fixed: Even in the middle, 20 VP each way
  const n = pts.length;
  const x = (i) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => T + ih / 2 - (Math.max(-20, Math.min(20, v)) / dom) * (ih / 2);
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Victory points after every action round, from even at the start to ${tsr.fmtVP(r.final_vp)} at the end` });

  // turn bands and labels
  const turns = []; pts.forEach((p, i) => { if (!turns.length || turns[turns.length - 1].t !== p[0]) turns.push({ t: p[0], a: i, b: i }); else turns[turns.length - 1].b = i; });
  const g0 = mk('g', {}, svg);
  turns.forEach((tb, k) => {
    const x0 = k === 0 ? L : (x(tb.a - 1) + x(tb.a)) / 2, x1 = k === turns.length - 1 ? L + iw : (x(tb.b) + x(tb.b + 1)) / 2;
    if (k % 2 === 0) mk('rect', { x: x0, y: T, width: Math.max(0, x1 - x0), height: ih, fill: '#f6f7fa' }, g0);
    if (k > 0) mk('line', { x1: x0, x2: x0, y1: T, y2: T + ih, stroke: '#e4e7ee', 'stroke-width': 1 }, g0);
    const lab = mk('text', { x: (x0 + x1) / 2, y: H - 8, 'text-anchor': 'middle', class: 'turnlab' }, g0);
    lab.textContent = narrow ? String(tb.t) : `Turn ${tb.t}`;
  });

  // y axis
  const ax = mk('g', { class: 'axis' }, svg);
  const step = 10; // ticks at Even, 10 and 20 each way
  for (let v = -dom; v <= dom; v += step) {
    if (step === 1 && v % 1) continue;
    const yy = y(v);
    if (v !== 0) mk('line', { x1: L, x2: L + iw, y1: yy, y2: yy, stroke: '#eef0f4', 'stroke-width': 1 }, ax);
    if (step === 1 && Math.abs(v) % (dom <= 5 ? 1 : 5) && v !== 0) continue;
    const lab = mk('text', { x: L - 8, y: yy, dy: '0.35em', 'text-anchor': 'end', class: v > 0 ? 'us' : v < 0 ? 'ussr' : '' }, ax);
    lab.textContent = v === 0 ? 'Even' : v > 0 ? `US ${v}` : `USSR ${-v}`;
  }
  {
    [20, -20].forEach((v) => mk('line', { x1: L, x2: L + iw, y1: y(v), y2: y(v), stroke: v > 0 ? 'var(--us-soft)' : 'var(--ussr-soft)', 'stroke-width': 1, 'stroke-dasharray': '4 3' }, ax));
  }

  // stepped VP line with blue fill above zero and red fill below
  const id = 'tl' + String(r.id).replace(/\W/g, '');
  const defs = mk('defs', {}, svg);
  const cu = mk('clipPath', { id: id + 'u' }, defs); mk('rect', { x: L, y: T - 2, width: iw, height: ih / 2 + 2 }, cu);
  const cd = mk('clipPath', { id: id + 'd' }, defs); mk('rect', { x: L, y: y(0), width: iw, height: ih / 2 + 2 }, cd);
  let d = `M${x(0)},${y(pts[0][4])}`;
  for (let i = 1; i < n; i++) d += `H${x(i)}V${y(pts[i][4])}`;
  const area = d + `V${y(0)}H${x(0)}Z`;
  mk('path', { d: area, fill: 'var(--us)', 'fill-opacity': 0.14, 'clip-path': `url(#${id}u)` }, svg);
  mk('path', { d: area, fill: 'var(--ussr)', 'fill-opacity': 0.14, 'clip-path': `url(#${id}d)` }, svg);
  mk('line', { x1: L, x2: L + iw, y1: y(0), y2: y(0), stroke: '#9aa2b1', 'stroke-width': 1.2 }, svg);
  mk('path', { d, fill: 'none', stroke: 'var(--us)', 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'clip-path': `url(#${id}u)` }, svg);
  mk('path', { d, fill: 'none', stroke: 'var(--ussr)', 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'clip-path': `url(#${id}d)` }, svg);
  const fv = pts[n - 1][4], fc = fv > 0 ? 'var(--us)' : fv < 0 ? 'var(--ussr)' : '#9aa2b1';
  mk('circle', { cx: x(n - 1), cy: y(fv), r: 4.5, fill: fc, stroke: '#fff', 'stroke-width': 2 }, svg);

  // hover / tap: nearest point
  const guide = mk('line', { y1: T, y2: T + ih, stroke: '#1d2433', 'stroke-opacity': 0.25, 'stroke-width': 1, visibility: 'hidden' }, svg);
  const dot = mk('circle', { r: 4.5, fill: '#fff', 'stroke-width': 2.2, visibility: 'hidden' }, svg);
  const hit = mk('rect', { x: L, y: T, width: iw, height: ih, class: 'tl-hit' }, svg);
  el.append(svg);
  const tip = document.createElement('div'); tip.className = 'tsr-tl-tip'; tip.hidden = true; el.append(tip);
  const what = (p) => {
    const [turn, ph, ar, card] = p;
    if (ph === 'S') return 'Start of the game';
    if (ph === 'H') return `Turn ${turn} · Headlines`;
    if (ph === 'C') return `Turn ${turn} · End of turn`;
    if (ph === 'E') return `Turn ${turn} · Game end`;
    const use = p[6] ? ` (${p[6]})` : '';
    const nm = card && cards[card] ? ` · ${cards[card][0]}${use}` : '';
    return `Turn ${turn} · ${ph} AR${ar}${nm}`;
  };
  const show = (clientX) => {
    const box = svg.getBoundingClientRect(), sx = (clientX - box.left) * (W / box.width);
    const i = Math.max(0, Math.min(n - 1, Math.round(((sx - L) / iw) * (n - 1))));
    const p = pts[i], v = p[4], c = v > 0 ? 'var(--us)' : v < 0 ? 'var(--ussr)' : '#9aa2b1';
    guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(v)); dot.setAttribute('stroke', c); dot.setAttribute('visibility', 'visible');
    tip.replaceChildren();
    const a = document.createElement('div'); a.textContent = what(p);
    const prev = i > 0 ? pts[i - 1][4] : 0, dv = v - prev;
    const flows = [];
    const flowLine = (d, src) => {
      const f = document.createElement('div'); f.className = 'flow';
      const fs = document.createElement('span'); fs.className = d > 0 ? 'vp-us' : d < 0 ? 'vp-ussr' : '';
      fs.textContent = d > 0 ? `US +${d} VP` : d < 0 ? `USSR +${-d} VP` : '±0 VP';
      f.append(fs, ' ', document.createTextNode(src ? `from ${src}` : ''));
      return f;
    };
    if (Array.isArray(p[5]) && p[5].length) for (const [d, src] of p[5]) flows.push(flowLine(d, src));
    else if (dv !== 0) flows.push(flowLine(dv, ''));
    else if (p[1] !== 'S') { const f = document.createElement('div'); f.className = 'flow none'; f.textContent = 'No VP change'; flows.push(f); }
    const b = document.createElement('div'); b.className = 'stock'; const s = document.createElement('span'); s.className = v > 0 ? 'vp-us' : v < 0 ? 'vp-ussr' : ''; s.textContent = tsr.fmtVP(v); b.append('Score: ', s);
    tip.append(a, ...flows, b); tip.hidden = false;
    const k = box.width / W; let left = x(i) * k; const tw = tip.offsetWidth;
    left = Math.max(tw / 2, Math.min(box.width - tw / 2, left));
    tip.style.left = left + 'px'; tip.style.top = (y(v) * k) + 'px';
  };
  const hide = () => { guide.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  hit.addEventListener('mousemove', (e) => show(e.clientX));
  hit.addEventListener('mouseleave', hide);
  hit.addEventListener('touchstart', (e) => { if (e.touches[0]) show(e.touches[0].clientX); }, { passive: true });
  hit.addEventListener('touchmove', (e) => { if (e.touches[0]) show(e.touches[0].clientX); }, { passive: true });
});
